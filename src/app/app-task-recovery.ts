import type { AppTaskLane } from "./core/tasks/queue.js";
import type { IndexedTaskCandidatePage, IndexedTaskRecoveryCursor } from "./app-task-resource-store.js";
import { OwnedTimer } from "./core/scheduling/timer.js";

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
      if (force || next === null) {
        this.dueTimer.cancel();
        this.dueAt = undefined;
      }
      return;
    }
    if (!force && this.dueTimer.armed && this.dueAt === next) return;
    this.dueAt = next;
    this.dueTimer.after(Math.max(1, next - this.now()), () => {
      this.dueAt = undefined;
      this.recover();
      // Re-arming waits for the task transition or the safety query. A still-
      // due row must not create a zero-delay timer loop.
    });
  }
}
