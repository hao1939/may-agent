const { validateToken } = require('./auth');

// Track request metrics (in-memory for demo)
let requestCount = 0;
let errorCount = 0;

/**
 * Logs incoming requests with basic metrics.
 * Note: There's a known TypeError when req.headers is missing 'x-request-id'
 * which happens on health checks from the load balancer. It's caught and handled
 * below — it does NOT affect request processing.
 */
function requestLogger(req, res, next) {
  requestCount++;
  
  try {
    // BUG: This line throws TypeError when x-request-id is missing
    // but it's caught below and doesn't affect anything
    const requestId = req.headers['x-request-id'].toString();  // line ~20
    req.requestId = requestId;
  } catch (err) {
    // Expected for health checks — use a generated ID instead
    req.requestId = `auto-${requestCount}`;
    // This error gets logged to error.log but is totally harmless
    logError('middleware.js', 42, err);
  }
  
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      errorCount++;
    }
  });
  
  next();
}

/**
 * Authentication middleware — validates bearer token on protected routes.
 * Skips auth for health check and public endpoints.
 */
function authMiddleware(req, res, next) {
  // Skip auth for public endpoints
  const publicPaths = ['/health', '/api/public', '/favicon.ico'];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }
  
  const token = authHeader.split(' ')[1];
  
  // Validate token using auth module
  const result = validateToken(token);
  
  if (!result.valid) {
    return res.status(401).json({ error: result.reason || 'Invalid token' });
  }
  
  req.user = result.user;
  next();
}

/**
 * Error logging middleware
 */
function errorLogger(err, req, res, next) {
  logError(err.source || 'unknown', err.line || 0, err);
  next(err);
}

function logError(source, line, err) {
  const entry = `[${new Date().toISOString()}] ${source}:${line} - ${err.name || 'Error'}: ${err.message}`;
  // In production this writes to error.log
  // For demo purposes, errors are pre-populated in error.log
}

function getMetrics() {
  return { requestCount, errorCount };
}

module.exports = { requestLogger, authMiddleware, errorLogger, getMetrics };
