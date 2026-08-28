const express = require('express');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { sequelize } = require('./models');
const auditMiddleware = require('./middleware/auditMiddleware');
const authMiddleware = require('./middleware/authMiddleware');
const { serveUpload } = require('./services/uploads');

// attach audit helper
app.use(auditMiddleware);

// attach user (if Authorization header present)
app.use(authMiddleware);

// routes
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/exports', require('./routes/exports'));
app.use('/api/barangays', require('./routes/barangays'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/dev', require('./routes/dev'));
app.use('/api/requests', require('./routes/requests'));

// Uploaded content is stored in Cloud Storage, never the Cloud Run container.
app.get('/uploads/*', serveUpload);

const port = process.env.PORT || 4000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    // Schema changes are normally applied through migrations. This opt-in is
    // useful for first-time provisioning of an empty database only.
    if (process.env.DB_SYNC === 'true') {
      await sequelize.sync();
      console.log('Database schema synchronized');
    }
    app.listen(port, () => console.log(`Server listening ${port}`));
  } catch (err) {
    console.error('Failed to start', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
