// src/config.js — Application configuration
// NOTE: This file has known issues flagged in code review (see task)

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_NAME = process.env.DB_NAME || 'myapp';
const DB_USER = process.env.DB_USER || 'admin';
const DB_PASS = process.env.DB_PASS || 'admin123';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

const API_PORT = process.env.API_PORT || 3000;
const API_PREFIX = '/api/v1';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

module.exports = {
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS,
  REDIS_HOST, REDIS_PORT,
  JWT_SECRET, JWT_EXPIRY,
  API_PORT, API_PREFIX,
  LOG_LEVEL
};
