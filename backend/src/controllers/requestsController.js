const crypto = require('crypto');
const { ProcurementRequest, ProcurementDocument, User, BarangayBudget, Notification } = require('../models');
const { Op } = require('sequelize');

async function notifyPurchaseRequestApprovers(request, requester) {
  const recipients = await User.findAll({
    where: {
      status: 'active',
      [Op.or]: [
        { role: 'Administrator' },
        { role: 'FinanceManager', barangay_id: request.barangay_id },
      ],
    },
    attributes: ['id'],
  });
  const notifications = recipients
    .filter((recipient) => Number(recipient.id) !== Number(request.created_by))
    .map((recipient) => ({
      recipient_id: recipient.id,
      title: 'New purchase request',
      message: `${requester.display_name || requester.email || 'A staff member'} submitted ${request.title}.`,
      link: `/procurement/approval-inbox?requestId=${request.id}`,
    }));
  if (notifications.length) await Notification.bulkCreate(notifications);
}

async function listRequests(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;
    const where = {};

    if (role === 'BarangayStaff') {
      where.created_by = userId;
    } else if (role === 'FinanceManager') {
      if (!req.user?.barangay_id) return res.status(400).json({ error: 'finance_manager_barangay_required' });
      where.barangay_id = req.user.barangay_id;
    }

    const requests = await ProcurementRequest.findAll({
      where,
      include: [
        { model: ProcurementDocument, as: 'documents' },
        { model: User, as: 'creator' },
      ],
      order: [['created_at', 'DESC']],
    });

    const payload = requests.map((request) => {
      const uploadedCount = request.documents?.filter((doc) => doc.is_uploaded).length || 0;
      return {
        id: request.id,
        request_uuid: request.request_uuid,
        title: request.title,
        description: request.description,
        amount: request.amount,
        status: request.status,
        barangay_id: request.barangay_id,
        created_by: request.created_by,
        created_at: request.created_at,
        updated_at: request.updated_at,
        documentCount: request.documents?.length || 0,
        uploadedCount,
        compliant: uploadedCount >= 12,
        creator: {
          id: request.creator?.id,
          display_name: request.creator?.display_name || request.creator?.email || "Unknown",
        },
      };
    });

    return res.json({ ok: true, requests: payload });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

async function createRequest(req, res) {
  try {
    const { title, description, amount, barangay_id } = req.body;
    const createdBy = req.user?.id;
    if (!createdBy) return res.status(401).json({ error: 'unauthenticated' });
    if (!title || !amount) return res.status(400).json({ error: 'title and amount are required' });

    const requestUuid = crypto.randomUUID();
    const isBarangayScopedUser = ['FinanceManager', 'BarangayStaff'].includes(req.user.role);
    const assignedBarangayId = isBarangayScopedUser ? req.user.barangay_id : barangay_id || req.user.barangay_id || null;
    if (isBarangayScopedUser && !assignedBarangayId) {
      return res.status(400).json({ error: 'user_barangay_required' });
    }
    if (req.user.role === 'FinanceManager') {
      const budget = await BarangayBudget.findOne({
        where: { barangay_id: assignedBarangayId, fiscal_year: new Date().getFullYear() },
      });
      if (!budget) return res.status(400).json({ error: 'barangay_budget_not_set' });

      const committed = Number(await ProcurementRequest.sum('amount', {
        where: { barangay_id: assignedBarangayId, status: { [Op.ne]: 'Rejected' } },
      }) || 0);
      if (committed + Number(amount) > Number(budget.amount)) {
        return res.status(400).json({ error: 'insufficient_barangay_budget' });
      }
    }
    const request = await ProcurementRequest.create({
      request_uuid: requestUuid,
      title,
      description: description || '',
      amount,
      barangay_id: assignedBarangayId,
      created_by: createdBy,
      status: 'Pending',
    });

    try {
      const requester = await User.findByPk(createdBy, { attributes: ['id', 'display_name', 'email'] });
      await notifyPurchaseRequestApprovers(request, requester || {});
    } catch (notificationError) {
      console.error('Failed to create purchase-request notifications', notificationError);
    }

    if (req.logAction) {
      await req.logAction({
        userId: createdBy,
        action: 'CREATE_REQUEST',
        targetTable: 'procurement_requests',
        targetId: request.id,
        details: { title, amount, barangay_id: assignedBarangayId },
      });
    }

    return res.status(201).json({ ok: true, request });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

async function getRequest(req, res) {
  const { requestId } = req.params;
  if (!requestId) return res.status(400).json({ error: 'missing request id' });

  try {
    const request = await ProcurementRequest.findByPk(requestId, {
      include: [{ model: ProcurementDocument, as: 'documents' }],
    });
    if (!request) return res.status(404).json({ error: 'not_found' });
    if (req.user?.role === 'FinanceManager' && Number(request.barangay_id) !== Number(req.user.barangay_id)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    return res.json({
      ok: true,
      request: {
        id: request.id,
        request_uuid: request.request_uuid,
        title: request.title,
        description: request.description,
        amount: request.amount,
        status: request.status,
        barangay_id: request.barangay_id,
        created_by: request.created_by,
        created_at: request.created_at,
        updated_at: request.updated_at,
        documents: request.documents || [],
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

module.exports = { listRequests, getRequest, createRequest };
