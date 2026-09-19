const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

const allowedOrigins = [
  'https://stbernard-eprocurement.web.app',
  'https://stbernard-eprocurement.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  undefined,
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.options('*', cors());
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
app.use('/api/chat', require('./routes/chat'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/dev', require('./routes/dev'));
app.use('/api/requests', require('./routes/requests'));

// Uploaded content is stored in Cloud Storage, never the Cloud Run container.
app.get('/uploads/*', serveUpload);

const port = process.env.PORT || 4000;

async function ensureChatSchema() {
  const checks = [
    ['reply_to_id', 'ALTER TABLE chat_messages ADD COLUMN reply_to_id BIGINT UNSIGNED NULL AFTER sender_id'],
    ['attachments', 'ALTER TABLE chat_messages ADD COLUMN attachments JSON NULL DEFAULT (JSON_ARRAY()) AFTER body'],
  ];

  for (const [columnName, ddl] of checks) {
    const [rows] = await sequelize.query(
      'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
      { replacements: ['chat_messages', columnName] },
    );

    if (Number(rows[0]?.count || 0) === 0) {
      await sequelize.query(ddl);
      console.log(`Chat schema repaired: added ${columnName} to chat_messages`);
    }
  }
}

async function start() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    await ensureChatSchema();
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
