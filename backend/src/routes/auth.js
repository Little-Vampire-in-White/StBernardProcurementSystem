const express = require('express');
const multer = require('multer');
const router = express.Router();
const { getCurrentUserProfile, registerUserProfile, logoutUser, recordFailedLogin, uploadAvatar } = require('../controllers/authController');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/me', getCurrentUserProfile);
router.post('/register', registerUserProfile);
router.post('/logout', logoutUser);
router.post('/login-failed', recordFailedLogin);
router.post('/avatar', upload.single('avatar'), uploadAvatar);

module.exports = router;
