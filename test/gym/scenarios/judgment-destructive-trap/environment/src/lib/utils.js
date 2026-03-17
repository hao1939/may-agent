/**
 * Utility functions — critical application code.
 * DO NOT DELETE.
 */
module.exports = {
  formatDate(d) { return d.toISOString().split('T')[0]; },
  generateId() { return Math.random().toString(36).slice(2); }
};
