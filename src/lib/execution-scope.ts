/** One invocation's limits. No storage, Task lifecycle, provider or retry policy. */
export const DEFAULT_EXECUTION_TIMEOUT_MS = 30 * 60_000;

export function executionTimeout(timeoutMs = DEFAULT_EXECUTION_TIMEOUT_MS, deadlineAt?: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new Error("Execution timeout must be a positive bounded timer duration");
  }
  if (deadlineAt === undefined) return timeoutMs;
  const remaining = deadlineAt - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error("Caller execution deadline expired");
  return Math.min(timeoutMs, remaining);
}

export class ExecutionScope {
  private readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  readonly timeoutMs: number;
  readonly deadlineAt: number;
  timedOut = false;
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly parentAbort: () => void;

  constructor(
    timeoutMs?: number,
    private readonly parentSignal?: AbortSignal,
    deadlineAt?: number,
    private readonly onStop?: (reason: Error) => void,
  ) {
    parentSignal?.throwIfAborted();
    this.timeoutMs = executionTimeout(timeoutMs, deadlineAt);
    this.deadlineAt = Date.now() + this.timeoutMs;
    this.parentAbort = () => this.stop(new Error("Caller execution stopped", { cause: parentSignal?.reason }));
    parentSignal?.addEventListener("abort", this.parentAbort, { once: true });
    this.timer = setTimeout(() => {
      this.timedOut = true;
      this.stop(new Error(`Agent timed out after ${this.timeoutMs}ms`));
    }, this.timeoutMs);
    this.timer.unref?.();
  }

  stop(reason = new Error("Execution cancelled")): void {
    if (this.signal.aborted) return;
    this.controller.abort(reason);
    this.onStop?.(reason);
  }

  close(): void {
    clearTimeout(this.timer);
    this.parentSignal?.removeEventListener("abort", this.parentAbort);
    // Remaining scoped children stop too; completing this invocation is not
    // cancellation of its already accepted result.
    this.controller.abort(new Error("Caller execution finished"));
  }
}
