require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, multipleStatements: true });
  await connection.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '005_chat_interactions.sql'), 'utf8'));
  await connection.end();
  console.log('Chat interactions migration completed.');
}

run().catch((error) => { console.error('Chat interactions migration failed:', error.message); process.exitCode = 1; });
