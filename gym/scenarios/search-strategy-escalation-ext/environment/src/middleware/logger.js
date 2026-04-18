// src/middleware/logger.js - Request logging middleware
const config = require('../config');

function logger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    if (shouldLog(level)) {
      const logEntry = {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userId: req.userId || 'anonymous',
        // Include rate limit info if headers were sent
        rateLimit: res.getHeader('X-RateLimit-Remaining') !== undefined
          ? { remaining: res.getHeader('X-RateLimit-Remaining') }
          : undefined
      };
      console.log(JSON.stringify(logEntry));
    }
  });
  
  next();
}

function shouldLog(level) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  return levels[level] >= levels[config.logLevel];
}

module.exports = logger;
