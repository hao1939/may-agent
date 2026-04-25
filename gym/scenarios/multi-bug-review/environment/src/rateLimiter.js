/**
 * PR #3: Fix rate limiter token bucket
 * 
 * Bug: Rate limiter allows bursts beyond the configured max
 * Fix: Corrected token replenishment to cap at maxTokens
 * 
 */

class RateLimiter {
  /**
   * @param {number} maxTokens - Maximum tokens in the bucket
   * @param {number} refillRate - Tokens added per second
   */
  constructor(maxTokens, refillRate) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time, capping at maxTokens.
   */
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  /**
   * Try to consume tokens. Returns true if allowed, false if rate limited.
   * @param {number} amount - Number of tokens to consume (default 1)
   * @returns {boolean}
   */
  consume(amount = 1) {
    this.refill();
    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }
    return false;
  }

  /**
   * Get current token count (after refill).
   * @returns {number}
   */
  availableTokens() {
    this.refill();
    return this.tokens;
  }
}

module.exports = { RateLimiter };
