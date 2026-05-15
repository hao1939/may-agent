import { describe, it, expect, vi } from 'bun:test';
import {
  withWorkerRetry,
  isWorkerRetryable,
  calculateDelay,
} from '../workflows/worker-retry.ts';

describe('calculateDelay', () => {
  it('returns base delay for first attempt', () => {
    const delay = calculateDelay(1, 2000, 2, 30000);
    // Base delay ± 10% jitter: 1800-2200
    expect(delay).toBeGreaterThanOrEqual(1800);
    expect(delay).toBeLessThanOrEqual(2200);
  });

  it('doubles delay for second attempt', () => {
    // attempt 2: 2000 * 2^1 = 4000 ± 10%
    const delays = Array.from({ length: 20 }, () => calculateDelay(2, 2000, 2, 30000));
    const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
    expect(avg).toBeGreaterThan(3500);
    expect(avg).toBeLessThan(4500);
  });

  it('caps at maxDelayMs', () => {
    const delay = calculateDelay(10, 2000, 2, 5000);
    // Should be capped at 5000 ± 10%
    expect(delay).toBeLessThanOrEqual(5500);
  });

  it('never returns negative', () => {
    for (let i = 0; i < 50; i++) {
      expect(calculateDelay(1, 100, 2, 30000)).toBeGreaterThanOrEqual(0);
    }
  });

  it('respects custom backoff multiplier', () => {
    // attempt 3 with multiplier 3: 1000 * 3^2 = 9000 ± 10%
    const delays = Array.from({ length: 20 }, () => calculateDelay(3, 1000, 3, 30000));
    const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
    expect(avg).toBeGreaterThan(8000);
    expect(avg).toBeLessThan(10000);
  });
});

describe('isWorkerRetryable', () => {
  it('returns true for timeout errors', () => {
    expect(isWorkerRetryable(new Error('Request timed out'))).toBe(true);
  });

  it('returns true for rate limit errors', () => {
    expect(isWorkerRetryable(new Error('rate limit exceeded 429'))).toBe(true);
  });

  it('returns true for network errors', () => {
    expect(isWorkerRetryable(new Error('ECONNRESET'))).toBe(true);
    expect(isWorkerRetryable(new Error('socket hang up'))).toBe(true);
  });

  it('returns false for auth errors', () => {
    expect(isWorkerRetryable(new Error('Authentication failed'))).toBe(false);
  });

  it('returns false for permission denied', () => {
    expect(isWorkerRetryable(new Error('Permission denied'))).toBe(false);
  });

  it('returns false for invalid config', () => {
    expect(isWorkerRetryable(new Error('Invalid config: missing key'))).toBe(false);
  });

  it('returns true for unknown errors (conservative)', () => {
    expect(isWorkerRetryable(new Error('something weird happened'))).toBe(true);
  });

  it('handles non-Error objects', () => {
    expect(isWorkerRetryable('timeout')).toBe(true);
    expect(isWorkerRetryable(42)).toBe(true);
    expect(isWorkerRetryable(null)).toBe(true);
  });

  it('returns true for 5xx status codes', () => {
    expect(isWorkerRetryable(new Error('HTTP 502 Bad Gateway'))).toBe(true);
    expect(isWorkerRetryable(new Error('HTTP 503 Service Unavailable'))).toBe(true);
  });

  it('returns true for empty response errors', () => {
    expect(isWorkerRetryable(new Error('no output produced'))).toBe(true);
    expect(isWorkerRetryable(new Error('zero output files'))).toBe(true);
  });
});

describe('withWorkerRetry', () => {
  it('succeeds on first attempt', async () => {
    const result = await withWorkerRetry(async () => 'ok');
    expect(result.success).toBe(true);
    expect(result.result).toBe('ok');
    expect(result.attempts).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('retries once on failure then succeeds', async () => {
    let calls = 0;
    const result = await withWorkerRetry(async () => {
      calls++;
      if (calls === 1) throw new Error('timeout');
      return 'recovered';
    }, { maxRetries: 1, baseDelayMs: 10 });
    expect(result.success).toBe(true);
    expect(result.result).toBe('recovered');
    expect(result.attempts).toBe(2);
    expect(result.errors).toHaveLength(1);
  });

  it('fails after exhausting retries', async () => {
    const result = await withWorkerRetry(async () => {
      throw new Error('always fails');
    }, { maxRetries: 2, baseDelayMs: 10 });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.errors).toHaveLength(3);
  });

  it('does not retry non-retryable errors', async () => {
    const result = await withWorkerRetry(async () => {
      throw new Error('Authentication failed');
    }, { maxRetries: 3, baseDelayMs: 10 });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('calls onRetry callback', async () => {
    const retries: number[] = [];
    let calls = 0;
    await withWorkerRetry(async () => {
      calls++;
      if (calls <= 2) throw new Error('fail');
      return 'ok';
    }, {
      maxRetries: 3,
      baseDelayMs: 10,
      onRetry: (_err, attempt) => retries.push(attempt),
    });
    expect(retries).toEqual([1, 2]);
  });

  it('tracks totalDelayMs', async () => {
    let calls = 0;
    const result = await withWorkerRetry(async () => {
      calls++;
      if (calls === 1) throw new Error('fail');
      return 'ok';
    }, { maxRetries: 1, baseDelayMs: 50, backoffMultiplier: 1 });
    expect(result.totalDelayMs).toBeGreaterThan(0);
  });

  it('uses default options when none provided', async () => {
    const result = await withWorkerRetry(async () => 'default');
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it('returns all error messages', async () => {
    let i = 0;
    const result = await withWorkerRetry(async () => {
      throw new Error(`error-${++i}`);
    }, { maxRetries: 2, baseDelayMs: 10 });
    expect(result.errors[0]).toContain('error-1');
    expect(result.errors[1]).toContain('error-2');
    expect(result.errors[2]).toContain('error-3');
  });

  it('respects maxRetries: 0 (no retries)', async () => {
    const result = await withWorkerRetry(async () => {
      throw new Error('fail');
    }, { maxRetries: 0, baseDelayMs: 10 });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it('handles async functions that return complex objects', async () => {
    const result = await withWorkerRetry(async () => ({ files: ['a.ts', 'b.ts'], count: 2 }));
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ files: ['a.ts', 'b.ts'], count: 2 });
  });
});
