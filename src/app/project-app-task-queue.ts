/**
 * A small level-triggered work queue for one Agent App.
 *
 * Queue entries are task IDs only. Resource state remains in the task store.
 * Repeated wakes collapse while pending; a wake received during reconciliation
 * schedules exactly one fresh pass after the current pass completes.
 */
export class ProjectAppTaskQueue {
  private readonly pending: string[] = [];
  private readonly queued = new Set<string>();
  private readonly running = new Set<string>();
  private readonly dirty = new Set<string>();

  constructor(readonly maxConcurrent: number) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("ProjectAppTaskQueue maxConcurrent must be a positive integer");
    }
  }

  enqueue(taskId: string): boolean {
    const key = taskId.trim();
    if (!key) throw new Error("ProjectAppTaskQueue requires a non-empty task ID");
    if (this.running.has(key)) {
      const alreadyDirty = this.dirty.has(key);
      this.dirty.add(key);
      return !alreadyDirty;
    }
    if (this.queued.has(key)) return false;
    this.queued.add(key);
    this.pending.push(key);
    return true;
  }

  take(): string | null {
    if (this.running.size >= this.maxConcurrent) return null;
    const taskId = this.pending.shift();
    if (!taskId) return null;
    this.queued.delete(taskId);
    this.running.add(taskId);
    return taskId;
  }

  complete(taskId: string): void {
    if (!this.running.delete(taskId)) {
      throw new Error(`ProjectAppTaskQueue cannot complete task that is not running: ${taskId}`);
    }
    if (this.dirty.delete(taskId)) this.enqueue(taskId);
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get runningCount(): number {
    return this.running.size;
  }

  hasWork(): boolean {
    return this.pending.length > 0 || this.running.size > 0;
  }

  snapshot(): { pending: string[]; running: string[]; dirty: string[] } {
    return {
      pending: [...this.pending],
      running: [...this.running],
      dirty: [...this.dirty],
    };
  }
}
