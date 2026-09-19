const express = require('express');
const router = express.Router();
const { listRequests, getRequest, createRequest, listChecklistTemplates } = require('../controllers/requestsController');
const requireRoles = require('../middleware/roleMiddleware');

router.get('/', requireRoles(['Administrator','FinanceManager','BarangayStaff','BarangayTreasurer','Auditor','MunicipalAccountant','SKBookkeeper','SKChairman','SKTreasurer']), listRequests);
router.post('/', requireRoles(['Administrator','FinanceManager','BarangayStaff','BarangayTreasurer','MunicipalAccountant','SKBookkeeper','SKChairman','SKTreasurer']), createRequest);
router.get('/checklist-templates', requireRoles(['Administrator','FinanceManager','BarangayStaff','BarangayTreasurer','Auditor','MunicipalAccountant','SKBookkeeper','SKChairman','SKTreasurer']), listChecklistTemplates);
router.get('/:requestId', requireRoles(['Administrator','FinanceManager','BarangayStaff','BarangayTreasurer','Auditor','MunicipalAccountant','SKBookkeeper','SKChairman','SKTreasurer']), getRequest);

module.exports = router;
