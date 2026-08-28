const { Notification } = require('../models');

async function listNotifications(req, res) {
  try {
    const notifications = await Notification.findAll({
      where: { recipient_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 30,
    });
    return res.json({
      ok: true,
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        is_read: notification.is_read,
        created_at: notification.createdAt || notification.created_at,
      })),
    });
  } catch (error) {
    console.error('listNotifications error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function markNotificationRead(req, res) {
  try {
    const notification = await Notification.findOne({ where: { id: req.params.id, recipient_id: req.user.id } });
    if (!notification) return res.status(404).json({ error: 'notification_not_found' });
    notification.is_read = true;
    await notification.save();
    return res.json({ ok: true });
  } catch (error) {
    console.error('markNotificationRead error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

module.exports = { listNotifications, markNotificationRead };
