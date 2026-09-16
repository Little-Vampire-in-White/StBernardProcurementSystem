require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  const migrationPath = path.join(__dirname, '..', 'migrations', '003_procurement_checklist_templates.sql');
  await connection.query(fs.readFileSync(migrationPath, 'utf8'));
  await connection.end();
  console.log('Procurement checklist migration completed.');
}

run().catch((error) => {
  console.error('Procurement checklist migration failed:', error.message);
  process.exitCode = 1;
});
