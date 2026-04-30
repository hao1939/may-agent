/**
 * Retry with exponential backoff and circuit breaker utilities.
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
}

export interface CircuitBreakerOptions {
  threshold: number;
  resetMs: number;
}

export interface CircuitBreaker {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getState(): 'closed' | 'open' | 'half-open';
  reset(): void;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function computeDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, jitter: boolean): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  if (jitter) {
    return Math.floor(Math.random() * capped);
  }
  return capped;
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 100;
  const maxDelayMs = opts?.maxDelayMs ?? 10000;
  const jitter = opts?.jitter ?? false;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        const delay = computeDelay(attempt, baseDelayMs, maxDelayMs, jitter);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

export function createCircuitBreaker(opts: CircuitBreakerOptions): CircuitBreaker {
  let failures = 0;
  let state: 'closed' | 'open' | 'half-open' = 'closed';
  let openedAt = 0;

  return {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (state === 'open') {
        if (Date.now() - openedAt >= opts.resetMs) {
          state = 'half-open';
        } else {
          throw new Error('Circuit breaker is open');
        }
      }

      try {
        const result = await fn();
        // Success: reset
        failures = 0;
        state = 'closed';
        return result;
      } catch (err) {
        failures++;
        if (failures >= opts.threshold) {
          state = 'open';
          openedAt = Date.now();
        }
        throw err;
      }
    },

    getState() {
      if (state === 'open' && Date.now() - openedAt >= opts.resetMs) {
        return 'half-open';
      }
      return state;
    },

    reset() {
      failures = 0;
      state = 'closed';
      openedAt = 0;
    }
  };
}
