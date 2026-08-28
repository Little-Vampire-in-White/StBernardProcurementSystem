const express = require('express');
const router = express.Router();
const { checkCompliance } = require('../controllers/complianceController');

router.get('/check/:requestId', checkCompliance);

module.exports = router;
