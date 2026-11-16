const dotenv = require('dotenv');
dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5433,  // fallback updated: DB migrated to 5433 on 2026-03-15
  database: process.env.DB_NAME || 'myapp_prod',
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || '',
};

module.exports = { DB_CONFIG };
