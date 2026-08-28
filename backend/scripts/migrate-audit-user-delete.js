const sequelize = require('../src/config/database');
const { QueryTypes } = require('sequelize');

async function migrate() {
  await sequelize.authenticate();

  const columns = await sequelize.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME IN ('actor_name', 'actor_email')",
    { type: QueryTypes.SELECT },
  );
  const existingColumns = new Set(columns.map((column) => column.COLUMN_NAME));
  if (!existingColumns.has('actor_name')) {
    await sequelize.query('ALTER TABLE audit_logs ADD COLUMN actor_name VARCHAR(255) NULL AFTER user_id');
  }
  if (!existingColumns.has('actor_email')) {
    await sequelize.query('ALTER TABLE audit_logs ADD COLUMN actor_email VARCHAR(255) NULL AFTER actor_name');
  }

  const foreignKeys = await sequelize.query(
    "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'user_id' AND REFERENCED_TABLE_NAME = 'users'",
    { type: QueryTypes.SELECT },
  );
  for (const foreignKey of foreignKeys) {
    await sequelize.query(`ALTER TABLE audit_logs DROP FOREIGN KEY \`${foreignKey.CONSTRAINT_NAME}\``);
  }
  await sequelize.query('ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE');

  // Existing audit triggers prevent normal updates. They are temporarily replaced only to
  // backfill immutable actor snapshots before the user relationship can be nulled.
  await sequelize.query('DROP TRIGGER IF EXISTS tr_audit_logs_no_update');
  await sequelize.query(`
    UPDATE audit_logs AS log
    LEFT JOIN users AS user ON user.id = log.user_id
    SET log.actor_name = COALESCE(log.actor_name, user.display_name),
        log.actor_email = COALESCE(log.actor_email, user.email)
    WHERE log.actor_name IS NULL OR log.actor_email IS NULL
  `);
  await sequelize.query("CREATE TRIGGER tr_audit_logs_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only: updates are forbidden'");

  console.log('Audit-log user deletion migration completed.');
}

migrate()
  .catch((error) => {
    console.error('Audit-log user deletion migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
