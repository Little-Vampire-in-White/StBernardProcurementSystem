/* Run once with: node scripts/run-role-migration.js */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function migrationStatements(sql) {
  const statements = [];
  let delimiter = ';';
  let current = '';

  for (const line of sql.split(/\r?\n/)) {
    if (line.startsWith('DELIMITER ')) {
      if (current.trim()) statements.push(current.trim());
      current = '';
      delimiter = line.slice('DELIMITER '.length).trim();
      continue;
    }
    current += `${line}\n`;
    if (line.trimEnd().endsWith(delimiter)) {
      statements.push(current.trim().slice(0, -delimiter.length).trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ...(process.env.INSTANCE_UNIX_SOCKET ? { socketPath: process.env.INSTANCE_UNIX_SOCKET } : {}),
  });
  try {
    // MySQL 5.7 (still used by some Cloud SQL instances) does not support
    // ADD COLUMN IF NOT EXISTS. Add only genuinely missing columns here so
    // the SQL migration remains safe to run on MySQL 5.7 and 8.x.
    const [columns] = await connection.query(
      `SELECT column_name AS name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'users'
       AND column_name IN ('barangay_id', 'status', 'pending_role')`
    );
    const existingColumns = new Set(columns.map((column) => String(column.name).toLowerCase()));
    const missingColumns = [
      ['barangay_id', 'ADD COLUMN `barangay_id` INT UNSIGNED NULL'],
      ['status', "ADD COLUMN `status` ENUM('active','pending','rejected') NOT NULL DEFAULT 'active'"],
      ['pending_role', 'ADD COLUMN `pending_role` VARCHAR(50) NULL'],
    ].filter(([name]) => !existingColumns.has(name));
    if (missingColumns.length) {
      await connection.query(`ALTER TABLE \`users\` ${missingColumns.map(([, definition]) => definition).join(', ')}`);
    }

    const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '002_municipal_role_limits.sql'), 'utf8');
    for (const statement of migrationStatements(sql)) {
      const executable = statement.replace(/^--[^\n]*\n/, '').trim();
      if (executable) await connection.query(executable);
    }
    const [roles] = await connection.query('SELECT role, status, COUNT(*) AS count FROM users GROUP BY role, status ORDER BY role, status');
    console.table(roles);
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error.code || error.name, error.message);
  process.exit(1);
});
