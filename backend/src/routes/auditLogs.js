const express = require('express');
const router = express.Router();
const requireRoles = require('../middleware/roleMiddleware');
const { listAuditLogs } = require('../controllers/auditLogsController');

router.get('/', requireRoles(['Administrator', 'Auditor']), listAuditLogs);

module.exports = router;
