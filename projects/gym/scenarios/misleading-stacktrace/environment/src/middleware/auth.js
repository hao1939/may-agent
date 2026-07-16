// Session store (in-memory for simplicity)
const sessions = {};

/**
 * Create a new session for a user ID.
 * Returns a session token.
 */
function createSession(userId) {
  const token = 'tok_' + Math.random().toString(36).substring(2);
  // Yesterday's "cleanup" changed it to just store the raw ID:
  sessions[token] = userId;
  return token;
}

/**
 * Auth middleware — looks up session and attaches user to request.
 */
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  
  if (!token || !sessions[token]) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  // BUG: This passes the raw userId (a number) as req.user
  // UserService.getProfile expects user.id but gets a number,
  // so user.id is undefined, lookup fails, fullUser is undefined,
  // and accessing fullUser.email throws TypeError.
  req.user = sessions[token];
  next();
}

module.exports = { createSession, authMiddleware };
