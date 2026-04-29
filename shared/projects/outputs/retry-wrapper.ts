/**
 * retry-wrapper.ts — Circuit-breaker-aware retry wrapper for LLM calls.
 *
 * Wraps any async function with:
 *   1. Circuit breaker check (fail fast if open)
 *   2. Exponential backoff retries (up to maxRetries)
 *   3. Circuit breaker recording (success/failure)
 *
 * Usage:
 *   import { createRetryWrapper } from "./retry-wrapper.js";
 *   const wrapper = createRetryWrapper({ maxRetries: 3, baseDelayMs: 1000 });
 *   const result = await wrapper.execute(() => callLLM(prompt), "my-agent");
 */

// ── Types ───────────────────────────────────────────────────────────

export interface RetryConfig {
  /** Max retry attempts after initial failure (default: 3) */
  maxRetries: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs: number;
  /** Max delay cap in ms (default: 30000) */
  maxDelayMs: number;
  /** Circuit breaker error threshold (default: 3) */
  circuitBreakerThreshold: number;
  /** Circuit breaker recovery timeout in ms (default: 60000) */
  circuitRecoveryMs: number;
}

export interface CircuitState {
  consecutiveFailures: number;
  lastFailureTime: number | null;
  state: "closed" | "open" | "half-open";
}

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
  circuitState: CircuitState;
}

// ── Pure functions (exported for testing) ───────────────────────────

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  circuitBreakerThreshold: 3,
  circuitRecoveryMs: 60000,
};

export function mergeConfig(partial: Partial<RetryConfig> = {}): RetryConfig {
  return { ...DEFAULT_CONFIG, ...partial };
}

export function createInitialCircuitState(): CircuitState {
  return { consecutiveFailures: 0, lastFailureTime: null, state: "closed" };
}

/**
 * Calculate delay for attempt N using exponential backoff with jitter.
 * delay = min(baseDelay * 2^attempt, maxDelay)
 */
export function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  return Math.min(exponential, maxDelayMs);
}

/**
 * Determine the effective circuit state based on failures and timing.
 */
export function getEffectiveCircuitState(
  circuit: CircuitState,
  threshold: number,
  recoveryMs: number,
  now: number
): "closed" | "open" | "half-open" {
  if (circuit.consecutiveFailures < threshold) return "closed";
  if (circuit.lastFailureTime === null) return "open";
  const elapsed = now - circuit.lastFailureTime;
  if (elapsed >= recoveryMs) return "half-open";
  return "open";
}

/**
 * Update circuit state after a success.
 */
export function recordSuccess(circuit: CircuitState): CircuitState {
  return { consecutiveFailures: 0, lastFailureTime: null, state: "closed" };
}

/**
 * Update circuit state after a failure.
 */
export function recordFailure(
  circuit: CircuitState,
  threshold: number,
  now: number
): CircuitState {
  const failures = circuit.consecutiveFailures + 1;
  const state = failures >= threshold ? "open" : "closed";
  return { consecutiveFailures: failures, lastFailureTime: now, state };
}

/**
 * Decide whether a retry should be attempted.
 */
export function shouldRetry(
  attempt: number,
  maxRetries: number,
  circuitEffectiveState: "closed" | "open" | "half-open"
): boolean {
  if (attempt >= maxRetries) return false;
  if (circuitEffectiveState === "open") return false;
  return true;
}

// ── Retry Wrapper Class ─────────────────────────────────────────────

export class RetryWrapper {
  private config: RetryConfig;
  private circuits: Map<string, CircuitState> = new Map();
  private sleepFn: (ms: number) => Promise<void>;

  constructor(
    config: Partial<RetryConfig> = {},
    sleepFn?: (ms: number) => Promise<void>
  ) {
    this.config = mergeConfig(config);
    this.sleepFn = sleepFn ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  getCircuit(key: string): CircuitState {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, createInitialCircuitState());
    }
    return this.circuits.get(key)!;
  }

  resetCircuit(key: string): void {
    this.circuits.set(key, createInitialCircuitState());
  }

  async execute<T>(
    fn: () => Promise<T>,
    circuitKey: string = "default"
  ): Promise<RetryResult<T>> {
    const circuit = this.getCircuit(circuitKey);
    const now = Date.now();

    // Check circuit state
    const effectiveState = getEffectiveCircuitState(
      circuit,
      this.config.circuitBreakerThreshold,
      this.config.circuitRecoveryMs,
      now
    );

    if (effectiveState === "open") {
      return {
        success: false,
        error: new Error(`Circuit breaker open for "${circuitKey}"`),
        attempts: 0,
        circuitState: circuit,
      };
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const value = await fn();
        const newCircuit = recordSuccess(circuit);
        this.circuits.set(circuitKey, newCircuit);
        return { success: true, value, attempts: attempt + 1, circuitState: newCircuit };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const updatedCircuit = recordFailure(
          this.getCircuit(circuitKey),
          this.config.circuitBreakerThreshold,
          Date.now()
        );
        this.circuits.set(circuitKey, updatedCircuit);

        const newEffective = getEffectiveCircuitState(
          updatedCircuit,
          this.config.circuitBreakerThreshold,
          this.config.circuitRecoveryMs,
          Date.now()
        );

        if (!shouldRetry(attempt + 1, this.config.maxRetries + 1, newEffective)) {
          return {
            success: false,
            error: lastError,
            attempts: attempt + 1,
            circuitState: updatedCircuit,
          };
        }

        const delay = calculateDelay(attempt, this.config.baseDelayMs, this.config.maxDelayMs);
        await this.sleepFn(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: this.config.maxRetries + 1,
      circuitState: this.getCircuit(circuitKey),
    };
  }
}

export function createRetryWrapper(
  config: Partial<RetryConfig> = {},
  sleepFn?: (ms: number) => Promise<void>
): RetryWrapper {
  return new RetryWrapper(config, sleepFn);
}
