function authMiddleware(req, res, next) {
  // Simple auth check - just verify content-type for now
  if (req.headers['content-type'] !== 'application/json') {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
}

function validateEmail(email) {
  // Placeholder - not wired up yet
  return true;
}

module.exports = { authMiddleware, validateEmail };
