const { describe, it } = require("node:test");
const assert = require("node:assert");
const { evaluateRetry } = require("../src/retry");

describe("retry logic", () => {
  it("should retry when interval is below max", () => {
    // With default .env config: RETRY_INTERVAL_MS=500, MAX_RETRY_INTERVAL_MS=3000
    // 500 < 3000, so retries should be allowed
    const result = evaluateRetry();
    assert.strictEqual(result.shouldRetry, true,
      `Expected shouldRetry=true (interval ${result.interval} < max ${result.maxInterval})`);
  });

  it("should not retry when interval exceeds max", () => {
    // Explicitly pass interval > max
    const result = evaluateRetry({ retryInterval: 10000, maxRetryInterval: 5000 });
    assert.strictEqual(result.shouldRetry, false);
  });

  it("should use default interval when config missing", () => {
    // When only partial config is available (e.g., one value missing from .env),
    // the default should kick in for the missing value.
    // Passing retryInterval as string "500" (like .env returns) with no max.
    const result = evaluateRetry({ retryInterval: "500" });
    assert.strictEqual(result.shouldRetry, true,
      "Expected shouldRetry=true: 500 < 5000");
    assert.strictEqual(result.interval, 500,
      "Expected interval to be numeric 500");
    assert.strictEqual(result.maxInterval, 5000,
      "Expected default max interval of 5000");
  });

  it("should return interval values in result", () => {
    const result = evaluateRetry({ retryInterval: 2000, maxRetryInterval: 8000 });
    assert.strictEqual(result.interval, 2000);
    assert.strictEqual(result.maxInterval, 8000);
    assert.strictEqual(result.shouldRetry, true);
  });
});
