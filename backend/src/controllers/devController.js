const { admin } = require('../services/firebaseAdmin');
const { User } = require('../models');

async function seedAdmin(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'forbidden' });
  }

  const secret = process.env.DEV_ADMIN_SECRET;
  if (secret) {
    const headerSecret = req.headers['x-dev-secret'];
    if (headerSecret !== secret) {
      return res.status(403).json({ error: 'invalid_dev_secret' });
    }
  }

  const { email, password, display_name, department } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email_and_password_required' });
  }

  if (!admin.apps.length) {
    return res.status(500).json({ error: 'firebase_admin_not_initialized' });
  }

  try {
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().createUser({
        email,
        password,
        displayName: display_name || email.split('@')[0],
      });
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        firebaseUser = await admin.auth().getUserByEmail(email);
      } else {
        throw err;
      }
    }

    let user = await User.findOne({ where: { firebase_uid: firebaseUser.uid } });
    if (!user) {
      user = await User.findOne({ where: { email } });
    }

    if (user) {
      user.firebase_uid = firebaseUser.uid;
      user.role = 'Administrator';
      user.display_name = display_name || user.display_name || firebaseUser.displayName || email;
      if (department) user.department = department;
      await user.save();
    } else {
      user = await User.create({
        firebase_uid: firebaseUser.uid,
        email,
        display_name: display_name || firebaseUser.displayName || email,
        role: 'Administrator',
        department: department || null,
      });
    }

    return res.json({
      ok: true,
      message: 'Admin account created or updated successfully.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firebase_uid: user.firebase_uid,
      },
    });
  } catch (err) {
    console.error('seedAdmin error', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
}

module.exports = { seedAdmin };
