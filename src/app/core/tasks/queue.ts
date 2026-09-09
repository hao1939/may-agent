/**
 * Core level-triggered work queue for one App.
 *
 * Queue entries are task IDs only. Resource state remains in the task store.
 * Repeated wakes collapse while pending; a wake received during reconciliation
 * schedules exactly one fresh pass after the current pass completes.
 */
export class AppTaskQueue {
  private readonly pending: string[] = [];
  private readonly queued = new Set<string>();
  private readonly promotedQueued = new Set<string>();
  private readonly running = new Set<string>();
  private readonly dirty = new Set<string>();
  private readonly dirtyPromote = new Set<string>();
  private readonly priorities = new Map<string, AppTaskPriority>();
  private readonly dirtyPriorities = new Map<string, AppTaskPriority>();
  private readonly lanes = new Map<string, AppTaskLane>();
  private readonly dirtyLanes = new Map<string, AppTaskLane>();

  constructor(private concurrency: number) {
    this.validateMaxConcurrent(concurrency);
  }

  get maxConcurrent(): number {
    return this.concurrency;
  }

  /** Change the App-local limit without replacing the queue or its running work. */
  updateMaxConcurrent(maxConcurrent: number): void {
    this.validateMaxConcurrent(maxConcurrent);
    this.concurrency = maxConcurrent;
  }

  private validateMaxConcurrent(maxConcurrent: number): void {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("AppTaskQueue maxConcurrent must be a positive integer");
    }
  }

  enqueue(taskId: string, opts: AppTaskQueueOptions = {}): boolean {
    const key = taskId.trim();
    if (!key) throw new Error("AppTaskQueue requires a non-empty task ID");
    const priority = opts.priority ?? this.priorities.get(key) ?? "P2";
    const lane = strongerLane(this.lanes.get(key), opts.lane);
    if (this.running.has(key)) {
      const alreadyDirty = this.dirty.has(key);
      this.dirty.add(key);
      if (opts.promote) this.dirtyPromote.add(key);
      this.dirtyPriorities.set(key, priority);
      this.dirtyLanes.set(key, strongerLane(this.dirtyLanes.get(key), lane));
      return !alreadyDirty;
    }
    if (this.queued.has(key)) {
      const priorityChanged = this.priorities.get(key) !== priority;
      const laneChanged = this.lanes.get(key) !== lane;
      this.priorities.set(key, priority);
      this.lanes.set(key, lane);
      if (opts.promote && !this.promotedQueued.has(key)) {
        const index = this.pending.indexOf(key);
        if (index >= 0) this.pending.splice(index, 1);
        this.pending.splice(this.promotedQueued.size, 0, key);
        this.promotedQueued.add(key);
        return true;
      }
      return priorityChanged || laneChanged;
    }
    this.queued.add(key);
    this.priorities.set(key, priority);
    this.lanes.set(key, lane);
    if (opts.promote) {
      this.pending.splice(this.promotedQueued.size, 0, key);
      this.promotedQueued.add(key);
    } else {
      this.pending.push(key);
    }
    return true;
  }

  take(): string | null {
    if (this.running.size >= this.maxConcurrent) return null;
    const lane = this.nextLane();
    const takeIndex = this.nextIndex(lane ?? "normal");
    const [taskId] = this.pending.splice(takeIndex, 1);
    if (!taskId) return null;
    this.queued.delete(taskId);
    this.promotedQueued.delete(taskId);
    this.running.add(taskId);
    return taskId;
  }

  complete(taskId: string): void {
    if (!this.running.delete(taskId)) {
      throw new Error(`AppTaskQueue cannot complete task that is not running: ${taskId}`);
    }
    if (this.dirty.delete(taskId)) {
      const promote = this.dirtyPromote.delete(taskId);
      const priority = this.dirtyPriorities.get(taskId) ?? this.priorities.get(taskId);
      const lane = strongerLane(this.lanes.get(taskId), this.dirtyLanes.get(taskId));
      this.dirtyPriorities.delete(taskId);
      this.dirtyLanes.delete(taskId);
      this.enqueue(taskId, { promote, priority, lane });
    } else {
      this.priorities.delete(taskId);
      this.lanes.delete(taskId);
    }
  }

  nextLane(): AppTaskLane | null {
    if (this.running.size >= this.maxConcurrent || this.pending.length === 0) return null;
    return this.pending.some((taskId) => this.lanes.get(taskId) === "human") ? "human" : "normal";
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

  private nextIndex(lane: AppTaskLane): number {
    let selected = -1;
    let selectedRank = Number.POSITIVE_INFINITY;
    let selectedPromoted = false;
    for (let index = 0; index < this.pending.length; index++) {
      const taskId = this.pending[index];
      if (!taskId || this.lanes.get(taskId) !== lane) continue;
      const rank = priorityRank(this.priorities.get(taskId) ?? "P2");
      const promoted = this.promotedQueued.has(taskId);
      if (rank < selectedRank || (rank === selectedRank && promoted && !selectedPromoted)) {
        selected = index;
        selectedRank = rank;
        selectedPromoted = promoted;
      }
    }
    return selected;
  }
}

export type AppTaskPriority = "P0" | "P1" | "P2" | "P3";

export type AppTaskLane = "human" | "normal";

export type AppTaskQueueOptions = {
  /** Fresh exact wake: run before passive peers of the same priority. */
  promote?: boolean;
  priority?: AppTaskPriority;
  /** Trusted Host scheduling origin. App-authored priority cannot set this lane. */
  lane?: AppTaskLane;
};

function strongerLane(current: AppTaskLane | undefined, incoming: AppTaskLane | undefined): AppTaskLane {
  return current === "human" || incoming === "human" ? "human" : "normal";
}

function priorityRank(priority: AppTaskPriority): number {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority];
}
