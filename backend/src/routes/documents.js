const express = require('express');
const router = express.Router();
const { upload, uploadDocument, listDocuments } = require('../controllers/documentsController');
const requireRoles = require('../middleware/roleMiddleware');

// allowed: Administrator, FinanceManager, BarangayStaff (uploader)
router.post('/upload', requireRoles(['Administrator','FinanceManager','BarangayStaff']), upload.single('file'), uploadDocument);

// list documents for a request (read access allowed to all authenticated roles incl. Auditor)
router.get('/list/:requestId', requireRoles(['Administrator','FinanceManager','BarangayStaff','Auditor']), listDocuments);

module.exports = router;
