/**
 * worker-retry.ts — Iteration-level retry logic for worker failures.
 *
 * When a worker iteration fails (throws an error or produces no output),
 * this module provides retry-with-backoff at the iteration level,
 * distinct from provider-retry.ts which handles API-level retries.
 */

export interface WorkerRetryOptions {
  /** Max retry attempts per iteration (default: 1) */
  maxRetries?: number;
  /** Base delay in ms before first retry (default: 2000) */
  baseDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Max delay cap in ms (default: 30000) */
  maxDelayMs?: number;
  /** Called on each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export interface WorkerRetryResult<T> {
  success: boolean;
  result?: T;
  attempts: number;
  errors: string[];
  totalDelayMs: number;
}

const DEFAULT_OPTIONS: Required<Omit<WorkerRetryOptions, 'onRetry'>> = {
  maxRetries: 1,
  baseDelayMs: 2000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
};

/**
 * Calculate delay for a given retry attempt using exponential backoff with jitter.
 */
export function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  backoffMultiplier: number,
  maxDelayMs: number,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  const capped = Math.min(exponentialDelay, maxDelayMs);
  // Add ±10% jitter to prevent thundering herd
  const jitter = capped * 0.1 * (2 * Math.random() - 1);
  return Math.max(0, Math.round(capped + jitter));
}

/**
 * Determine if a worker error is retryable.
 * Non-retryable: auth errors, invalid config, permission denied.
 * Retryable: timeouts, rate limits, transient failures, no output.
 */
export function isWorkerRetryable(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  
  // Non-retryable patterns
  const nonRetryable = [
    'authentication', 'auth failed', 'invalid api key',
    'permission denied', 'access denied', 'forbidden',
    'invalid config', 'configuration error',
  ];
  if (nonRetryable.some(p => msg.includes(p))) return false;

  // Retryable patterns
  const retryable = [
    'timeout', 'timed out', 'econnreset', 'econnrefused',
    'rate limit', '429', '500', '502', '503', '504',
    'network error', 'fetch failed', 'socket hang up',
    'no output', 'zero output', 'empty response',
  ];
  if (retryable.some(p => msg.includes(p))) return true;

  // Default: retry unknown errors (conservative — better to retry than fail)
  return true;
}

/**
 * Execute a worker function with iteration-level retry and exponential backoff.
 */
export async function withWorkerRetry<T>(
  fn: () => Promise<T>,
  opts: WorkerRetryOptions = {},
): Promise<WorkerRetryResult<T>> {
  const maxRetries = opts.maxRetries ?? DEFAULT_OPTIONS.maxRetries;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_OPTIONS.baseDelayMs;
  const backoffMultiplier = opts.backoffMultiplier ?? DEFAULT_OPTIONS.backoffMultiplier;
  const maxDelayMs = opts.maxDelayMs ?? DEFAULT_OPTIONS.maxDelayMs;

  const errors: string[] = [];
  let totalDelayMs = 0;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;

    try {
      const result = await fn();
      return { success: true, result, attempts, errors, totalDelayMs };
    } catch (error: unknown) {
      const errorMsg = String(error).slice(0, 200);
      errors.push(errorMsg);

      // Last attempt or non-retryable — give up
      if (attempt >= maxRetries || !isWorkerRetryable(error)) {
        return { success: false, attempts, errors, totalDelayMs };
      }

      // Calculate and apply backoff delay
      const delay = calculateDelay(attempt + 1, baseDelayMs, backoffMultiplier, maxDelayMs);
      totalDelayMs += delay;

      if (opts.onRetry) {
        opts.onRetry(error, attempt + 1, delay);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return { success: false, attempts, errors, totalDelayMs };
}
