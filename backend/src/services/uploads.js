const path = require('path');
const { admin } = require('./firebaseAdmin');

const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'lgu-system-d3c7a.firebasestorage.app';
const bucket = admin.storage().bucket(bucketName);

const safeFileName = (name) => path.basename(name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');

async function storeUpload(file, directory) {
  const objectPath = `${directory}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeFileName(file.originalname)}`;
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

    const object = bucket.file(`uploads/${requestedPath}`);
    const [exists] = await object.exists();
    if (!exists) return res.status(404).end();

    const [metadata] = await object.getMetadata();
    if (metadata.contentType) res.type(metadata.contentType);
    res.set('Cache-Control', metadata.cacheControl || 'public, max-age=3600');
    object.createReadStream()
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

module.exports = { storeUpload, serveUpload };
