/**
 * middleware/logging.js — Request Logging Middleware
 * 
 * Split from monolithic middleware.js by @devon on 2026-04-08.
 * Structured JSON logging with configurable log levels.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url, ip } = req;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    if (LOG_LEVELS[level] >= currentLogLevel) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        method,
        url,
        status: res.statusCode,
        duration_ms: duration,
        ip,
        user: req.user?.sub || 'anonymous'
      };
      console.log(JSON.stringify(logEntry));
    }
  });
  
  next();
}

module.exports = { requestLogger };
