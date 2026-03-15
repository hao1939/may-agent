/**
 * retry-with-backoff.ts — Generic exponential backoff retry wrapper.
 *
 * Wraps any async operation with configurable retry logic using exponential
 * backoff with optional jitter. Useful for transient failures in network
 * calls, file I/O, or external API interactions.
 *
 * Design: Standalone pure utility with zero coupling to other modules.
 * All behavior is configurable via the options parameter.
 */

// ── Types ──────────────────────────────────────────────────────────────

/** Options for configuring retry behavior. */
export interface RetryWithBackoffOptions {
  /** Maximum number of retry attempts (not counting the initial call). Default: 3. */
  maxRetries?: number;
  /** Base delay in milliseconds before the first retry. Default: 1000. */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (caps exponential growth). Default: 30000. */
  maxDelayMs?: number;
  /** Exponential backoff multiplier applied per retry. Default: 2. */
  multiplier?: number;
  /** Whether to add random jitter (0–50% of delay) to prevent thundering herd. Default: true. */
  jitter?: boolean;
  /**
   * Optional predicate to decide whether a given error is retryable.
   * Return `true` to retry, `false` to fail immediately.
   * Default: all errors are retryable.
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /**
   * Optional callback invoked before each retry attempt.
   * Useful for logging. `attempt` is 1-indexed (1 = first retry).
   */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** AbortSignal to cancel retries early. */
  signal?: AbortSignal;
}

// ── Defaults ───────────────────────────────────────────────────────────

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_MULTIPLIER = 2;

// ── Implementation ─────────────────────────────────────────────────────

/**
 * Execute an async operation with exponential backoff retry logic.
 *
 * On failure, waits `baseDelayMs * multiplier^(attempt-1)` (capped at `maxDelayMs`)
 * before each retry. Optional jitter adds 0–50% randomness to the delay.
 *
 * @typeParam T - The return type of the async operation.
 * @param fn - The async function to execute. Receives the current attempt number (0-indexed).
 * @param options - Configuration for retry behavior. All fields are optional.
 * @returns The result of the first successful call to `fn`.
 * @throws The last error if all attempts are exhausted, or immediately if
 *         `shouldRetry` returns false or the signal is aborted.
 *
 * @example
 * ```ts
 * const data = await retryWithBackoff(
 *   () => fetch("https://api.example.com/data").then(r => r.json()),
 *   { maxRetries: 3, baseDelayMs: 500, shouldRetry: (err) => err instanceof TypeError }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options?: RetryWithBackoffOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const multiplier = options?.multiplier ?? DEFAULT_MULTIPLIER;
  const jitter = options?.jitter ?? true;
  const shouldRetry = options?.shouldRetry;
  const onRetry = options?.onRetry;
  const signal = options?.signal;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check abort before each attempt
    if (signal?.aborted) {
      throw signal.reason ?? new Error("Retry aborted");
    }

    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      // If this was the last attempt, don't bother checking retry logic
      if (attempt >= maxRetries) break;

      // Check if error is retryable
      if (shouldRetry && !shouldRetry(err, attempt + 1)) {
        break;
      }

      // Calculate delay: baseDelay * multiplier^attempt, capped at maxDelay
      let delayMs = Math.min(baseDelayMs * Math.pow(multiplier, attempt), maxDelayMs);

      // Add jitter: 0–50% of the calculated delay
      if (jitter) {
        delayMs += Math.random() * delayMs * 0.5;
      }

      // Notify before sleeping
      onRetry?.(err, attempt + 1, delayMs);

      // Sleep with abort support
      await sleep(delayMs, signal);
    }
  }

  throw lastError;
}

/**
 * Sleep for the given duration, respecting an optional AbortSignal.
 *
 * @param ms - Duration in milliseconds.
 * @param signal - Optional AbortSignal to cancel the sleep early.
 * @throws The signal's reason if aborted during sleep.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Retry aborted"));
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("Retry aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });

      // Clean up the abort listener when timer fires normally
      const wrappedResolve = () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      clearTimeout(timer);
      setTimeout(wrappedResolve, ms);
    }
  });
}
