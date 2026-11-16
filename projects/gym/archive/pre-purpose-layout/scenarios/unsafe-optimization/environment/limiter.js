/**
 * Rate limiter for API endpoints.
 * 
 * Each client gets a limit of N requests per window (e.g., 100 req/minute).
 * The limiter tracks timestamps of each request per client.
 */

const requestLog = {};  // clientId -> [timestamp, timestamp, ...]

const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 60000; // 1 minute

function recordRequest(clientId, timestamp) {
  if (!requestLog[clientId]) {
    requestLog[clientId] = [];
  }
  requestLog[clientId].push(timestamp);
}

/**
 * Check if a client is rate limited.
 * Counts requests within the sliding window.
 * 
 * IMPORTANT: This uses a sliding window — requests older than window_ms
 * before the current timestamp should NOT count. The log may contain
 * entries from before the window started.
 */
function isRateLimited(clientId, currentTimestamp, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS) {
  const log = requestLog[clientId];
  if (!log) return false;
  
  const windowStart = currentTimestamp - windowMs;
  let count = 0;
  for (const ts of log) {
    if (ts > windowStart) {
      count++;
    }
  }
  return count >= limit;
}

function getRequestCount(clientId, currentTimestamp, windowMs = DEFAULT_WINDOW_MS) {
  const log = requestLog[clientId];
  if (!log) return 0;
  
  const windowStart = currentTimestamp - windowMs;
  let count = 0;
  for (const ts of log) {
    if (ts > windowStart) {
      count++;
    }
  }
  return count;
}

function resetClient(clientId) {
  delete requestLog[clientId];
}

function resetAll() {
  for (const key in requestLog) {
    delete requestLog[key];
  }
}

module.exports = { recordRequest, isRateLimited, getRequestCount, resetClient, resetAll };
