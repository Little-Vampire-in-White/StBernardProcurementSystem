const express = require('express');
const multer = require('multer');
const requireRoles = require('../middleware/roleMiddleware');
const { CHAT_ROLES, listRooms, listMessages, sendMessage, toggleReaction, updateMessage, deleteMessage, uploadChatAttachment } = require('../controllers/chatController');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/rooms', requireRoles(CHAT_ROLES), listRooms);
router.get('/rooms/:roomType/:barangayId?', requireRoles(CHAT_ROLES), listMessages);
router.post('/messages/upload', requireRoles(CHAT_ROLES), upload.single('file'), uploadChatAttachment);
router.post('/messages', requireRoles(CHAT_ROLES), sendMessage);
router.post('/messages/:messageId/reactions', requireRoles(CHAT_ROLES), toggleReaction);
router.put('/messages/:messageId', requireRoles(CHAT_ROLES), updateMessage);
router.delete('/messages/:messageId', requireRoles(CHAT_ROLES), deleteMessage);
module.exports = router;
