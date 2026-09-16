const fs = require('fs');
const path = require('path');
const { Barangay, User, ProcurementRequest, ProcurementDocument, Approval, AuditLog, BarangayBudget, UserBarangayAssignment, sequelize } = require('../models');
const { Op } = require('sequelize');
const { admin } = require('../services/firebaseAdmin');
const { storeUpload } = require('../services/uploads');

const uploadDir = path.join(process.cwd(), 'uploads', 'barangays');
fs.mkdirSync(uploadDir, { recursive: true });

const { VALID_ROLES, ROLES } = require('../constants/roles');
const { assertRoleCapacity } = require('../services/roleCapacity');
const VALID_STATUSES = ['active', 'pending', 'rejected'];

async function listBarangays(req, res) {
  try {
    const barangays = await Barangay.findAll({
      order: [['name', 'ASC']],
    });

    return res.json({
      ok: true,
      barangays: barangays.map((barangay) => ({
        id: barangay.id,
        name: barangay.name,
        seal_url: barangay.seal_url,
      })),
    });
  } catch (error) {
    console.error('listBarangays error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function createBarangay(req, res) {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'barangay_name_required' });
    }

    const normalizedName = String(name).trim();
    let sealUrl = null;
    if (req.file) {
      sealUrl = `/${await storeUpload(req.file, 'uploads/barangays')}`;
    }

    const barangay = await Barangay.create({
      name: normalizedName,
      seal_url: sealUrl,
    });

    return res.status(201).json({
      ok: true,
      barangay: {
        id: barangay.id,
        name: barangay.name,
        seal_url: barangay.seal_url,
      },
    });
  } catch (error) {
    console.error('createBarangay error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function listMyAssignedBarangays(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    const canViewAll = [ROLES.MUNICIPAL_ACCOUNTANT, ROLES.ADMINISTRATOR].includes(req.user.role);
    if (!canViewAll && req.user.role !== ROLES.BARANGAY_BOOKKEEPER) return res.status(403).json({ error: 'forbidden' });

    if (canViewAll) {
      const barangays = await Barangay.findAll({
        include: [{
          association: 'assignedBookkeepers',
          attributes: ['id', 'display_name', 'email', 'status'],
          through: { attributes: [] },
          where: { role: ROLES.BARANGAY_BOOKKEEPER },
          required: false,
        }],
        order: [['name', 'ASC']],
      });
      return res.json({ ok: true, scope: 'municipality', barangays });
    }

    const user = await User.findByPk(req.user.id, {
      include: [{ association: 'assignedBarangays', attributes: ['id', 'name', 'seal_url'], through: { attributes: [] } }],
    });
    return res.json({ ok: true, scope: 'assigned', barangays: user?.assignedBarangays || [] });
  } catch (error) {
    console.error('listMyAssignedBarangays error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function getBarangayManagementDetails(req, res) {
  try {
    const barangayId = Number(req.params.id);
    if (!Number.isInteger(barangayId) || barangayId < 1) return res.status(400).json({ error: 'invalid_barangay' });
    const canViewAll = [ROLES.MUNICIPAL_ACCOUNTANT, ROLES.ADMINISTRATOR].includes(req.user?.role);
    if (!canViewAll && req.user?.role !== ROLES.BARANGAY_BOOKKEEPER) return res.status(403).json({ error: 'forbidden' });
    if (!canViewAll) {
      const assignment = await UserBarangayAssignment.findOne({ where: { user_id: req.user.id, barangay_id: barangayId } });
      if (!assignment) return res.status(403).json({ error: 'forbidden' });
    }

    const barangay = await Barangay.findByPk(barangayId, {
      include: [{
        association: 'assignedBookkeepers',
        attributes: ['id', 'display_name', 'email', 'status'],
        through: { attributes: [] },
        where: { role: ROLES.BARANGAY_BOOKKEEPER },
        required: false,
      }],
    });
    if (!barangay) return res.status(404).json({ error: 'barangay_not_found' });

    const [members, transactions] = await Promise.all([
      User.findAll({
        where: { barangay_id: barangayId },
        attributes: ['id', 'display_name', 'email', 'role', 'status'],
        order: [['display_name', 'ASC']],
      }),
      ProcurementRequest.findAll({
        where: { barangay_id: barangayId },
        include: [{ model: User, as: 'creator', attributes: ['id', 'display_name', 'email'] }],
        attributes: ['id', 'request_uuid', 'title', 'amount', 'status', 'created_at', 'updated_at'],
        order: [['updated_at', 'DESC']],
        limit: 10,
      }),
    ]);
    const requestIds = transactions.map((transaction) => transaction.id);
    const activity = requestIds.length
      ? await AuditLog.findAll({
        where: { target_table: 'procurement_requests', target_id: { [Op.in]: requestIds } },
        include: [{ model: User, as: 'user', attributes: ['id', 'display_name', 'email'] }],
        attributes: ['id', 'timestamp', 'action', 'target_id', 'details'],
        order: [['timestamp', 'DESC']],
        limit: 15,
      })
      : [];

    return res.json({
      ok: true,
      barangay: { id: barangay.id, name: barangay.name, seal_url: barangay.seal_url },
      bookkeepers: barangay.assignedBookkeepers || [],
      members,
      transactions,
      activity,
    });
  } catch (error) {
    console.error('getBarangayManagementDetails error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function getBarangayDashboard(req, res) {
  try {
    const barangayId = Number(req.params.id);
    if (!Number.isInteger(barangayId) || barangayId < 1) return res.status(400).json({ error: 'invalid_barangay' });
    const canViewAll = [ROLES.MUNICIPAL_ACCOUNTANT, ROLES.ADMINISTRATOR].includes(req.user?.role);
    if (!canViewAll && req.user?.role !== ROLES.BARANGAY_BOOKKEEPER) return res.status(403).json({ error: 'forbidden' });
    if (!canViewAll && !(await UserBarangayAssignment.findOne({ where: { user_id: req.user.id, barangay_id: barangayId } }))) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const fiscalYear = Number(req.query.fiscal_year) || new Date().getFullYear();
    const [barangay, budget, requests] = await Promise.all([
      Barangay.findByPk(barangayId),
      BarangayBudget.findOne({ where: { barangay_id: barangayId, fiscal_year: fiscalYear } }),
      ProcurementRequest.findAll({
        where: { barangay_id: barangayId },
        include: [
          { model: User, as: 'creator', attributes: ['id', 'display_name', 'email'] },
          { model: ProcurementDocument, as: 'documents', attributes: ['id', 'doc_type', 'is_uploaded', 'file_path', 'uploaded_at'] },
        ],
        attributes: ['id', 'request_uuid', 'title', 'description', 'amount', 'status', 'created_at', 'updated_at'],
        order: [['updated_at', 'DESC']],
      }),
    ]);
    if (!barangay) return res.status(404).json({ error: 'barangay_not_found' });

    const transactions = requests.map((request) => request.toJSON());
    const activeTransactions = transactions.filter((transaction) => transaction.status !== 'Rejected');
    const obligated = activeTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const allocation = Number(budget?.amount || 0);
    const documents = transactions.flatMap((transaction) => (transaction.documents || []).filter((document) => document.is_uploaded).map((document) => ({ ...document, request_id: transaction.id, request_uuid: transaction.request_uuid, request_title: transaction.title })));
    const approvedForLiquidation = transactions.filter((transaction) => transaction.status === 'Approved').reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const liquidated = transactions.filter((transaction) => transaction.status === 'Disbursed').reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return res.json({
      ok: true,
      barangay: { id: barangay.id, name: barangay.name, seal_url: barangay.seal_url },
      fiscalYear,
      budget: { allocation, obligated, remaining: Math.max(0, allocation - obligated), utilization: allocation ? (obligated / allocation) * 100 : 0 },
      analytics: {
        transactionCount: transactions.length,
        pendingCount: transactions.filter((transaction) => transaction.status === 'Pending').length,
        approvedCount: transactions.filter((transaction) => transaction.status === 'Approved').length,
        disbursedCount: transactions.filter((transaction) => transaction.status === 'Disbursed').length,
        documentCount: documents.length,
      },
      liquidation: { awaiting: approvedForLiquidation, liquidated, outstanding: Math.max(0, approvedForLiquidation - liquidated) },
      transactions,
      documents,
    });
  } catch (error) {
    console.error('getBarangayDashboard error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function updateBarangay(req, res) {
  try {
    const barangay = await Barangay.findByPk(req.params.id);
    if (!barangay) return res.status(404).json({ error: 'barangay_not_found' });

    const normalizedName = String(req.body.name || '').trim();
    if (!normalizedName) return res.status(400).json({ error: 'barangay_name_required' });

    const duplicate = await Barangay.findOne({ where: { name: normalizedName } });
    if (duplicate && duplicate.id !== barangay.id) {
      return res.status(409).json({ error: 'barangay_name_already_exists' });
    }

    barangay.name = normalizedName;
    if (req.file) barangay.seal_url = `/${await storeUpload(req.file, 'uploads/barangays')}`;
    await barangay.save();

    return res.json({ ok: true, barangay: { id: barangay.id, name: barangay.name, seal_url: barangay.seal_url } });
  } catch (error) {
    console.error('updateBarangay error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function deleteBarangay(req, res) {
  try {
    const barangay = await Barangay.findByPk(req.params.id);
    if (!barangay) return res.status(404).json({ error: 'barangay_not_found' });

    const [userCount, requestCount] = await Promise.all([
      User.count({ where: { barangay_id: barangay.id } }),
      ProcurementRequest.count({ where: { barangay_id: barangay.id } }),
    ]);
    if (userCount || requestCount) {
      return res.status(409).json({
        error: 'barangay_in_use',
        message: 'This barangay cannot be deleted because it is assigned to users or procurement requests.',
      });
    }

    await barangay.destroy();
    return res.json({ ok: true });
  } catch (error) {
    console.error('deleteBarangay error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function listPendingUsers(req, res) {
  try {
    const users = await User.findAll({
      where: { status: 'pending' },
      include: [{ association: 'barangay' }],
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      ok: true,
      users: users.map((user) => ({
        id: user.id,
        firebase_uid: user.firebase_uid,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        pending_role: user.pending_role || user.role,
        barangay_id: user.barangay_id,
        barangay_name: user.barangay ? user.barangay.name : null,
        status: user.status,
      })),
    });
  } catch (error) {
    console.error('listPendingUsers error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function listUsers(req, res) {
  try {
    const users = await User.findAll({
      include: [
        { association: 'barangay', attributes: ['id', 'name'] },
        { association: 'assignedBarangays', attributes: ['id', 'name'], through: { attributes: [] } },
      ],
      order: [['display_name', 'ASC']],
    });
    return res.json({
      ok: true,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        status: user.status,
        barangay_id: user.barangay_id,
        barangay_name: user.barangay ? user.barangay.name : null,
        assigned_barangays: (user.assignedBarangays || []).map((barangay) => ({ id: barangay.id, name: barangay.name })),
      })),
    });
  } catch (error) {
    console.error('listUsers error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function updateManagedUser(req, res) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const { display_name, role, status, barangay_id, barangay_ids } = req.body;
    const normalizedRole = typeof role === 'string' ? role.trim() : role;
    if (!VALID_ROLES.includes(normalizedRole)) return res.status(400).json({ error: 'invalid_role' });
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid_status' });
    if (user.id === req.user.id && (normalizedRole !== user.role || status !== user.status)) {
      return res.status(400).json({ error: 'cannot_change_own_access', message: 'You cannot change your own role or account status.' });
    }

    const barangayId = barangay_id === null || barangay_id === '' || barangay_id === undefined ? null : Number(barangay_id);
    if (barangayId && (!Number.isInteger(barangayId) || !(await Barangay.findByPk(barangayId)))) {
      return res.status(400).json({ error: 'invalid_barangay' });
    }

    const assignmentIds = Array.isArray(barangay_ids) ? [...new Set(barangay_ids.map(Number))] : [];
    if (normalizedRole === ROLES.BARANGAY_BOOKKEEPER && assignmentIds.length > 5) {
      return res.status(400).json({ error: 'bookkeeper_barangay_limit', message: 'A Barangay Bookkeeper can handle no more than five barangays.' });
    }
    if (normalizedRole !== ROLES.BARANGAY_BOOKKEEPER && assignmentIds.length) {
      return res.status(400).json({ error: 'invalid_barangay_assignments' });
    }
    if (assignmentIds.some((id) => !Number.isInteger(id) || id < 1)) return res.status(400).json({ error: 'invalid_barangay' });
    if (assignmentIds.length && (await Barangay.count({ where: { id: assignmentIds } })) !== assignmentIds.length) {
      return res.status(400).json({ error: 'invalid_barangay' });
    }
    if (normalizedRole === ROLES.BARANGAY_BOOKKEEPER && !assignmentIds.length) {
      return res.status(400).json({ error: 'barangay_required_for_role' });
    }
    const municipalityWideRoles = new Set([ROLES.MUNICIPAL_ACCOUNTANT, ROLES.SK_BOOKKEEPER]);
    const primaryBarangayId = normalizedRole === ROLES.BARANGAY_BOOKKEEPER
      ? assignmentIds[0]
      : municipalityWideRoles.has(normalizedRole)
        ? null
        : barangayId;

    await sequelize.transaction(async (transaction) => {
      await assertRoleCapacity({ role: normalizedRole, barangayId: primaryBarangayId, status, excludeUserId: user.id, transaction });
      user.display_name = String(display_name || '').trim() || user.display_name;
      user.role = normalizedRole;
      user.status = status;
      user.barangay_id = primaryBarangayId;
      user.pending_role = status === 'pending' ? normalizedRole : null;
      await user.save({ transaction });
      await UserBarangayAssignment.destroy({ where: { user_id: user.id }, transaction });
      if (normalizedRole === ROLES.BARANGAY_BOOKKEEPER && assignmentIds.length) {
        await UserBarangayAssignment.bulkCreate(assignmentIds.map((id) => ({ user_id: user.id, barangay_id: id })), { transaction });
      }
    });

    return res.json({ ok: true, user: { id: user.id, display_name: user.display_name, role: user.role, status: user.status, barangay_id: user.barangay_id } });
  } catch (error) {
    console.error('updateManagedUser error', error);
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message, details: error.details });
    if (error.original?.sqlMessage === 'role_capacity_reached') return res.status(409).json({ error: 'role_capacity_reached' });
    return res.status(500).json({ error: 'internal' });
  }
}

async function deleteManagedUser(req, res) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'cannot_delete_self', message: 'You cannot delete your own account.' });
    }

    const [requestCount, approvalCount] = await Promise.all([
      ProcurementRequest.count({ where: { created_by: user.id } }),
      Approval.count({ where: { approved_by: user.id } }),
    ]);
    if (requestCount || approvalCount) {
      return res.status(409).json({
        error: 'user_has_records',
        message: 'This user cannot be deleted because they have procurement requests or approvals on record. Block the account instead.',
      });
    }

    if (user.firebase_uid) {
      if (!admin.apps.length) {
        return res.status(503).json({ error: 'firebase_unavailable', message: 'Firebase Admin is not available to remove this account safely.' });
      }
      try {
        await admin.auth().deleteUser(user.firebase_uid);
      } catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
      }
    }

    await user.destroy();
    return res.json({ ok: true });
  } catch (error) {
    console.error('deleteManagedUser error', error);
    return res.status(500).json({ error: 'internal' });
  }
}

async function updateUserApproval(req, res, approved) {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'user_id_required' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    if (approved) {
      await assertRoleCapacity({ role: user.role, barangayId: user.barangay_id, status: 'active', excludeUserId: user.id });
      user.status = 'active';
      user.pending_role = null;
    } else {
      user.status = 'rejected';
      user.pending_role = null;
    }

    await user.save();

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('updateUserApproval error', error);
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message, details: error.details });
    if (error.original?.sqlMessage === 'role_capacity_reached') return res.status(409).json({ error: 'role_capacity_reached' });
    return res.status(500).json({ error: 'internal' });
  }
}

async function approveUserRegistration(req, res) {
  return updateUserApproval(req, res, true);
}

async function rejectUserRegistration(req, res) {
  return updateUserApproval(req, res, false);
}

module.exports = {
  listBarangays,
  listMyAssignedBarangays,
  getBarangayManagementDetails,
  getBarangayDashboard,
  createBarangay,
  updateBarangay,
  deleteBarangay,
  listPendingUsers,
  listUsers,
  updateManagedUser,
  deleteManagedUser,
  approveUserRegistration,
  rejectUserRegistration,
};
