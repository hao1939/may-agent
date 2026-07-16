/**
 * Structured Logger — JSON-based logging with context objects.
 * Added by DevOps. DO NOT MODIFY.
 * 
 * Usage:
 *   const logger = require('./logger');
 *   logger.info('User created', { fn: 'createUser', userId: '123' });
 *   logger.error('Failed to create user', { fn: 'createUser', error: err.message });
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let minLevel = LOG_LEVELS.info;

function formatLog(level, message, context = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  });
}

function debug(message, context) {
  if (LOG_LEVELS.debug >= minLevel) {
    process.stdout.write(formatLog('debug', message, context) + '\n');
  }
}

function info(message, context) {
  if (LOG_LEVELS.info >= minLevel) {
    process.stdout.write(formatLog('info', message, context) + '\n');
  }
}

function warn(message, context) {
  if (LOG_LEVELS.warn >= minLevel) {
    process.stderr.write(formatLog('warn', message, context) + '\n');
  }
}

function error(message, context) {
  if (LOG_LEVELS.error >= minLevel) {
    process.stderr.write(formatLog('error', message, context) + '\n');
  }
}

function setLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    minLevel = LOG_LEVELS[level];
  }
}

module.exports = { debug, info, warn, error, setLevel };
