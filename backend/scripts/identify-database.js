const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

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
    const [rows] = await connection.query(
      'SELECT DATABASE() AS database_name, @@hostname AS hostname, @@version AS version, @@port AS port'
    );
    console.table(rows);
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error.code || error.name, error.message);
  process.exit(1);
});
