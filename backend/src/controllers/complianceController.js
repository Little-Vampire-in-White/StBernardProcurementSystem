const { ProcurementDocument } = require('../models');

async function checkCompliance(req, res) {
  const { requestId } = req.params;
  if (!requestId) return res.status(400).json({ error: 'missing request id' });
  try {
    const count = await ProcurementDocument.count({ where: { request_id: requestId, is_uploaded: true } });
    const compliant = count >= 12;
    return res.json({ requestId, compliant, uploadedCount: count });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

module.exports = { checkCompliance };
