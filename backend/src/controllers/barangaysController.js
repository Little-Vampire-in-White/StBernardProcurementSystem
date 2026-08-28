const fs = require('fs');
const path = require('path');
const { Barangay, User, ProcurementRequest, Approval } = require('../models');
const { admin } = require('../services/firebaseAdmin');
const { storeUpload } = require('../services/uploads');

const uploadDir = path.join(process.cwd(), 'uploads', 'barangays');
fs.mkdirSync(uploadDir, { recursive: true });

const VALID_ROLES = ['Administrator', 'FinanceManager', 'BarangayStaff', 'Auditor', 'BudgetOfficer', 'ProcurementOfficer', 'Requester', 'DepartmentHead', 'Guest'];
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
        department: user.department,
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
      include: [{ association: 'barangay', attributes: ['id', 'name'] }],
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
        department: user.department,
        barangay_id: user.barangay_id,
        barangay_name: user.barangay ? user.barangay.name : null,
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

    const { display_name, role, status, barangay_id, department } = req.body;
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'invalid_role' });
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid_status' });
    if (user.id === req.user.id && (role !== user.role || status !== user.status)) {
      return res.status(400).json({ error: 'cannot_change_own_access', message: 'You cannot change your own role or account status.' });
    }

    const barangayId = barangay_id === null || barangay_id === '' || barangay_id === undefined ? null : Number(barangay_id);
    if (barangayId && (!Number.isInteger(barangayId) || !(await Barangay.findByPk(barangayId)))) {
      return res.status(400).json({ error: 'invalid_barangay' });
    }

    user.display_name = String(display_name || '').trim() || user.display_name;
    user.role = role;
    user.status = status;
    user.barangay_id = barangayId;
    user.department = String(department || '').trim() || null;
    user.pending_role = status === 'pending' ? role : null;
    await user.save();

    return res.json({ ok: true, user: { id: user.id, display_name: user.display_name, role: user.role, status: user.status, barangay_id: user.barangay_id } });
  } catch (error) {
    console.error('updateManagedUser error', error);
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
