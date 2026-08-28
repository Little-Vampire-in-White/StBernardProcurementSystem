const express = require('express');
const router = express.Router();
const { listRequests, getRequest, createRequest } = require('../controllers/requestsController');
const requireRoles = require('../middleware/roleMiddleware');

router.get('/', requireRoles(['Administrator','FinanceManager','BarangayStaff','Auditor']), listRequests);
router.post('/', requireRoles(['Administrator','FinanceManager','BarangayStaff']), createRequest);
router.get('/:requestId', requireRoles(['Administrator','FinanceManager','BarangayStaff','Auditor']), getRequest);

module.exports = router;
