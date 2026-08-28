const express = require('express');
const router = express.Router();
const requireRoles = require('../middleware/roleMiddleware');
const { exportRequests, exportBudgetSummary } = require('../controllers/exportsController');

router.get('/requests', requireRoles(['Administrator', 'FinanceManager', 'BudgetOfficer']), exportRequests);
router.get('/budgets', requireRoles(['Administrator', 'FinanceManager', 'BudgetOfficer']), exportBudgetSummary);

module.exports = router;
