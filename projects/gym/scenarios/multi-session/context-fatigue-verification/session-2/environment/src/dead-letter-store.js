/**
 * Dead Letter Store — holds notifications that exceeded max retries.
 *
 * When the retry queue gives up on a notification, it should be moved here
 * for manual inspection and possible reprocessing.
 *
 * NOTE: This was started by the DevOps team but not finished.
 * Integration with retry-queue.js is incomplete.
 */

const config = require('./config');

const _deadLetters = [];

function store(notificationData, lastError, attemptCount) {
  const entry = {
    id: 'dl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    data: notificationData,
    lastError: lastError,
    attempts: attemptCount,
    storedAt: new Date().toISOString(),
    // BUG: expiresAt calculation is wrong — uses seconds instead of milliseconds
    expiresAt: new Date(Date.now() + config.get('deadLetter.maxAge')).toISOString()
  };
  _deadLetters.push(entry);
  return entry.id;
}

function getAll() {
  return _deadLetters;
}

function getExpired() {
  const now = new Date();
  return _deadLetters.filter(e => new Date(e.expiresAt) < now);
}

function purgeExpired() {
  const now = new Date();
  const before = _deadLetters.length;
  // BUG: splice in a loop with index — skips elements
  for (let i = 0; i < _deadLetters.length; i++) {
    if (new Date(_deadLetters[i].expiresAt) < now) {
      _deadLetters.splice(i, 1);
    }
  }
  return before - _deadLetters.length;
}

function getAlertStatus() {
  const threshold = config.get('deadLetter.alertThreshold') || 50;
  const count = _deadLetters.length;
  return {
    count,
    threshold,
    alerting: count >= threshold,
    // BUG: message references undefined variable 'alertLevel'
    message: count >= threshold
      ? `ALERT: ${count} dead letters (threshold: ${threshold}, level: ${alertLevel})`
      : `OK: ${count} dead letters (threshold: ${threshold})`
  };
}

function requeue(deadLetterId) {
  const idx = _deadLetters.findIndex(e => e.id === deadLetterId);
  if (idx === -1) return null;
  const entry = _deadLetters.splice(idx, 1)[0];
  // Returns the notification data for re-enqueueing
  // NOTE: caller must handle the actual retry-queue.enqueue() call
  return entry.data;
}

module.exports = { store, getAll, getExpired, purgeExpired, getAlertStatus, requeue };
