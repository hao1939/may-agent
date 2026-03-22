/**
 * Request Logger
 * Logs request details for monitoring and debugging.
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = process.env.LOG_FILE || '/tmp/api-requests.log';

/**
 * Log a request with its status.
 * Redacts sensitive headers before logging.
 * @param {Object} req - Express request object
 * @param {string} status - Status string to log
 */
function logRequest(req, status) {
  const timestamp = new Date().toISOString();
  const method = req.method || 'UNKNOWN';
  const url = req.originalUrl || req.url || '/';
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';

  // Build safe headers object — redact sensitive values
  const safeHeaders = {};
  if (req.headers) {
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === 'authorization') {
        safeHeaders[key] = '[REDACTED]';
      } else if (key.toLowerCase() === 'cookie') {
        safeHeaders[key] = '[REDACTED]';
      } else {
        safeHeaders[key] = value;
      }
    }
  }

  const logEntry = {
    timestamp,
    method,
    url,
    ip,
    status,
    headers: safeHeaders
  };

  const line = JSON.stringify(logEntry) + '\n';

  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (err) {
    // If log file isn't writable, fallback to stderr
    process.stderr.write(`[LOG] ${line}`);
  }
}

/**
 * Read recent log entries.
 * @param {number} count - Number of recent entries to return
 * @returns {Array<Object>} Parsed log entries
 */
function readLogs(count = 100) {
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = raw.split('\n').filter(l => l.trim());
    return lines.slice(-count).map(l => {
      try { return JSON.parse(l); } catch { return { raw: l }; }
    });
  } catch {
    return [];
  }
}

module.exports = { logRequest, readLogs };
