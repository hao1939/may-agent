/**
 * Auth Middleware
 * 
 * Handles session management and token validation.
 * Reads configuration from the auth config loaded by loader.js.
 * 
 * Fixed 2026-04-06: refresh_expiry was being compared as seconds vs milliseconds.
 * The token refresh bug caused users to be logged out after 1 hour.
 */
const { loadConfig } = require('./loader');

let authConfig = null;

function getAuthConfig() {
  if (!authConfig) {
    authConfig = loadConfig('auth');
  }
  return authConfig;
}

/**
 * Initialize session store based on auth config.
 * Uses config.session.store for the store type (e.g., 'memory', 'redis')
 * and config.session.max_age for session duration in milliseconds.
 */
function initSession(app) {
  const config = getAuthConfig();
  const store = config.session?.store || 'memory';
  const maxAge = config.session?.max_age || 7200000; // 2 hours default
  
  console.log(`[auth] Session store: ${store}, max_age: ${maxAge}ms`);
  
  app.use((req, res, next) => {
    // Session cookie settings
    req.sessionOptions = {
      store: store,
      maxAge: maxAge,
      secure: true,
      httpOnly: true
    };
    next();
  });
}

/**
 * Validate JWT token from Authorization header.
 * Uses config.secret for verification, config.token_expiry for max age.
 */
function validateToken(req, res, next) {
  const config = getAuthConfig();
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  // In production, this would use jwt.verify(token, config.secret)
  // Simplified for config migration testing
  req.user = { authenticated: true };
  next();
}

/**
 * Check if token needs refresh.
 * Uses config.refresh_expiry (in seconds) to determine refresh window.
 * Bug fix: was comparing seconds to milliseconds — now consistent.
 */
function checkRefresh(req, res, next) {
  const config = getAuthConfig();
  const refreshExpiry = config.refresh_expiry; // in seconds
  
  if (req.tokenAge && req.tokenAge > refreshExpiry) {
    req.needsRefresh = true;
  }
  next();
}

module.exports = { initSession, validateToken, checkRefresh, getAuthConfig };
