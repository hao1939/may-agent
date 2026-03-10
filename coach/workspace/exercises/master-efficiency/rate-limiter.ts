/**
 * Rate limiter with sliding window algorithm.
 * Tracks request counts within a time window and enforces rate limits.
 */
export class RateLimiter {
  private windows: Map<string, { timestamps: number[]; limit: number }> = new Map();

  /**
   * Create a rate limiter.
   * @param defaultLimit - Default requests allowed per window
   * @param windowMs - Window duration in milliseconds
   */
  constructor(
    private defaultLimit: number = 100,
    private windowMs: number = 60_000
  ) {}

  /**
   * Register a client with an optional custom limit.
   */
  register(clientId: string, limit?: number): void {
    this.windows.set(clientId, {
      timestamps: [],
      limit: limit ?? this.defaultLimit,
    });
  }

  /**
   * Check if a request is allowed for the given client.
   * Returns true if under the limit, false if rate-limited.
   * Automatically registers unknown clients with the default limit.
   */
  allow(clientId: string, now: number = Date.now()): boolean {
    if (!this.windows.has(clientId)) {
      this.register(clientId);
    }

    const window = this.windows.get(clientId)!;
    const cutoff = now - this.windowMs;

    // Prune expired timestamps
    window.timestamps = window.timestamps.filter((t) => t > cutoff);

    // BUG: off-by-one — should be >= limit (at limit means full)
    if (window.timestamps.length >= window.limit) {
      return false;
    }

    window.timestamps.push(now);
    return true;
  }

  /**
   * Get remaining requests for a client in the current window.
   */
  remaining(clientId: string, now: number = Date.now()): number {
    const window = this.windows.get(clientId);
    if (!window) return this.defaultLimit;

    const cutoff = now - this.windowMs;
    const active = window.timestamps.filter((t) => t > cutoff).length;
    return Math.max(0, window.limit - active);
  }

  /**
   * Reset a specific client's window.
   */
  reset(clientId: string): void {
    const window = this.windows.get(clientId);
    if (window) {
      window.timestamps = [];
    }
  }

  /**
   * Get the number of registered clients.
   */
  get size(): number {
    return this.windows.size;
  }
}
