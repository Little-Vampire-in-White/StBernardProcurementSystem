const express = require('express');
const router = express.Router();
const { listRequests, getRequest, createRequest, listChecklistTemplates } = require('../controllers/requestsController');
const requireRoles = require('../middleware/roleMiddleware');

router.get('/', requireRoles(['Administrator','FinanceManager','BarangayStaff','BarangayTreasurer','Auditor']), listRequests);
router.post('/', requireRoles(['Administrator','FinanceManager','BarangayStaff','BarangayTreasurer']), createRequest);
router.get('/checklist-templates', requireRoles(['Administrator','FinanceManager','BarangayStaff','BarangayTreasurer','Auditor']), listChecklistTemplates);
router.get('/:requestId', requireRoles(['Administrator','FinanceManager','BarangayStaff','BarangayTreasurer','Auditor']), getRequest);

module.exports = router;
