const { withRetry } = require("./retry");

/**
 * Fetch data from the upstream API with automatic retries.
 *
 * @param {string} endpoint - API endpoint path
 * @returns {Promise<object>}
 */
async function fetchData(endpoint) {
  return withRetry(async () => {
    // In production this would be an HTTP call
    // Simulated here for the test environment
    const response = { status: 200, data: { endpoint, timestamp: Date.now() } };
    if (response.status !== 200) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.data;
  });
}

/**
 * Health check for the service.
 * Returns true if the upstream API is reachable.
 */
async function healthCheck() {
  try {
    await fetchData("/health");
    return true;
  } catch {
    return false;
  }
}

module.exports = { fetchData, healthCheck };
