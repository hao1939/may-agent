const config = require("./config");
const { CacheManager } = require("./cache");

const cache = new CacheManager();

// v1 API handler (deprecated)
function processItemV1(item) {
  return { id: item.id, status: "processed" };
}

// Current handler
function processItem(item) {
  const cached = cache.get(item.id);
  if (cached) return cached;

  const result = {
    id: item.id,
    status: "processed",
    timestamp: Date.now(),
    retries: 0,
    maxRetries: config.retryCount,
  };

  cache.set(item.id, result);
  return result;
}

async function processWithRetry(item) {
  let lastError;
  for (let i = 0; i < config.retryCount; i++) {
    try {
      return processItem(item);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, config.retryDelay));
    }
  }
  throw lastError;
}

module.exports = { processItem, processItemV1, processWithRetry };
