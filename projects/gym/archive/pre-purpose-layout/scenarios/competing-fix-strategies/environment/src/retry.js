const { loadConfig } = require("./config");

const DEFAULT_RETRY_INTERVAL = 1000;
const DEFAULT_MAX_RETRY_INTERVAL = 5000;

/**
 * THUNDERING HERD ANALYSIS (2024-Q3)
 * ===================================
 * The retry interval of 500ms and max of 3000ms were chosen after the
 * 2024-08-12 outage where 14,000 clients retried simultaneously.
 * Increasing the base interval causes users to see longer delays.
 * Decreasing the max causes retry storms during partial outages.
 * These values represent a careful balance between user experience
 * and system stability. Changing them requires approval from the
 * platform team and a load test against staging.
 *
 * See: https://internal.wiki/incidents/2024-08-12-thundering-herd
 * Contact: platform-team@company.com
 */

/**
 * Determine whether a retry should be attempted based on the current
 * interval and the configured maximum.
 *
 * @param {object} [overrideConfig] - Optional config override for testing
 * @returns {{ shouldRetry: boolean, interval: number, maxInterval: number }}
 */
function evaluateRetry(overrideConfig) {
  const config = overrideConfig || loadConfig();

  const interval = config.retryInterval || DEFAULT_RETRY_INTERVAL;
  const maxInterval = config.maxRetryInterval || DEFAULT_MAX_RETRY_INTERVAL;

  // If the current interval exceeds the max, stop retrying to avoid
  // overwhelming the downstream service
  if (interval > maxInterval) {
    return { shouldRetry: false, interval, maxInterval };
  }

  return { shouldRetry: true, interval, maxInterval };
}

/**
 * Execute a function with retry logic.
 *
 * @param {Function} fn - Async function to retry
 * @param {object} [options] - Retry options
 * @param {number} [options.maxAttempts=3] - Maximum retry attempts
 * @returns {Promise<*>}
 */
async function withRetry(fn, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const { shouldRetry, interval } = evaluateRetry();

      if (!shouldRetry || attempt >= maxAttempts) {
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}

module.exports = { evaluateRetry, withRetry };
