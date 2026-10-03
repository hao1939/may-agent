/** One invocation's limits. No storage, Task lifecycle, provider or retry policy. */
export const DEFAULT_EXECUTION_TIMEOUT_MS = 30 * 60_000;

/** A work stop leaves the model alive to judge and submit its existing result. */
export class ExecutionWorkEnded extends Error {
  constructor() {
    super(
      "Execution work allowance ended. Use retained evidence and call finish(); unfinished or interrupted work remains incomplete.",
    );
    this.name = "ExecutionWorkEnded";
  }
}

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
  private readonly workController = new AbortController();
  readonly signal = this.controller.signal;
  readonly workSignal = this.workController.signal;
  readonly timeoutMs: number;
  readonly deadlineAt: number;
  readonly workDeadlineAt: number;
  timedOut = false;
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly workTimer?: ReturnType<typeof setTimeout>;
  private readonly parentAbort: () => void;

  constructor(
    timeoutMs?: number,
    private readonly parentSignal?: AbortSignal,
    deadlineAt?: number,
    private readonly onStop?: (reason: Error) => void,
    onFinishRequested?: () => void,
  ) {
    parentSignal?.throwIfAborted();
    this.timeoutMs = executionTimeout(timeoutMs, deadlineAt);
    this.deadlineAt = Date.now() + this.timeoutMs;
    // Reserve at most one minute, or one fifth of a short invocation. This is
    // part of the existing allowance, never a timeout extension.
    const finishMs = onFinishRequested ? Math.min(60_000, Math.floor(this.timeoutMs / 5)) : 0;
    this.workDeadlineAt = this.deadlineAt - finishMs;
    this.parentAbort = () => {
      const reason = parentSignal?.reason;
      // Preserve the work-stop distinction at every depth so joined helper
      // evidence can return while ordinary cancellation still interrupts.
      this.stop(
        reason instanceof ExecutionWorkEnded ? reason : new Error("Caller execution stopped", { cause: reason }),
      );
    };
    parentSignal?.addEventListener("abort", this.parentAbort, { once: true });
    this.timer = setTimeout(() => {
      this.timedOut = true;
      this.stop(new Error(`Agent timed out after ${this.timeoutMs}ms`));
    }, this.timeoutMs);
    this.timer.unref?.();
    if (finishMs > 0) {
      this.workTimer = setTimeout(() => {
        if (this.signal.aborted) return;
        this.workController.abort(new ExecutionWorkEnded());
        onFinishRequested?.();
      }, this.timeoutMs - finishMs);
      this.workTimer.unref?.();
    }
  }

  stop(reason = new Error("Execution cancelled")): void {
    if (this.signal.aborted) return;
    this.controller.abort(reason);
    this.workController.abort(reason);
    this.onStop?.(reason);
  }

  close(): void {
    clearTimeout(this.timer);
    clearTimeout(this.workTimer);
    this.parentSignal?.removeEventListener("abort", this.parentAbort);
    // Remaining scoped children stop too; completing this invocation is not
    // cancellation of its already accepted result.
    this.controller.abort(new Error("Caller execution finished"));
    this.workController.abort(this.signal.reason);
  }
}
