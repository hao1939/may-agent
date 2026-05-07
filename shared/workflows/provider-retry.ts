/**
 * provider-retry.ts — Exponential backoff retry wrapper for provider calls.
 *
 * Distinguishes retryable errors (rate limit, timeout, 5xx) from
 * non-retryable (auth failures, 4xx client errors). Integrates with
 * circuit-breaker.ts — a final failure after all retries counts as
 * one circuit-breaker error, not N.
 *
 * Usage:
 *   import { withRetry, isRetryableError } from "./provider-retry.js";
 *
 *   const result = await withRetry(() => provider.chat(messages), {
 *     maxRetries: 3,
 *     baseDelayMs: 1000,
 *   });
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms, doubled each retry (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default: 30000) */
  maxDelayMs?: number;
  /** Optional callback on each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: unknown;
  attempts: number;
  totalDelayMs: number;
}

/** Error categories */
export type ErrorCategory = "retryable" | "non-retryable" | "unknown";

/**
 * Classify an error as retryable or not.
 * Retryable: rate limits (429), timeouts, server errors (5xx), network errors.
 * Non-retryable: auth (401/403), bad request (400), not found (404).
 */
export function classifyError(error: unknown): ErrorCategory {
  if (!error) return "unknown";

  // Check for status code (HTTP-style errors)
  const statusCode = getStatusCode(error);
  if (statusCode !== null) {
    if (statusCode === 429) return "retryable"; // rate limit
    if (statusCode >= 500) return "retryable"; // server error
    if (statusCode >= 400 && statusCode < 500) return "non-retryable"; // client error
  }

  // Check error message patterns
  const message = getErrorMessage(error).toLowerCase();

  // Some provider gateways wrap HTTP status codes inside the Error message
  // instead of exposing `status`/`statusCode` fields.
  if (/\b429\b/.test(message)) return "retryable";
  if (/\b5\d\d\b/.test(message)) return "retryable";
  if (/\b4\d\d\b/.test(message)) return "non-retryable";

  const retryablePatterns = [
    "timeout",
    "etimedout",
    "econnreset",
    "econnrefused",
    "socket hang up",
    "network",
    "rate limit",
    "too many requests",
    "service unavailable",
    "internal server error",
    "bad gateway",
    "gateway timeout",
    "overloaded",
    "capacity",
  ];

  const nonRetryablePatterns = [
    "unauthorized",
    "forbidden",
    "invalid api key",
    "authentication",
    "permission denied",
    "not found",
    "invalid request",
    "malformed",
  ];

  for (const pattern of nonRetryablePatterns) {
    if (message.includes(pattern)) return "non-retryable";
  }

  for (const pattern of retryablePatterns) {
    if (message.includes(pattern)) return "retryable";
  }

  return "unknown";
}

/**
 * Returns true if the error should be retried.
 * Unknown errors are treated as retryable (conservative approach).
 */
export function isRetryableError(error: unknown): boolean {
  const category = classifyError(error);
  return category !== "non-retryable";
}

/**
 * Execute a function with exponential backoff retry.
 * Only retries on retryable errors. Non-retryable errors fail immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    onRetry,
  } = options;

  let attempts = 0;
  let totalDelayMs = 0;

  while (true) {
    attempts++;
    try {
      const value = await fn();
      return { success: true, value, attempts, totalDelayMs };
    } catch (error) {
      // If non-retryable or out of retries, fail immediately
      if (!isRetryableError(error) || attempts > maxRetries) {
        return { success: false, error, attempts, totalDelayMs };
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempts - 1);
      const jitter = Math.random() * baseDelayMs * 0.5;
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      if (onRetry) {
        onRetry(error, attempts, delay);
      }

      totalDelayMs += delay;
      await sleep(delay);
    }
  }
}

/**
 * Wrap a provider call function to automatically retry on transient failures.
 * Returns a new function with the same signature but with retry behavior.
 */
export function withRetryWrapper<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const result = await withRetry(() => fn(...args), options);
    if (result.success) {
      return result.value as TResult;
    }
    throw result.error;
  };
}

// --- Helpers ---

function getStatusCode(error: unknown): number | null {
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.status === "number") return e.status;
    if (typeof e.statusCode === "number") return e.statusCode;
    if (typeof e.response === "object" && e.response !== null) {
      const resp = e.response as Record<string, unknown>;
      if (typeof resp.status === "number") return resp.status;
    }
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
  }
  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
