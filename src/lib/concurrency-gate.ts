/**
 * concurrency-gate.ts — In-memory semaphore for gating high-impact tool execution.
 *
 * P162: Prevents resource starvation by limiting concurrent execution of
 * heavy tools (bash, write, edit) across all sessions.
 *
 * Research basis: AgentCgroup (arXiv:2602.09345) shows 56-74% of agent
 * latency is OS-level tool execution, with 15.4x peak-to-average memory spikes.
 * Unlimited concurrent tool execution risks OOM/CPU starvation.
 *
 * Design: Simple counting semaphore with configurable max concurrency.
 * Waiters are queued FIFO and resolved when a slot opens.
 */

/** Options for creating a ConcurrencyGate. */
export interface ConcurrencyGateOptions {
  /** Maximum number of concurrent executions allowed. Default: 1. */
  maxConcurrent?: number;
  /** Maximum time (ms) to wait for a slot before returning an error. 0 = no timeout. Default: 30000. */
  waitTimeoutMs?: number;
}

/** Stats snapshot for monitoring. */
export interface ConcurrencyGateStats {
  /** Current number of active (running) gated operations. */
  active: number;
  /** Current number of waiters in the queue. */
  waiting: number;
  /** Maximum concurrency limit. */
  maxConcurrent: number;
}

/**
 * ConcurrencyGate — async semaphore for limiting concurrent tool execution.
 *
 * Usage:
 *   const gate = new ConcurrencyGate({ maxConcurrent: 1 });
 *   const release = await gate.acquire();  // blocks if at capacity
 *   try { await doWork(); } finally { release(); }
 */
export class ConcurrencyGate {
  private _maxConcurrent: number;
  private _waitTimeoutMs: number;
  private _active = 0;
  private _queue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

  constructor(opts?: ConcurrencyGateOptions) {
    this._maxConcurrent = opts?.maxConcurrent ?? 1;
    this._waitTimeoutMs = opts?.waitTimeoutMs ?? 30_000;
  }

  /** Current stats for monitoring/logging. */
  get stats(): ConcurrencyGateStats {
    return {
      active: this._active,
      waiting: this._queue.length,
      maxConcurrent: this._maxConcurrent,
    };
  }

  /**
   * Acquire a slot. Returns a release function that MUST be called when done.
   * If at capacity, blocks until a slot opens or timeout expires.
   *
   * @throws Error if timeout expires while waiting.
   */
  async acquire(): Promise<() => void> {
    if (this._active < this._maxConcurrent) {
      this._active++;
      return this._createRelease();
    }

    // At capacity — queue up and wait
    return new Promise<() => void>((resolve, reject) => {
      const waiter = { resolve: () => { /* overwritten below */ }, reject };

      let timer: ReturnType<typeof setTimeout> | null = null;

      if (this._waitTimeoutMs > 0) {
        timer = setTimeout(() => {
          // Remove from queue
          const idx = this._queue.indexOf(waiter);
          if (idx !== -1) this._queue.splice(idx, 1);
          reject(new Error(`ConcurrencyGate: timed out after ${this._waitTimeoutMs}ms waiting for slot`));
        }, this._waitTimeoutMs);
      }

      waiter.resolve = () => {
        if (timer) clearTimeout(timer);
        this._active++;
        resolve(this._createRelease());
      };

      this._queue.push(waiter);
    });
  }

  /** Create the release function for a slot holder. */
  private _createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return; // idempotent
      released = true;
      this._active--;

      // Wake the next waiter, if any
      if (this._queue.length > 0) {
        const next = this._queue.shift()!;
        next.resolve();
      }
    };
  }
}

/**
 * Default high-impact tools that should be gated.
 * These are the STATE_CHANGING_TOOLS from manager-receipts.ts —
 * tools that modify the filesystem or execute arbitrary commands.
 */
export const HIGH_IMPACT_TOOLS = new Set(["bash", "write", "edit"]);

/** Singleton gate instance shared across all sessions. */
let _defaultGate: ConcurrencyGate | null = null;

/**
 * Get the default (singleton) concurrency gate.
 * Lazily created on first call. Shared across all sessions in the process.
 */
export function getDefaultGate(opts?: ConcurrencyGateOptions): ConcurrencyGate {
  if (!_defaultGate) {
    _defaultGate = new ConcurrencyGate(opts);
  }
  return _defaultGate;
}

/**
 * Reset the default gate (for testing only).
 */
export function resetDefaultGate(): void {
  _defaultGate = null;
}
