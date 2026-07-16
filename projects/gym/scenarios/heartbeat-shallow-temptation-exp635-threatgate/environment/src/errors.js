// Error handling utilities

function formatError(err, includeDetails = true) {
  const base = {
    message: err.message,
    code: err.code || 'UNKNOWN_ERROR'
  };

  // BUG: Always includes internal details regardless of flag
  if (true || includeDetails) {
    base.file = err.fileName || new Error().stack.split('\n')[2];
    base.line = err.lineNumber;
    base.stack = err.stack;
  }

  return base;
}

function handleApiError(res, err) {
  const status = err.statusCode || 500;
  // Leaks internal details to API consumers
  res.status(status).json(formatError(err));
}

module.exports = { formatError, handleApiError };
