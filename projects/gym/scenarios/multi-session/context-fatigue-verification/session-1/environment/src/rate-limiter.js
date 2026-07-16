/**
 * Rate Limiter — prevents notification spam per user.
 *
 * Tracks send counts per userId+channel within a sliding window.
 * Rejects sends that would exceed the configured limit.
 */

const config = require('./config');

// In-memory store: { "userId:channel": [timestamp, timestamp, ...] }
const _windows = {};

function checkLimit(userId, channel) {
  const key = `${userId}:${channel}`;
  const windowMs = config.get('rateLimit.windowMs') || 3600000; // 1 hour default
  const maxPerWindow = config.get('rateLimit.maxPerWindow') || 10;

  const now = Date.now();
  if (!_windows[key]) _windows[key] = [];

  // Purge expired entries
  _windows[key] = _windows[key].filter(ts => (now - ts) < windowMs);

  if (_windows[key].length >= maxPerWindow) {
    return { allowed: false, remaining: 0, resetIn: Math.min(..._windows[key].map(ts => windowMs - (now - ts))) };
  }

  return { allowed: true, remaining: maxPerWindow - _windows[key].length };
}

function recordSend(userId, channel) {
  const key = `${userId}:${channel}`;
  if (!_windows[key]) _windows[key] = [];
  _windows[key].push(Date.now());
}

function resetUser(userId) {
  const keysToDelete = Object.keys(_windows).filter(k => k.startsWith(userId + ':'));
  keysToDelete.forEach(k => delete _windows[k]);
}

function getStats() {
  const stats = {};
  for (const [key, timestamps] of Object.entries(_windows)) {
    stats[key] = timestamps.length;
  }
  return stats;
}

module.exports = { checkLimit, recordSend, resetUser, getStats };
