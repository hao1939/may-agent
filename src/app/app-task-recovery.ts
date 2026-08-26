import type { AppTaskLane } from "./app-task-queue.js";
import type { IndexedTaskCandidatePage, IndexedTaskRecoveryCursor } from "./app-task-resource-store.js";

export type IndexedTaskRecoverySource = {
  listRecoveryCandidates(now?: number, limit?: number, after?: IndexedTaskRecoveryCursor): IndexedTaskCandidatePage;
  nextDueAt(): number | null;
};

export type AppTaskRecoverySchedulerOptions = {
  source: IndexedTaskRecoverySource;
  enqueue(taskId: string, options: { lane: AppTaskLane }): void;
  safetyIntervalMs?: number;
  pageSize?: number;
  now?: () => number;
};

/**
 * Indexed recovery insurance. Events remain the normal trigger; this owns one
 * nearest-due timer and one bounded safety query, never an App-wide scan.
 */
export class AppTaskRecoveryScheduler {
  private readonly safetyIntervalMs: number;
  private readonly pageSize: number;
  private readonly now: () => number;
  private safetyTimer?: ReturnType<typeof setInterval>;
  private dueTimer?: ReturnType<typeof setTimeout>;
  private dueAt?: number;
  private recoveryCursor?: IndexedTaskRecoveryCursor;
  private closed = false;

  constructor(private readonly options: AppTaskRecoverySchedulerOptions) {
    this.safetyIntervalMs = Math.max(1_000, options.safetyIntervalMs ?? 45_000);
    this.pageSize = Math.max(1, Math.min(10_000, Math.floor(options.pageSize ?? 256)));
    this.now = options.now ?? Date.now;
  }

  start(): void {
    if (this.closed || this.safetyTimer) return;
    this.recover();
    this.armNearestDue();
    this.safetyTimer = setInterval(() => {
      this.recover();
      this.armNearestDue();
    }, this.safetyIntervalMs);
    this.safetyTimer.unref?.();
  }

  /** Call after a task records a new next-check time or clears the current one. */
  stateChanged(): void {
    if (this.closed) return;
    this.armNearestDue(true);
  }

  close(): void {
    this.closed = true;
    if (this.safetyTimer) clearInterval(this.safetyTimer);
    if (this.dueTimer) clearTimeout(this.dueTimer);
    this.safetyTimer = undefined;
    this.dueTimer = undefined;
    this.dueAt = undefined;
  }

  recover(): number {
    if (this.closed) return 0;
    const page = this.options.source.listRecoveryCandidates(this.now(), this.pageSize, this.recoveryCursor);
    this.recoveryCursor = page.nextCursor ?? undefined;
    for (const candidate of page.items) {
      this.options.enqueue(candidate.taskId, {
        lane: candidate.lane,
      });
    }
    return page.items.length;
  }

  private armNearestDue(force = false): void {
    const next = this.options.source.nextDueAt();
    if (next === null || next <= this.now()) {
      if (force && this.dueTimer) clearTimeout(this.dueTimer);
      if (force || next === null) {
        this.dueTimer = undefined;
        this.dueAt = undefined;
      }
      return;
    }
    if (!force && this.dueTimer && this.dueAt === next) return;
    if (this.dueTimer) clearTimeout(this.dueTimer);
    this.dueAt = next;
    this.dueTimer = setTimeout(
      () => {
        this.dueTimer = undefined;
        this.dueAt = undefined;
        this.recover();
        // Re-arming waits for the task transition or the safety query. A still-
        // due row must not create a zero-delay timer loop.
      },
      Math.max(1, next - this.now()),
    );
    this.dueTimer.unref?.();
  }
}
