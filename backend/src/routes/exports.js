const express = require('express');
const router = express.Router();
const requireRoles = require('../middleware/roleMiddleware');
const { exportRequests, exportBudgetSummary } = require('../controllers/exportsController');

router.get('/requests', requireRoles(['Administrator', 'FinanceManager', 'BudgetOfficer', 'BarangayTreasurer']), exportRequests);
router.get('/budgets', requireRoles(['Administrator', 'FinanceManager', 'BudgetOfficer', 'BarangayTreasurer']), exportBudgetSummary);

module.exports = router;
