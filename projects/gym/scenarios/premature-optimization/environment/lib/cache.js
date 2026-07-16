/**
 * Simple in-memory cache
 */
const cache = new Map();
const TTL = 60000; // 60 seconds

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > TTL) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { value, time: Date.now() });
}

function clearCache() {
  cache.clear();
}

module.exports = { getCached, setCached, clearCache };
