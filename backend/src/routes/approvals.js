const express = require('express');
const router = express.Router();
const { processApproval } = require('../controllers/approvalsController');
const requireRoles = require('../middleware/roleMiddleware');

// only Administrator and FinanceManager can approve or reject
router.post('/', requireRoles(['Administrator','FinanceManager']), processApproval);

module.exports = router;
