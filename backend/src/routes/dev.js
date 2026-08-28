const express = require('express');
const router = express.Router();
const { seedAdmin } = require('../controllers/devController');

router.post('/seed-admin', seedAdmin);

module.exports = router;
