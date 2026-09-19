const { ChatMessage, ChatReaction, Barangay, Notification, User, UserBarangayAssignment } = require('../models');
const { ROLES } = require('../constants/roles');
const { storeUpload } = require('../services/uploads');

const CHAT_ROLES = Object.values(ROLES);
const ALLOWED_EMOJIS = ['👍', '❤️', '😊', '😂', '🎉', '😮', '😢', '🙏', '✅', '🔥'];

const senderInclude = {
  model: User,
  as: 'sender',
  attributes: ['id', 'display_name', 'email', 'role', 'profile_image_url'],
  include: [
    { model: Barangay, as: 'barangay', attributes: ['id', 'name', 'seal_url'] },
    { association: 'assignedBarangays', attributes: ['id', 'name'], through: { attributes: [] } },
  ],
};

const messageInclude = [
  senderInclude,
  {
    model: ChatMessage,
    as: 'replyTo',
    attributes: ['id', 'body', 'sender_id'],
    include: [{ model: User, as: 'sender', attributes: ['id', 'display_name', 'email'] }],
  },
  {
    model: ChatReaction,
    as: 'reactions',
    attributes: ['id', 'user_id', 'emoji'],
    include: [{ model: User, as: 'user', attributes: ['id', 'display_name', 'email'] }],
  },
];

async function accessibleBarangays(user) {
  if ([ROLES.ADMINISTRATOR, ROLES.MUNICIPAL_ACCOUNTANT, ROLES.SK_BOOKKEEPER].includes(user.role)) return Barangay.findAll({ attributes: ['id', 'name', 'seal_url'], order: [['name', 'ASC']] });
  if (user.role === ROLES.BARANGAY_BOOKKEEPER) {
    const bookkeeper = await User.findByPk(user.id, {
      include: [{ association: 'assignedBarangays', attributes: ['id', 'name', 'seal_url'], through: { attributes: [] } }],
    });
    return bookkeeper?.assignedBarangays || [];
  }
  const barangay = user.barangay_id ? await Barangay.findByPk(user.barangay_id, { attributes: ['id', 'name', 'seal_url'] }) : null;
  return barangay ? [barangay] : [];
}

async function resolveRoom(req) {
  const roomType = req.params.roomType || req.body.room_type;
  if (roomType === 'municipality') return { roomType, barangayId: null };
  const barangayId = Number(req.params.barangayId || req.body.barangay_id);
  if (roomType !== 'barangay' || !Number.isInteger(barangayId) || barangayId < 1) return { error: 'invalid_room' };
  const barangays = await accessibleBarangays(req.user);
  return barangays.some((barangay) => Number(barangay.id) === barangayId) ? { roomType, barangayId } : { error: 'forbidden' };
}

async function canAccessMessage(user, message) {
  if (message.room_type === 'municipality') return true;
  const barangays = await accessibleBarangays(user);
  return barangays.some((barangay) => Number(barangay.id) === Number(message.barangay_id));
}

function serializeMessages(messages, userId) {
  return messages.map((message) => {
    const data = message.toJSON ? message.toJSON() : message;
    data.attachments = Array.isArray(data.attachments) ? data.attachments : [];
    data.reactions = (data.reactions || []).map((reaction) => ({
      ...reaction,
      is_mine: Number(reaction.user_id) === Number(userId),
    }));
    return data;
  });
}

async function createMessageNotifications(sender, room, body) {
  const recipientIds = new Set();
  if (room.roomType === 'municipality') {
    const users = await User.findAll({ where: { status: 'active' }, attributes: ['id'] });
    users.forEach((user) => recipientIds.add(Number(user.id)));
  } else {
    const [barangayUsers, assignments, barangay] = await Promise.all([
      User.findAll({ where: { status: 'active', barangay_id: room.barangayId }, attributes: ['id'] }),
      UserBarangayAssignment.findAll({ where: { barangay_id: room.barangayId }, attributes: ['user_id'] }),
      Barangay.findByPk(room.barangayId, { attributes: ['name'] }),
    ]);
    barangayUsers.forEach((user) => recipientIds.add(Number(user.id)));
    assignments.forEach((assignment) => recipientIds.add(Number(assignment.user_id)));
    const senderName = sender.display_name || sender.email || 'A member';
    await Notification.bulkCreate([...recipientIds]
      .filter((recipientId) => recipientId !== Number(sender.id))
      .map((recipient_id) => ({
        recipient_id,
        title: `New message in Barangay ${barangay?.name || room.barangayId}`,
        message: `${senderName}: ${body.slice(0, 180)}`,
        link: '/messages',
      })));
    return;
  }

  const senderName = sender.display_name || sender.email || 'A member';
  await Notification.bulkCreate([...recipientIds]
    .filter((recipientId) => recipientId !== Number(sender.id))
    .map((recipient_id) => ({
      recipient_id,
      title: 'New municipality message',
      message: `${senderName}: ${body.slice(0, 180)}`,
      link: '/messages',
    })));
}

