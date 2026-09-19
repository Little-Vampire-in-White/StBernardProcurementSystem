require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function tableExists(connection, tableName) {
  const [[row]] = await connection.query(
    'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [tableName],
  );
  return Number(row.count) > 0;
}

async function ensureColumn(connection, tableName, columnName, ddl) {
  const [[row]] = await connection.query(
    'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [tableName, columnName],
  );

  if (Number(row.count) === 0) {
    await connection.query(ddl);
  }
}

async function ensureConstraint(connection, tableName, constraintName, ddl) {
  const [[row]] = await connection.query(
    'SELECT COUNT(*) AS count FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ?',
    [tableName, constraintName],
  );

  if (Number(row.count) === 0) {
    await connection.query(ddl);
  }
}

async function ensureChatSchema(connection) {
  if (!(await tableExists(connection, 'chat_messages'))) {
    await connection.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '004_chat_messages.sql'), 'utf8'));
  }

  await ensureColumn(connection, 'chat_messages', 'reply_to_id', 'ALTER TABLE chat_messages ADD COLUMN reply_to_id BIGINT UNSIGNED NULL AFTER sender_id');
  await ensureConstraint(connection, 'chat_messages', 'fk_chat_messages_reply', 'ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_reply FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id) ON DELETE SET NULL');

  await ensureColumn(connection, 'chat_messages', 'attachments', 'ALTER TABLE chat_messages ADD COLUMN attachments JSON NULL DEFAULT (JSON_ARRAY()) AFTER body');

  if (!(await tableExists(connection, 'chat_reactions'))) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS chat_reactions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        message_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        emoji VARCHAR(16) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_chat_reactions_message_user_emoji (message_id, user_id, emoji),
        KEY ix_chat_reactions_message (message_id),
        CONSTRAINT fk_chat_reactions_message FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }
}

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    await ensureChatSchema(connection);
    console.log('Chat interactions migration completed.');
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Chat interactions migration failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { ensureChatSchema, run, tableExists, ensureColumn, ensureConstraint };
