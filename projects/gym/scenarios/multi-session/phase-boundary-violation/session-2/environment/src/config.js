// src/config.js — Application configuration
// @author: team
// Updated by @sam: Added structured config object and validation

const config = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'myapp',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASS || 'admin123',
    maxPool: parseInt(process.env.DB_MAX_POOL, 10) || 20,
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT, 10) || 2000
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
    expiry: process.env.JWT_EXPIRY || '24h'
  },
  api: {
    port: parseInt(process.env.API_PORT, 10) || 3000,
    prefix: '/api/v1'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

// Validate required config in production
if (process.env.NODE_ENV === 'production') {
  const required = ['DB_HOST', 'DB_PASS', 'JWT_SECRET', 'REDIS_HOST'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

module.exports = config;
