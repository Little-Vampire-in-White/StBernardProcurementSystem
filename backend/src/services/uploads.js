const path = require('path');
const { admin } = require('./firebaseAdmin');

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'lgu-system-d3c7a';
const bucketCandidates = [
  process.env.FIREBASE_STORAGE_BUCKET,
  process.env.VITE_FIREBASE_STORAGE_BUCKET,
  `${projectId}.firebasestorage.app`,
  `${projectId}.appspot.com`,
  'lgu-system-d3c7a.firebasestorage.app',
  'lgu-system-d3c7a.appspot.com',
].filter(Boolean);

async function resolveStorageBucket() {
  for (const bucketName of bucketCandidates) {
    try {
      const candidate = admin.storage().bucket(bucketName);
      const [exists] = await candidate.exists();
      if (exists) return candidate;
    } catch (error) {
      console.warn(`Storage bucket unavailable: ${bucketName}`, error.message || error);
    }
  }
  return admin.storage().bucket(bucketCandidates[0] || `${projectId}.firebasestorage.app`);
}

const safeFileName = (name) => path.basename(name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');

function normalizeStoredUploadPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) return '';
  const cleaned = normalized.replace(/^uploads\//, '').replace(/^\/+/, '');
  return cleaned ? `uploads/${cleaned}` : 'uploads';
}

function getUploadCandidates(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) return [];
  const deduped = new Set();
  deduped.add(normalizeStoredUploadPath(normalized));
  deduped.add(normalized.replace(/^uploads\//, ''));
  deduped.add(normalized);
  return [...deduped].filter(Boolean);
}

async function storeUpload(file, directory) {
  const bucket = await resolveStorageBucket();
  const directoryPath = normalizeStoredUploadPath(directory).replace(/\/+$/, '');
  const objectPath = `${directoryPath}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeFileName(file.originalname)}`;
  const object = bucket.file(objectPath);
  await object.save(file.buffer, {
    resumable: false,
    metadata: {
      contentType: file.mimetype || 'application/octet-stream',
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });
  return objectPath;
}

async function serveUpload(req, res) {
  try {
    const requestedPath = req.params[0];
    if (!requestedPath || requestedPath.includes('..')) return res.status(400).end();

    const candidates = getUploadCandidates(requestedPath);
    const bucket = await resolveStorageBucket();
    let resolvedObject = null;

    for (const candidate of candidates) {
      const object = bucket.file(candidate);
      const [exists] = await object.exists();
      if (exists) {
        resolvedObject = object;
        break;
      }
    }

    if (!resolvedObject) return res.status(404).end();

    const [metadata] = await resolvedObject.getMetadata();
    if (metadata.contentType) res.type(metadata.contentType);
    res.set('Cache-Control', metadata.cacheControl || 'public, max-age=3600');
    resolvedObject.createReadStream()
      .on('error', (error) => {
        console.error('Unable to read upload', error);
        if (!res.headersSent) res.status(500).end();
        else res.end();
      })
      .pipe(res);
  } catch (error) {
    console.error('Unable to find upload', error);
    return res.status(500).end();
  }
}

module.exports = { storeUpload, serveUpload, normalizeStoredUploadPath };
