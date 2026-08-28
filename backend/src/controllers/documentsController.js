const multer = require('multer');
const { ProcurementDocument } = require('../models');
const { storeUpload } = require('../services/uploads');

const upload = multer({ storage: multer.memoryStorage() });

// Middleware: single file field 'file'
async function uploadDocument(req, res) {
  // expects: req.body.request_id, req.body.doc_type, and file
  try {
    const { request_id, doc_type } = req.body;
    const uploadedBy = req.user?.id;
    if (!request_id || !doc_type) return res.status(400).json({ error: 'request_id and doc_type required' });
    if (!req.file) return res.status(400).json({ error: 'file required' });
    if (!uploadedBy) return res.status(401).json({ error: 'authenticated user required' });

    const filePath = await storeUpload(req.file, 'uploads/documents');

    // upsert document record
    const [doc, created] = await ProcurementDocument.findOrCreate({
      where: { request_id, doc_type },
      defaults: { request_id, doc_type, is_uploaded: true, file_path: filePath, uploaded_by: uploadedBy, uploaded_at: new Date() }
    });
    if (!created) {
      doc.is_uploaded = true;
      doc.file_path = filePath;
      doc.uploaded_by = uploadedBy;
      doc.uploaded_at = new Date();
      await doc.save();
    }

    // log audit if available
    if (req.logAction) await req.logAction({ userId: uploadedBy, action: 'UPLOAD_DOCUMENT', targetTable: 'procurement_documents', targetId: doc.id, details: { doc_type, file: filePath } });

    return res.json({ ok: true, document: doc });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

async function listDocuments(req, res) {
  const { requestId } = req.params;
  if (!requestId) return res.status(400).json({ error: 'missing request id' });
  try {
    const docs = await ProcurementDocument.findAll({ where: { request_id: requestId }, order: [['uploaded_at','ASC']] });
    return res.json({ ok: true, documents: docs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

module.exports = { upload, uploadDocument, listDocuments };
