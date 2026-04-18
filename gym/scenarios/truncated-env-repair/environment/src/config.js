/**
 * Notification Service — Configuration Loader
 * 
 * Reads environment variables and builds the service config.
 * All env vars have defaults to prevent crashes, but defaults
 * are development values that don't work correctly in production.
 */

require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'debug',

  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '25', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    prefix: 'notifications:'
  },

  rateLimit: {
    maxPerMinute: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
    burstLimit: parseInt(process.env.RATE_LIMIT_BURST || '5', 10),
  },

  webhook: {
    url: process.env.WEBHOOK_URL || '',
    secret: process.env.WEBHOOK_SECRET || '',
    retryCount: parseInt(process.env.WEBHOOK_RETRIES || '3', 10),
  }
};

module.exports = config;
