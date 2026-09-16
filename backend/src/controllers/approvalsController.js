const { Approval, ProcurementDocument, ProcurementRequest, sequelize } = require('../models');
const { getChecklistTemplate } = require('../services/checklistTemplates');

async function processApproval(req, res) {
  // expects: request_id, action = 'approve'|'reject', remark
  const { request_id, action, remark } = req.body;
  const approvedBy = req.user?.id;
  if (!request_id || !approvedBy) return res.status(400).json({ error: 'request_id required and user must be authenticated' });
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' });

  try {
    const request = await ProcurementRequest.findByPk(request_id);
    if (!request) return res.status(404).json({ error: 'request_not_found' });
    if (request.status !== 'Pending') return res.status(400).json({ error: 'request_is_not_pending' });
    if (req.user.role === 'FinanceManager' && Number(request.barangay_id) !== Number(req.user.barangay_id)) {
      return res.status(403).json({ error: 'finance_manager_can_only_approve_own_barangay' });
    }

    if (action === 'approve') {
      const documents = await ProcurementDocument.findAll({ where: { request_id, is_uploaded: true }, attributes: ['doc_type'] });
      const uploadedTypes = new Set(documents.map((document) => document.doc_type));
      const requirements = getChecklistTemplate(request.contract_type).requirements;
      if (!requirements.every((requirement) => uploadedTypes.has(requirement))) {
        return res.status(400).json({ error: 'checklist_incomplete', requiredCount: requirements.length });
      }
    }

    const approvalAction = action === 'approve' ? 'Approved' : 'Rejected';
    const newStatus = action === 'approve' ? 'Approved' : 'Rejected';

    const result = await sequelize.transaction(async (t) => {
      const createdApproval = await Approval.create(
        {
          request_id,
          approved_by: approvedBy,
          action: approvalAction,
          remark: remark || null,
        },
        { transaction: t }
      );

      await ProcurementRequest.update(
        { status: newStatus },
        { where: { id: request_id }, transaction: t }
      );

      return createdApproval;
    });

    if (req.logAction) {
      await req.logAction({
        userId: approvedBy,
        action: action === 'approve' ? 'APPROVE_REQUEST' : 'REJECT_REQUEST',
        targetTable: 'procurement_requests',
        targetId: request_id,
        details: { action: approvalAction, remark },
      });
    }

    return res.json({ ok: true, approval: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

module.exports = { processApproval };
