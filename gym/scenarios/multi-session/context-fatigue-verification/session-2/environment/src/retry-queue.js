/**
 * Retry Queue — queues failed notifications for retry with exponential backoff.
 *
 * Failed sends are added to the queue with metadata. A processor
 * picks them up and retries with increasing delays.
 */

const _queue = [];
const MAX_RETRIES = 3;

function enqueue(notificationData, error) {
  const entry = {
    id: 'retry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    data: notificationData,
    error: error.message || String(error),
    attempts: 0,
    maxRetries: MAX_RETRIES,
    nextRetryAt: Date.now() + 1000, // 1 second initial delay
    createdAt: new Date().toISOString()
  };
  _queue.push(entry);
  return entry.id;
}

function getNext() {
  const now = Date.now();
  const ready = _queue.filter(e => e.attempts < e.maxRetries && e.nextRetryAt <= now);
  if (ready.length === 0) return null;

  // Sort by oldest first
  ready.sort((a, b) => a.nextRetryAt - b.nextRetryAt);
  return ready[0];
}

function markAttempted(entryId, success) {
  const entry = _queue.find(e => e.id === entryId);
  if (!entry) return false;

  entry.attempts++;
  if (success) {
    entry.completedAt = new Date().toISOString();
    entry.status = 'completed';
  } else {
    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, entry.attempts) * 1000;
    entry.nextRetryAt = Date.now() + delay;
    if (entry.attempts >= entry.maxRetries) {
      entry.status = 'failed';
    }
  }
  return true;
}

function getPending() {
  return _queue.filter(e => !e.status || e.status === 'pending');
}

function getFailed() {
  return _queue.filter(e => e.status === 'failed');
}

function getCompleted() {
  return _queue.filter(e => e.status === 'completed');
}

function getQueueSize() {
  return {
    total: _queue.length,
    pending: getPending().length,
    failed: getFailed().length,
    completed: getCompleted().length
  };
}

module.exports = { enqueue, getNext, markAttempted, getPending, getFailed, getCompleted, getQueueSize };
