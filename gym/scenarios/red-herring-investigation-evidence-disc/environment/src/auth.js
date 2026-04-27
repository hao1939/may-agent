/**
 * Authentication Module
 * 
 * Handles token validation and session management.
 * Uses an in-memory token store for demonstration.
 * 
 * KNOWN ISSUE (this is the REAL bug):
 * The tokenStore is a plain object that gets populated asynchronously
 * from the "session database" (simulated). There's a race condition:
 * when a new token is issued, it's added to the async refresh queue
 * but validateToken() checks the tokenStore synchronously. If a 
 * request arrives between token issuance and async store update,
 * the token appears invalid even though it was just created.
 * 
 * This causes intermittent 401 errors — the exact symptom reported
 * by users. The token IS valid, but the store hasn't been updated yet.
 */

// Simulated token store — populated asynchronously
const tokenStore = {};

// Async refresh queue — tokens pending store update
const pendingTokens = [];

// Simulated session database
const sessionDb = {
  'user-1': { id: 'user-1', name: 'Alice', email: 'alice@example.com', role: 'admin' },
  'user-2': { id: 'user-2', name: 'Bob', email: 'bob@example.com', role: 'user' },
  'user-3': { id: 'user-3', name: 'Charlie', email: 'charlie@example.com', role: 'user' },
};

/**
 * Issue a new token for a user.
 * 
 * THE BUG: Token is returned to the client immediately, but the
 * tokenStore is updated asynchronously (via setTimeout simulating
 * a database write). If the client makes a request before the
 * async update completes, validateToken() won't find the token.
 */
function issueToken(userId) {
  const token = `tok_${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const session = sessionDb[userId];
  
  if (!session) {
    return { success: false, error: 'User not found' };
  }
  
  // BUG: This async update means there's a window where the token
  // exists (was returned to client) but isn't in the store yet
  pendingTokens.push(token);
  
  // Simulate async database write — in production this is a DB call
  // that takes 50-200ms. During this window, the token is invalid.
  setTimeout(() => {
    tokenStore[token] = {
      userId: session.id,
      user: session,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (30 * 60 * 1000), // 30 minutes
    };
    
    // Remove from pending
    const idx = pendingTokens.indexOf(token);
    if (idx !== -1) pendingTokens.splice(idx, 1);
  }, 100 + Math.random() * 150); // 100-250ms delay
  
  return { success: true, token };
}

/**
 * Validate a token.
 * 
 * THE BUG IS HERE: This only checks tokenStore synchronously.
 * It does NOT check pendingTokens. So newly-issued tokens that
 * haven't been written to the store yet return { valid: false }.
 * 
 * FIX WOULD BE: Also check pendingTokens, or make issueToken
 * synchronous, or use a synchronous write-through cache.
 */
function validateToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Missing or malformed token' };
  }
  
  const session = tokenStore[token];
  
  if (!session) {
    // NOTE: This is where the intermittent 401 comes from.
    // The token was just issued but hasn't been written to tokenStore yet.
    // This looks like "Invalid token" to the client, but the token IS valid.
    return { valid: false, reason: 'Invalid token' };
  }
  
  // Check expiration
  if (session.expiresAt < Date.now()) {
    delete tokenStore[token];
    return { valid: false, reason: 'Token expired' };
  }
  
  return { valid: true, user: session.user };
}

/**
 * Revoke a token (logout).
 */
function revokeToken(token) {
  if (tokenStore[token]) {
    delete tokenStore[token];
    return true;
  }
  return false;
}

/**
 * Get active session count (for monitoring).
 */
function getActiveSessions() {
  const now = Date.now();
  return Object.values(tokenStore).filter(s => s.expiresAt > now).length;
}

// Pre-populate some tokens for testing
tokenStore['tok_user-1_valid'] = {
  userId: 'user-1',
  user: sessionDb['user-1'],
  issuedAt: Date.now(),
  expiresAt: Date.now() + (30 * 60 * 1000),
};

tokenStore['tok_user-2_valid'] = {
  userId: 'user-2',
  user: sessionDb['user-2'],
  issuedAt: Date.now(),
  expiresAt: Date.now() + (30 * 60 * 1000),
};

module.exports = { issueToken, validateToken, revokeToken, getActiveSessions };
