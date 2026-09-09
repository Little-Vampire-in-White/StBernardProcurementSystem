const { verifyIdToken } = require('../services/firebaseAdmin');
const { User, AuditLog } = require('../models');
const { Op, fn, col, where } = require('sequelize');

const findUserByIdentity = async (firebaseUid, email) => {
  const userByUid = await User.findOne({ where: { firebase_uid: firebaseUid } });
  if (userByUid || !email) return userByUid;

  // Google does not guarantee the original email casing. Match it
  // case-insensitively so an already-approved account is not provisioned as
  // a new pending user when it signs in with Google.
  return User.findOne({
    where: where(fn('LOWER', col('email')), String(email).toLowerCase()),
  });
};

// Attaches `req.user` when Authorization: Bearer <idToken> is present.
// If token invalid, responds 401.
module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return next(); // proceed without user attached

  const idToken = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  if (!idToken) return next();

  try {
    const decoded = await verifyIdToken(idToken);
    const firebaseUid = decoded.uid;
    const email = decoded.email || null;
    const displayName = decoded.name || decoded.displayName || null;

    let user = await findUserByIdentity(firebaseUid, email);
    if (user && user.firebase_uid !== firebaseUid) {
      user.firebase_uid = firebaseUid;
      await user.save();
    }

    if (!user) {
      // Create an unapproved placeholder. The onboarding request supplies the
      // actual role and barangay before it can receive access.
      user = await User.create({ firebase_uid: firebaseUid, email, display_name: displayName, role: 'BarangayTreasurer', status: 'rejected' });
    }

    // Let the client read its own profile so it can display the pending/rejected
    // state. All other authenticated endpoints remain blocked below.
    const isOwnProfileRequest = req.method === 'GET' && req.path === '/api/auth/me';
    const isRegistrationRequest = req.method === 'POST' && req.path === '/api/auth/register';
    if (user.status && user.status !== 'active' && !isOwnProfileRequest && !isRegistrationRequest) {
      return res.status(403).json({ error: 'account_pending_approval', status: user.status, role: user.role, barangay_id: user.barangay_id });
    }

    req.user = {
      id: user.id,
      firebase_uid: user.firebase_uid,
      email: user.email,
      role: user.role,
      display_name: user.display_name,
      barangay_id: user.barangay_id,
      status: user.status,
    };
    try {
      if (req.logAction) {
        // Avoid noisy duplicates: skip USER_LOGIN if one was recorded recently (30s)
        const recent = await AuditLog.findOne({
          where: {
            user_id: user.id,
            action: 'USER_LOGIN',
            timestamp: { [Op.gte]: new Date(Date.now() - 30 * 1000) },
          },
        });

        if (!recent) {
          await req.logAction({
            userId: user.id,
            action: 'USER_LOGIN',
            targetTable: 'users',
            targetId: user.id,
            details: { firebase_uid: firebaseUid, email },
          });
        }
      }
    } catch (err) {
      console.warn('authMiddleware: failed to record login audit', err && err.message);
    }

    next();
  } catch (err) {
    console.warn('authMiddleware: token verification failed', err && err.message);
    return res.status(401).json({ error: 'invalid_token' });
  }
};