async function listRooms(req, res) {
  try {
    const barangays = await accessibleBarangays(req.user);
    return res.json({ ok: true, rooms: [
      { id: 'municipality', room_type: 'municipality', name: 'Municipality Chat', description: 'Municipality-wide discussion.' },
      ...barangays.map((barangay) => ({ id: `barangay-${barangay.id}`, room_type: 'barangay', barangay_id: barangay.id, name: `Barangay ${barangay.name}`, description: 'Private barangay group chat.', seal_url: barangay.seal_url }))
    ] });
  } catch (error) { console.error('listRooms error', error); return res.status(500).json({ error: 'internal' }); }
}

async function listMessages(req, res) {
  try {
    const room = await resolveRoom(req);
    if (room.error) return res.status(room.error === 'forbidden' ? 403 : 400).json({ error: room.error });
    const messages = await ChatMessage.findAll({ where: { room_type: room.roomType, barangay_id: room.barangayId }, include: messageInclude, order: [['created_at', 'ASC']], limit: 100 });
    return res.json({ ok: true, messages: serializeMessages(messages, req.user.id) });
  } catch (error) { console.error('listMessages error', error); return res.status(500).json({ error: 'internal' }); }
}

async function uploadChatAttachment(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const filePath = await storeUpload(req.file, 'uploads/chat');
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const attachmentType = mimeType.startsWith('image/') ? 'image' : 'file';
    return res.status(201).json({
      ok: true,
      attachment: {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: req.file.originalname,
        type: attachmentType,
        mime_type: mimeType,
        url: `/${filePath}`,
      },
    });
  } catch (error) {
    console.error('uploadChatAttachment error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function sendMessage(req, res) {
  try {
    const room = await resolveRoom(req);
    const body = String(req.body.body || '').trim();
    const rawAttachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];
    const attachments = rawAttachments.filter((attachment) => attachment && attachment.url && attachment.name).slice(0, 5);
    const replyToId = req.body.reply_to_id ? Number(req.body.reply_to_id) : null;
    if (room.error) return res.status(room.error === 'forbidden' ? 403 : 400).json({ error: room.error });
    if ((!body || body.length > 2000) && attachments.length === 0) return res.status(400).json({ error: 'message_body_required' });
    if (body.length > 2000) return res.status(400).json({ error: 'message_body_required' });
    if (replyToId && (!Number.isInteger(replyToId) || replyToId < 1)) return res.status(400).json({ error: 'invalid_reply' });
    if (replyToId) {
      const replyTo = await ChatMessage.findByPk(replyToId);
      if (!replyTo || replyTo.room_type !== room.roomType || Number(replyTo.barangay_id || 0) !== Number(room.barangayId || 0)) return res.status(400).json({ error: 'invalid_reply' });
    }
    const messageBody = body || (attachments.length ? 'Shared attachment' : '');
    const message = await ChatMessage.create({ room_type: room.roomType, barangay_id: room.barangayId, sender_id: req.user.id, reply_to_id: replyToId, body: messageBody, attachments });
    await createMessageNotifications(req.user, room, messageBody);
    const populated = await ChatMessage.findByPk(message.id, { include: messageInclude });
    if (req.logAction) await req.logAction({ userId: req.user.id, action: 'SEND_CHAT_MESSAGE', targetTable: 'chat_messages', targetId: message.id, details: { room_type: room.roomType, barangay_id: room.barangayId, attachment_count: attachments.length } });
    return res.status(201).json({ ok: true, message: serializeMessages([populated], req.user.id)[0] });
  } catch (error) { console.error('sendMessage error', error); return res.status(500).json({ error: 'internal' }); }
}

