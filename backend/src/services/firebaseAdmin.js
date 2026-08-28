const admin = require('firebase-admin');
const path = require('path');

// Accept credentials via either a base64-encoded JSON in env or a file path
const credentialEnv = process.env.FIREBASE_ADMIN_SDK_JSON; // base64 or raw JSON
const credentialPath = process.env.FIREBASE_ADMIN_SDK_PATH;
let serviceAccount = null;

if (credentialEnv) {
  try {
    // try parse as base64
    const decoded = Buffer.from(credentialEnv, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decoded);
  } catch (err) {
    try {
      serviceAccount = JSON.parse(credentialEnv);
    } catch (err2) {
      console.warn('Unable to parse FIREBASE_ADMIN_SDK_JSON');
    }
  }
} else if (credentialPath) {
  const resolvedPath = path.isAbsolute(credentialPath)
    ? credentialPath
    : path.resolve(process.cwd(), credentialPath);
  try {
    serviceAccount = require(resolvedPath);
  } catch (err) {
    console.warn('Unable to require FIREBASE_ADMIN_SDK_PATH', err && err.message);
  }
}

if (serviceAccount && !admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('Firebase Admin initialized');
} else if (!serviceAccount) {
  // Cloud Run supplies Application Default Credentials through its service account.
  // On a local machine, set FIREBASE_ADMIN_SDK_PATH or FIREBASE_ADMIN_SDK_JSON.
  admin.initializeApp();
  console.log('Firebase Admin initialized with application default credentials');
}

async function verifyIdToken(idToken) {
  if (!admin.apps.length) throw new Error('Firebase Admin not initialized');
  return admin.auth().verifyIdToken(idToken);
}

module.exports = { verifyIdToken, admin };
