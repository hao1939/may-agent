/**
 * Token-bucket rate limiter.
 * Each client gets a bucket that refills over time.
 */
class RateLimiter {
  /**
   * @param {Object} options
   * @param {number} options.capacity - Max tokens per bucket (default 10)
   * @param {number} options.refillRate - Tokens added per second (default 1)
   */
  constructor(options = {}) {
    this.capacity = options.capacity || 10;
    this.refillRate = options.refillRate || 1;
    this.buckets = new Map();
  }

  /**
   * Get or create a bucket for a client.
   * @param {string} clientId
   * @returns {Object} bucket
   */
  _getBucket(clientId) {
    if (!this.buckets.has(clientId)) {
      this.buckets.set(clientId, {
        tokens: this.capacity,
        lastRefill: Date.now() / 1000  // BUG: storing as seconds
      });
    }
    return this.buckets.get(clientId);
  }

  /**
   * Refill tokens based on elapsed time.
   * @param {Object} bucket
   */
  _refill(bucket) {
    const now = Date.now();  // milliseconds
    const elapsed = (now - bucket.lastRefill) / 1000;  // BUG: lastRefill is seconds, now is ms
    const tokensToAdd = elapsed * this.refillRate;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = Date.now() / 1000;  // BUG: storing as seconds again
  }

  /**
   * Try to consume a token for a client.
   * @param {string} clientId
   * @returns {Object} { allowed: boolean, remaining: number, retryAfter?: number }
   */
  tryConsume(clientId) {
    const bucket = this._getBucket(clientId);
    this._refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens)
      };
    }

    // Calculate when next token will be available
    const retryAfter = (1 - bucket.tokens) / this.refillRate;
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(retryAfter * 1000) / 1000  // round to ms
    };
  }

  /**
   * Reset a client's bucket.
   * @param {string} clientId
   */
  reset(clientId) {
    this.buckets.delete(clientId);
  }

  /**
   * Get current status for a client.
   * @param {string} clientId
   * @returns {Object} { tokens: number, capacity: number }
   */
  getStatus(clientId) {
    const bucket = this._getBucket(clientId);
    this._refill(bucket);
    return {
      tokens: Math.floor(bucket.tokens),
      capacity: this.capacity
    };
  }
}

module.exports = { RateLimiter };
