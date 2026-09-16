const express = require('express');
const router = express.Router();
const requireRoles = require('../middleware/roleMiddleware');
const { getBudgetSummary, saveBarangayBudget } = require('../controllers/budgetsController');

router.get('/', requireRoles(['Administrator', 'BudgetOfficer', 'FinanceManager', 'BarangayStaff', 'BarangayTreasurer']), getBudgetSummary);
router.post('/', requireRoles(['Administrator']), saveBarangayBudget);

module.exports = router;
