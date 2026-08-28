const express = require('express');
const requireRoles = require('../middleware/roleMiddleware');
const { listNotifications, markNotificationRead } = require('../controllers/notificationsController');

const router = express.Router();
const activeRoles = ['Administrator', 'FinanceManager', 'BarangayStaff', 'Auditor', 'BudgetOfficer', 'ProcurementOfficer', 'Requester', 'DepartmentHead', 'Guest'];

router.get('/', requireRoles(activeRoles), listNotifications);
router.patch('/:id/read', requireRoles(activeRoles), markNotificationRead);

module.exports = router;