async function toggleReaction(req, res) {
  try {
    const message = await ChatMessage.findByPk(req.params.messageId);
    const emoji = String(req.body.emoji || '').trim();
    if (!message) return res.status(404).json({ error: 'message_not_found' });
    if (!ALLOWED_EMOJIS.includes(emoji)) return res.status(400).json({ error: 'invalid_reaction' });
    if (!await canAccessMessage(req.user, message)) return res.status(403).json({ error: 'forbidden' });
    const existing = await ChatReaction.findOne({ where: { message_id: message.id, user_id: req.user.id, emoji } });
    if (existing) {
      await existing.destroy();
    } else {
      await ChatReaction.create({ message_id: message.id, user_id: req.user.id, emoji });
    }
    const updatedReactions = await ChatReaction.findAll({
      where: { message_id: message.id },
      attributes: ['id', 'user_id', 'emoji'],
      include: [{ model: User, as: 'user', attributes: ['id', 'display_name', 'email'] }],
    });
    return res.json({
      ok: true,
      reacted: !existing,
      reactions: updatedReactions.map((r) => {
        const item = r.toJSON ? r.toJSON() : r;
        item.is_mine = Number(item.user_id) === Number(req.user.id);
        return item;
      }),
    });
  } catch (error) { console.error('toggleReaction error', error); return res.status(500).json({ error: 'internal' }); }
}

async function updateMessage(req, res) {
  try {
    const messageId = Number(req.params.messageId);
    const body = String(req.body.body || '').trim();
    if (!Number.isInteger(messageId) || messageId < 1) return res.status(400).json({ error: 'invalid_message' });
    if (!body || body.length > 2000) return res.status(400).json({ error: 'message_body_required' });

    const message = await ChatMessage.findByPk(messageId);
    if (!message) return res.status(404).json({ error: 'message_not_found' });
    if (!await canAccessMessage(req.user, message)) return res.status(403).json({ error: 'forbidden' });

    const isOwner = Number(message.sender_id) === Number(req.user.id);
    const canModerate = [ROLES.ADMINISTRATOR, ROLES.MUNICIPAL_ACCOUNTANT].includes(req.user.role);
    if (!isOwner && !canModerate) return res.status(403).json({ error: 'forbidden' });

    await message.update({ body });
    const populated = await ChatMessage.findByPk(message.id, { include: messageInclude });
    if (req.logAction) await req.logAction({ userId: req.user.id, action: 'EDIT_CHAT_MESSAGE', targetTable: 'chat_messages', targetId: message.id, details: {} });
    return res.json({ ok: true, message: serializeMessages([populated], req.user.id)[0] });
  } catch (error) { console.error('updateMessage error', error); return res.status(500).json({ error: 'internal' }); }
}

async function deleteMessage(req, res) {
  try {
    const messageId = Number(req.params.messageId);
    if (!Number.isInteger(messageId) || messageId < 1) return res.status(400).json({ error: 'invalid_message' });
    const message = await ChatMessage.findByPk(messageId);
    if (!message) return res.status(404).json({ error: 'message_not_found' });
    if (!await canAccessMessage(req.user, message)) return res.status(403).json({ error: 'forbidden' });

    const isOwner = Number(message.sender_id) === Number(req.user.id);
    const canModerate = [ROLES.ADMINISTRATOR, ROLES.MUNICIPAL_ACCOUNTANT].includes(req.user.role);
    if (!isOwner && !canModerate) return res.status(403).json({ error: 'forbidden' });

    await message.destroy();
    if (req.logAction) await req.logAction({ userId: req.user.id, action: 'DELETE_CHAT_MESSAGE', targetTable: 'chat_messages', targetId: message.id, details: {} });
    return res.json({ ok: true });
  } catch (error) { console.error('deleteMessage error', error); return res.status(500).json({ error: 'internal' }); }
}

module.exports = { CHAT_ROLES, ALLOWED_EMOJIS, listRooms, listMessages, sendMessage, toggleReaction, updateMessage, deleteMessage, uploadChatAttachment };

