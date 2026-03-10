/**
 * RetryHandler — Manages retry logic with exponential backoff
 * for unreliable external service calls.
 *
 * Coder claims: "Added jitter to prevent thundering herd, all tests pass."
 */

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number; // 0.0 - 1.0
  retryableErrors?: string[];
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  attempts: number;
  lastError?: Error;
  totalDelayMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.25,
};

export class RetryHandler {
  private options: RetryOptions;
  private attemptLog: Array<{ attempt: number; delayMs: number; error?: string }> = [];

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.validateOptions();
  }

  private validateOptions(): void {
    if (this.options.maxRetries < 0) {
      throw new Error('maxRetries must be non-negative');
    }
    if (this.options.baseDelayMs <= 0) {
      throw new Error('baseDelayMs must be positive');
    }
    if (this.options.maxDelayMs < this.options.baseDelayMs) {
      throw new Error('maxDelayMs must be >= baseDelayMs');
    }
    if (this.options.jitterFactor < 0 || this.options.jitterFactor > 1) {
      throw new Error('jitterFactor must be between 0 and 1');
    }
  }

  /**
   * Calculate delay for a given attempt using exponential backoff with jitter.
   * Formula: min(maxDelay, baseDelay * 2^attempt) * (1 + random * jitter)
   */
  calculateDelay(attempt: number): number {
    const exponentialDelay = this.options.baseDelayMs * Math.pow(2, attempt);
    const cappedDelay = Math.min(this.options.maxDelayMs, exponentialDelay);
    const jitter = 1 + Math.random() * this.options.jitterFactor;
    return Math.floor(cappedDelay * jitter);
  }

  /**
   * Check whether an error is retryable based on configured error list.
   */
  private isRetryable(error: Error): boolean {
    if (!this.options.retryableErrors || this.options.retryableErrors.length === 0) {
      return true; // retry all errors by default
    }
    return this.options.retryableErrors.some(
      (pattern) => error.message.includes(pattern) || error.name.includes(pattern)
    );
  }

  /**
   * Execute an async function with retry logic.
   */
  async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    let lastError: Error | undefined;
    let totalDelayMs = 0;
    this.attemptLog = [];

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt);
          totalDelayMs += delay;
          this.attemptLog.push({ attempt, delayMs: delay });
          await this.sleep(delay);
        } else {
          this.attemptLog.push({ attempt, delayMs: 0 });
        }

        const result = await fn();
        return {
          success: true,
          result,
          attempts: attempt + 1,
          totalDelayMs,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.attemptLog[this.attemptLog.length - 1].error = lastError.message;

        if (!this.isRetryable(lastError)) {
          return {
            success: false,
            attempts: attempt + 1,
            lastError,
            totalDelayMs,
          };
        }
      }
    }

    return {
      success: false,
      attempts: this.options.maxRetries + 1,
      lastError,
      totalDelayMs,
    };
  }

  /**
   * Execute multiple functions in parallel, each with independent retry logic.
   */
  async executeAll<T>(fns: Array<() => Promise<T>>): Promise<RetryResult<T>[]> {
    return Promise.all(fns.map((fn) => this.execute(fn)));
  }

  /**
   * Get the log of all attempts from the last execution.
   */
  getAttemptLog(): Array<{ attempt: number; delayMs: number; error?: string }> {
    return [...this.attemptLog];
  }

  /**
   * Reset handler state. Useful when reusing across different operations.
   */
  reset(): void {
    this.attemptLog = [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Convenience wrapper for one-off retries without instantiating a handler.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const handler = new RetryHandler(options);
  const result = await handler.execute(fn);
  if (result.success && result.result !== undefined) {
    return result.result;
  }
  throw result.lastError || new Error('Retry failed with no error captured');
}
