import type { AppTaskLane } from "./queue.js";
import type { IndexedTaskCandidatePage, IndexedTaskRecoveryCursor } from "../state/app-task-resource-store.js";
import { OwnedTimer } from "../scheduling/timer.js";

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
  private readonly safetyTimer = new OwnedTimer("task-recovery:safety");
  private readonly dueTimer = new OwnedTimer("task-recovery:due");
  private dueAt?: number;
  private lastRecoveryAt?: number;
  private recoveryCursor?: IndexedTaskRecoveryCursor;
  private closed = false;

  constructor(private readonly options: AppTaskRecoverySchedulerOptions) {
    this.safetyIntervalMs = Math.max(1_000, options.safetyIntervalMs ?? 45_000);
    this.pageSize = Math.max(1, Math.min(10_000, Math.floor(options.pageSize ?? 256)));
    this.now = options.now ?? Date.now;
  }

  start(): void {
    if (this.closed || this.safetyTimer.armed) return;
    this.recover();
    this.armNearestDue();
    this.safetyTimer.every(this.safetyIntervalMs, () => {
      this.recover();
      this.armNearestDue();
    });
  }

  /** Call after a task records a new next-check time or clears the current one. */
  stateChanged(): void {
    if (this.closed) return;
    this.armNearestDue(true);
  }

  close(): void {
    this.closed = true;
    this.safetyTimer.close();
    this.dueTimer.close();
    this.dueAt = undefined;
  }

  recover(): number {
    if (this.closed) return 0;
    const recoveryAt = this.now();
    const page = this.options.source.listRecoveryCandidates(recoveryAt, this.pageSize, this.recoveryCursor);
    this.lastRecoveryAt = recoveryAt;
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
    if (next === null) {
      this.dueTimer.cancel();
      this.dueAt = undefined;
      return;
    }
    // A synchronous transition may finish after another Task's deadline.
    // Query that overdue work once; do not defer it to the long safety scan.
    // Suppress only rows that were already due for the last recovery query.
    // If the clock crossed the deadline after that query, re-arm immediately.
    const now = this.now();
    if (next <= now && !force && this.lastRecoveryAt !== undefined && next <= this.lastRecoveryAt) return;
    if (!force && this.dueTimer.armed && this.dueAt === next) return;
    this.dueAt = next;
    this.dueTimer.after(Math.max(1, next - now), () => {
      this.dueAt = undefined;
      this.recover();
      // Timers may fire just before the persisted millisecond deadline. Re-arm
      // only when the row is still in the future; armNearestDue deliberately
      // leaves an unchanged due row for the task transition or safety query.
      this.armNearestDue();
    });
  }
}
