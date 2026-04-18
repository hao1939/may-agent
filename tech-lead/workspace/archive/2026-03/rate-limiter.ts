// rate-limiter.ts — Token bucket rate limiter per channel

interface BucketState {
  tokens: number;
  lastRefill: number;
  limit: number;
}

export class RateLimiter {
  private buckets: Map<string, BucketState> = new Map();
  private refillIntervalMs: number;

  constructor(refillIntervalMs: number = 60000) {
    this.refillIntervalMs = refillIntervalMs;
  }

  tryAcquire(channel: string, limit: number): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(channel);

    if (!bucket) {
      bucket = { tokens: limit, lastRefill: now, limit };
      this.buckets.set(channel, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      const refills = Math.floor(elapsed / this.refillIntervalMs);
      bucket.tokens = Math.min(bucket.tokens + refills * bucket.limit, bucket.limit);
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    return false;
  }

  getRemaining(channel: string): number {
    const bucket = this.buckets.get(channel);
    if (!bucket) return 0;
    return bucket.tokens;
  }

  reset(channel: string): void {
    this.buckets.delete(channel);
  }

  resetAll(): void {
    this.buckets.clear();
  }
}
