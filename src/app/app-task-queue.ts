/**
 * A small level-triggered work queue for one Agent App.
 *
 * Queue entries are task IDs only. Resource state remains in the task store.
 * Repeated wakes collapse while pending; a wake received during reconciliation
 * schedules exactly one fresh pass after the current pass completes.
 */
export class AppTaskQueue {
  private static readonly maxFrontBurst = 3;
  private static readonly maxPrioritySkips = 3;
  private readonly pending: string[] = [];
  private readonly queued = new Set<string>();
  private readonly frontQueued = new Set<string>();
  private readonly promotedQueued = new Set<string>();
  private readonly running = new Set<string>();
  private readonly dirty = new Set<string>();
  private readonly dirtyFront = new Set<string>();
  private readonly dirtyPromote = new Set<string>();
  private readonly priorities = new Map<string, AppTaskPriority>();
  private readonly dirtyPriorities = new Map<string, AppTaskPriority>();
  private readonly frontPrioritySkips = new Map<string, number>();
  private readonly ordinaryPrioritySkips = new Map<string, number>();
  private consecutiveFrontTakes = 0;

  constructor(readonly maxConcurrent: number) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("AppTaskQueue maxConcurrent must be a positive integer");
    }
  }

  enqueue(taskId: string, opts: AppTaskQueueOptions = {}): boolean {
    const key = taskId.trim();
    if (!key) throw new Error("AppTaskQueue requires a non-empty task ID");
    const priority = opts.priority ?? this.priorities.get(key) ?? "P2";
    if (this.running.has(key)) {
      const alreadyDirty = this.dirty.has(key);
      this.dirty.add(key);
      if (opts.front || opts.promote) this.dirtyFront.add(key);
      if (opts.promote) this.dirtyPromote.add(key);
      this.dirtyPriorities.set(key, priority);
      return !alreadyDirty;
    }
    if (this.queued.has(key)) {
      const priorityChanged = this.priorities.get(key) !== priority;
      this.priorities.set(key, priority);
      if (opts.promote && !this.promotedQueued.has(key)) {
        const index = this.pending.indexOf(key);
        if (index >= 0) this.pending.splice(index, 1);
        this.pending.splice(this.promotedQueued.size, 0, key);
        this.frontQueued.add(key);
        this.promotedQueued.add(key);
        this.ordinaryPrioritySkips.delete(key);
        this.frontPrioritySkips.set(key, 0);
        return true;
      }
      if ((!opts.front && !opts.promote) || this.frontQueued.has(key)) return priorityChanged;
      const index = this.pending.indexOf(key);
      if (index >= 0) this.pending.splice(index, 1);
      this.pending.splice(this.frontQueued.size, 0, key);
      this.frontQueued.add(key);
      this.ordinaryPrioritySkips.delete(key);
      this.frontPrioritySkips.set(key, 0);
      return true;
    }
    this.queued.add(key);
    this.priorities.set(key, priority);
    if (opts.promote) {
      this.pending.splice(this.promotedQueued.size, 0, key);
      this.frontQueued.add(key);
      this.promotedQueued.add(key);
      this.frontPrioritySkips.set(key, 0);
    } else if (opts.front) {
      this.pending.splice(this.frontQueued.size, 0, key);
      this.frontQueued.add(key);
      this.frontPrioritySkips.set(key, 0);
    } else {
      this.pending.push(key);
      this.ordinaryPrioritySkips.set(key, 0);
    }
    return true;
  }

  take(): string | null {
    if (this.running.size >= this.maxConcurrent) return null;
    const frontCount = this.frontQueued.size;
    const takeOrdinary = frontCount < this.pending.length && this.consecutiveFrontTakes >= AppTaskQueue.maxFrontBurst;
    const takeIndex =
      takeOrdinary || frontCount === 0 ? this.nextOrdinaryIndex(frontCount) : this.nextFrontIndex(frontCount);
    const [taskId] = this.pending.splice(takeIndex, 1);
    if (!taskId) return null;
    this.queued.delete(taskId);
    this.frontPrioritySkips.delete(taskId);
    this.ordinaryPrioritySkips.delete(taskId);
    this.promotedQueued.delete(taskId);
    if (this.frontQueued.delete(taskId)) this.consecutiveFrontTakes += 1;
    else this.consecutiveFrontTakes = 0;
    this.running.add(taskId);
    return taskId;
  }

  complete(taskId: string): void {
    if (!this.running.delete(taskId)) {
      throw new Error(`AppTaskQueue cannot complete task that is not running: ${taskId}`);
    }
    if (this.dirty.delete(taskId)) {
      const front = this.dirtyFront.delete(taskId);
      const promote = this.dirtyPromote.delete(taskId);
      const priority = this.dirtyPriorities.get(taskId) ?? this.priorities.get(taskId);
      this.dirtyPriorities.delete(taskId);
      this.enqueue(taskId, { front, promote, priority });
    } else {
      this.priorities.delete(taskId);
    }
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

  private nextOrdinaryIndex(frontCount: number): number {
    const agedIndex = this.nextAgedPriorityIndex(frontCount, this.pending.length, this.ordinaryPrioritySkips);
    if (agedIndex >= frontCount) {
      return agedIndex;
    }

    let selected = frontCount;
    let selectedRank = priorityRank(this.priorities.get(this.pending[selected] ?? "") ?? "P2");
    for (let index = frontCount + 1; index < this.pending.length; index++) {
      const rank = priorityRank(this.priorities.get(this.pending[index]) ?? "P2");
      if (rank < selectedRank) {
        selected = index;
        selectedRank = rank;
      }
    }
    this.ageLowerPriorityHeads(frontCount, this.pending.length, selectedRank, this.ordinaryPrioritySkips);
    return selected;
  }

  private nextFrontIndex(frontCount: number): number {
    const agedIndex = this.nextAgedPriorityIndex(0, frontCount, this.frontPrioritySkips);
    if (agedIndex >= 0) {
      return agedIndex;
    }

    let selected = 0;
    let selectedRank = priorityRank(this.priorities.get(this.pending[selected] ?? "") ?? "P2");
    for (let index = 1; index < frontCount; index++) {
      const rank = priorityRank(this.priorities.get(this.pending[index] ?? "") ?? "P2");
      if (rank < selectedRank) {
        selected = index;
        selectedRank = rank;
      }
    }
    this.ageLowerPriorityHeads(0, frontCount, selectedRank, this.frontPrioritySkips);
    return selected;
  }

  private nextAgedPriorityIndex(start: number, end: number, skips: Map<string, number>): number {
    let selected = -1;
    let selectedRank = Number.POSITIVE_INFINITY;
    for (let index = start; index < end; index++) {
      const taskId = this.pending[index];
      if (!taskId || (skips.get(taskId) ?? 0) < AppTaskQueue.maxPrioritySkips) continue;
      const rank = priorityRank(this.priorities.get(taskId) ?? "P2");
      if (rank < selectedRank) {
        selected = index;
        selectedRank = rank;
      }
    }
    return selected;
  }

  /** Age only the FIFO head of each lower-priority class. */
  private ageLowerPriorityHeads(start: number, end: number, selectedRank: number, skips: Map<string, number>): void {
    const agedRanks = new Set<number>();
    for (let index = start; index < end; index++) {
      const taskId = this.pending[index];
      if (!taskId) continue;
      const rank = priorityRank(this.priorities.get(taskId) ?? "P2");
      if (rank <= selectedRank || agedRanks.has(rank)) continue;
      agedRanks.add(rank);
      skips.set(taskId, (skips.get(taskId) ?? 0) + 1);
    }
  }
}

export type AppTaskPriority = "P0" | "P1" | "P2" | "P3";

export type AppTaskQueueOptions = {
  front?: boolean;
  /** Fresh exact wake: move an already-front-queued key ahead of passive resync backlog. */
  promote?: boolean;
  priority?: AppTaskPriority;
};

function priorityRank(priority: AppTaskPriority): number {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority];
}
