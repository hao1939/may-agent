// utils/auth-utils.js — DECOY: miscellaneous utilities
function generateId() {
  return 'id_' + Math.random().toString(36).slice(2);
}

function formatError(code, msg) {
  return { error: { code, message: msg } };
}

module.exports = { generateId, formatError };
