const { User, Barangay } = require('../models');
const { fn, col, where } = require('sequelize');
const { storeUpload } = require('../services/uploads');
const { VALID_ROLES, ROLES } = require('../constants/roles');
const { assertRoleCapacity } = require('../services/roleCapacity');

async function getCurrentUserProfile(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthenticated' });
  }

  const user = await User.findOne({
    where: { id: req.user.id },
    include: [{ model: Barangay, as: 'barangay', attributes: ['id', 'name', 'seal_url'] }],
  });
  if (!user) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  return res.json({
    ok: true,
    profile: {
      id: user.id,
      firebase_uid: user.firebase_uid,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      barangay_id: user.barangay_id,
      barangay_name: user.barangay ? user.barangay.name : null,
      barangay_seal_url: user.barangay ? user.barangay.seal_url : null,
      status: user.status,
      pending_role: user.pending_role,
      profile_image_url: user.profile_image_url || null,
    },
  });
}

async function uploadAvatar(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    if (!req.file) {
      return res.status(400).json({ error: 'file_required' });
    }

    const url = `/${await storeUpload(req.file, 'uploads/users')}`;
    user.profile_image_url = url;
    await user.save();

    return res.json({ ok: true, profile_image_url: url });
  } catch (err) {
    console.error('uploadAvatar error', err);
    return res.status(500).json({ error: 'internal' });
  }
}


async function registerUserProfile(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthenticated' });
  }

  const { display_name, role, barangay_id, profile_image_url } = req.body;
  const firebaseUid = req.user.firebase_uid;
  const email = req.user.email;

  if (!firebaseUid || !email) {
    return res.status(400).json({ error: 'missing_user_identity' });
  }

  const requestedRole = typeof role === 'string' ? role.trim() : role;
  const normalizedRole = VALID_ROLES.includes(requestedRole) ? requestedRole : ROLES.BARANGAY_TREASURER;
  // Privileged staff roles must be approved; users cannot self-assign access.
  const requiresApproval = normalizedRole !== ROLES.ADMINISTRATOR;

  let user = await User.findOne({ where: { firebase_uid: firebaseUid } });
  if (!user) {
    user = await User.findOne({
      where: where(fn('LOWER', col('email')), String(email).toLowerCase()),
    });
  }

  if (user) {
    // Registration is only for accounts without a completed profile. Never
    // turn an approved account back into a pending request if a stale client
    // attempts to submit the Google onboarding dialog.
    if (user.status === 'active') {
      return res.json({
        ok: true,
        profile: {
          id: user.id,
          firebase_uid: user.firebase_uid,
          email: user.email,
          display_name: user.display_name,
          role: user.role,
          barangay_id: user.barangay_id,
          status: user.status,
        },
      });
    }

    try {
      await assertRoleCapacity({
        role: normalizedRole,
        barangayId: barangay_id ? Number(barangay_id) : null,
        status: requiresApproval ? 'pending' : 'active',
        excludeUserId: user.id,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message, details: error.details });
    }
    user.firebase_uid = firebaseUid;
    user.email = email;
    user.display_name = display_name || user.display_name || email;
    user.role = normalizedRole || user.role;
    if (barangay_id !== undefined) {
      user.barangay_id = [ROLES.MUNICIPAL_ACCOUNTANT, ROLES.SK_BOOKKEEPER].includes(normalizedRole) ? null : barangay_id || null;
    }
    if (profile_image_url !== undefined) {
      user.profile_image_url = profile_image_url || null;
    }
    user.status = requiresApproval ? 'pending' : 'active';
    user.pending_role = requiresApproval ? normalizedRole : null;
    await user.save();
  } else {
    try {
      await assertRoleCapacity({
        role: normalizedRole,
        barangayId: barangay_id ? Number(barangay_id) : null,
        status: requiresApproval ? 'pending' : 'active',
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message, details: error.details });
    }
    user = await User.create({
      firebase_uid: firebaseUid,
      email,
      display_name: display_name || email,
      role: normalizedRole,
      barangay_id: [ROLES.MUNICIPAL_ACCOUNTANT, ROLES.SK_BOOKKEEPER].includes(normalizedRole) ? null : barangay_id || null,
      profile_image_url: profile_image_url || null,
      status: requiresApproval ? 'pending' : 'active',
      pending_role: requiresApproval ? normalizedRole : null,
    });
  }

  return res.json({
    ok: true,
    profile: {
      id: user.id,
      firebase_uid: user.firebase_uid,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      barangay_id: user.barangay_id,
      status: user.status,
    },
  });
}

async function logoutUser(req, res) {
  try {
    const userId = req.user?.id || null;
    if (req.logAction) {
      await req.logAction({
        userId,
        action: 'USER_LOGOUT',
        targetTable: 'users',
        targetId: userId,
        details: { note: 'User signed out' },
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('logoutUser error', err);
    return res.status(500).json({ error: 'internal' });
  }
}

async function recordFailedLogin(req, res) {
  try {
    const { email, reason } = req.body || {};
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (req.logAction) {
      await req.logAction({
        userId: null,
        action: 'LOGIN_FAILED',
        targetTable: 'auth',
        targetId: null,
        details: { email: email || null, reason: reason || null, ip },
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('recordFailedLogin error', err);
    return res.status(500).json({ error: 'internal' });
  }
}

module.exports = {
  getCurrentUserProfile,
  registerUserProfile,
  uploadAvatar,
  logoutUser,
  recordFailedLogin,
};
