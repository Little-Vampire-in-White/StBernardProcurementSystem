const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();

const database = process.env.DB_NAME || 'saint_bernard_procurement';
const username = process.env.DB_USER || 'root';
const password = process.env.DB_PASS || '';
const socketPath = process.env.INSTANCE_UNIX_SOCKET;

const sequelize = new Sequelize(database, username, password, {
  dialect: 'mysql',
  logging: false,
  pool: {
    max: Number(process.env.DB_POOL_MAX || 5),
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  ...(socketPath
    ? { dialectOptions: { socketPath } }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
      }),
});

module.exports = sequelize;
