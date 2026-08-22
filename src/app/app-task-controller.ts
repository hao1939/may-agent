import { AppTaskQueue, type AppTaskLane, type AppTaskQueueOptions } from "./app-task-queue.js";
import type { HostCapacity } from "./host-capacity.js";

const hostPumpQueue: Array<{ owner: object; pump: () => void }> = [];
let hostPumpScheduled = false;

function armHostPump(): void {
  if (hostPumpScheduled) return;
  hostPumpScheduled = true;
  setTimeout(() => {
    hostPumpScheduled = false;
    hostPumpQueue.shift()?.pump();
    if (hostPumpQueue.length > 0) armHostPump();
  }, 0);
}

/** Run one App's synchronous claim prefix per event-loop turn across the Host. */
function scheduleHostPump(owner: object, pump: () => void): void {
  hostPumpQueue.push({ owner, pump });
  armHostPump();
}

function cancelHostPumps(owner: object): void {
  for (let index = hostPumpQueue.length - 1; index >= 0; index--) {
    if (hostPumpQueue[index]?.owner === owner) hostPumpQueue.splice(index, 1);
  }
}

export type AppTaskControllerOptions = {
  maxConcurrent: number;
  /** Shared Host capacity. App-local limits still apply independently. */
  capacity?: HostCapacity;
  reconcile(taskId: string, dispatch: AppTaskDispatch): Promise<void>;
  onError?(taskId: string, error: unknown, willRetry: boolean): void;
  maxRetries?: number;
  retryDelayMs?: (attempt: number) => number;
  /** Do not claim work until the controller instance being replaced has drained. */
  startAfter?: PromiseLike<void>;
  resync?: {
    intervalMs: number;
    /** Startup may seed the queue from an existing canonical-state pass. */
    onStart?: boolean;
    taskIds?(): Iterable<string>;
    tasks?(): Iterable<{ taskId: string; options?: AppTaskQueueOptions }>;
  };
};

/** Cheap causal timing passed to the App runtime; it is not durable authority. */
export type AppTaskDispatch = {
  enqueuedAt: number;
  startedAt: number;
  readyWaitMs: number;
  lane: AppTaskLane;
};

/** One level-based reconciliation worker pool for one Agent App. */
export class AppTaskController {
  private readonly queue: AppTaskQueue;
  private readonly failures = new Map<string, number>();
  private readonly readySince = new Map<string, number>();
  private scheduled = false;
  private closed = false;
  private startReady: boolean;
  private waitingForCapacity = false;
  private waitingCapacityLane?: AppTaskLane;
  private cancelCapacityWait?: () => void;
  private readonly drainWaiters = new Set<() => void>();
  private readonly resyncTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly options: AppTaskControllerOptions) {
    this.queue = new AppTaskQueue(options.maxConcurrent);
    this.startReady = !options.startAfter;
    if (options.startAfter) {
      void Promise.resolve(options.startAfter).then(
        () => this.releaseStartGate(),
        () => this.releaseStartGate(),
      );
    }
    if (options.resync) {
      if (!Number.isFinite(options.resync.intervalMs) || options.resync.intervalMs <= 0) {
        throw new Error("AppTaskController resync interval must be positive");
      }
      this.resyncTimer = setInterval(() => this.resyncConfiguredTasks(), options.resync.intervalMs);
      this.resyncTimer.unref?.();
      if (this.startReady && options.resync.onStart !== false) this.resyncConfiguredTasks();
    }
  }

  enqueue(taskId: string, opts: AppTaskQueueOptions = {}): boolean {
    if (this.closed) return false;
    const added = this.queue.enqueue(taskId, opts);
    if (added && !this.readySince.has(taskId)) this.readySince.set(taskId, Date.now());
    if (this.waitingCapacityLane === "normal" && this.queue.nextLane() === "human") {
      this.cancelCapacityWait?.();
      this.cancelCapacityWait = undefined;
      this.waitingForCapacity = false;
      this.waitingCapacityLane = undefined;
    }
    this.schedulePump();
    return added;
  }

  resync(taskIds: Iterable<string>): number {
    let added = 0;
    for (const taskId of taskIds) if (this.enqueue(taskId)) added++;
    return added;
  }

  close(): void {
    this.closed = true;
    cancelHostPumps(this);
    this.cancelCapacityWait?.();
    this.cancelCapacityWait = undefined;
    this.waitingForCapacity = false;
    this.waitingCapacityLane = undefined;
    if (this.resyncTimer) clearInterval(this.resyncTimer);
    this.readySince.clear();
    this.resolveDrainWaiters();
  }

  /** Resolves after this closed controller and every inherited predecessor have drained. */
  whenDrained(): Promise<void> {
    if (this.isDrained()) return Promise.resolve();
    return new Promise((resolve) => this.drainWaiters.add(resolve));
  }

  snapshot(): ReturnType<AppTaskQueue["snapshot"]> {
    return this.queue.snapshot();
  }

  private schedulePump(): void {
    if (this.scheduled || this.closed || !this.startReady) return;
    this.scheduled = true;
    // A ready-work chain must not monopolize the event loop between tasks.
    scheduleHostPump(this, () => {
      this.scheduled = false;
      this.pump();
    });
  }

  private pump(): void {
    if (this.closed) return;
    if (this.options.capacity) {
      if (this.queue.pendingCount === 0 || this.queue.runningCount >= this.queue.maxConcurrent) return;
      const lane = this.queue.nextLane();
      if (!lane) return;
      const release =
        lane === "human" ? this.options.capacity.tryAcquireForeground() : this.options.capacity.tryAcquire();
      if (!release) {
        this.waitForCapacity(lane);
        return;
      }
      const taskId = this.queue.take();
      if (!taskId) {
        release();
        return;
      }
      this.run(taskId, release, lane);
      // Reconciliation has a synchronous state-claim prefix. Fill available
      // concurrency on later loop turns so readiness I/O can run between claims.
      if (this.queue.pendingCount > 0 && this.queue.runningCount < this.queue.maxConcurrent) this.schedulePump();
      return;
    }
    const lane = this.queue.nextLane() ?? "normal";
    const taskId = this.queue.take();
    if (!taskId) return;
    this.run(taskId, undefined, lane);
    if (this.queue.pendingCount > 0 && this.queue.runningCount < this.queue.maxConcurrent) this.schedulePump();
  }

  private waitForCapacity(lane: AppTaskLane): void {
    if (this.waitingForCapacity || this.closed || !this.startReady || !this.options.capacity) return;
    this.waitingForCapacity = true;
    this.waitingCapacityLane = lane;
    const acquired = (release: () => void) => {
      this.waitingForCapacity = false;
      this.waitingCapacityLane = undefined;
      this.cancelCapacityWait = undefined;
      if (this.closed || !this.startReady) {
        release();
        this.resolveDrainWaiters();
        return;
      }
      const taskId = this.queue.take();
      if (taskId) this.run(taskId, release, lane);
      else release();
    };
    this.cancelCapacityWait =
      lane === "human"
        ? this.options.capacity.acquireForegroundCancellable(acquired)
        : this.options.capacity.acquireCancellable(acquired);
  }

  private run(taskId: string, capacityRelease?: () => void, lane: AppTaskLane = "normal"): void {
    const startedAt = Date.now();
    const enqueuedAt = this.readySince.get(taskId) ?? startedAt;
    this.readySince.delete(taskId);
    const dispatch: AppTaskDispatch = {
      enqueuedAt,
      startedAt,
      readyWaitMs: Math.max(0, startedAt - enqueuedAt),
      lane,
    };
    const reconcile = () => (this.closed ? Promise.resolve() : this.options.reconcile(taskId, dispatch));
    void reconcile()
      .then(() => {
        this.failures.delete(taskId);
      })
      .catch((error) => {
        const attempt = (this.failures.get(taskId) ?? 0) + 1;
        const maxRetries = this.options.maxRetries ?? 3;
        const willRetry = attempt <= maxRetries && !this.closed;
        this.failures.set(taskId, attempt);
        this.options.onError?.(taskId, error, willRetry);
        if (willRetry) {
          const delay = Math.max(0, this.options.retryDelayMs?.(attempt) ?? Math.min(30_000, 250 * 2 ** (attempt - 1)));
          setTimeout(() => this.enqueue(taskId, { lane }), delay);
        }
      })
      .finally(() => {
        this.queue.complete(taskId);
        capacityRelease?.();
        if (
          !this.closed &&
          this.startReady &&
          this.options.resync &&
          this.queue.pendingCount === 0 &&
          this.queue.runningCount < this.queue.maxConcurrent
        ) {
          this.refillReadyResyncWork(taskId);
        }
        this.resolveDrainWaiters();
        this.schedulePump();
      });
  }

  private releaseStartGate(): void {
    this.startReady = true;
    if (this.options.resync?.onStart !== false) this.resyncConfiguredTasks();
    this.resolveDrainWaiters();
    this.schedulePump();
  }

  private resyncConfiguredTasks(): void {
    const configured = this.options.resync;
    if (!configured) return;
    if (configured.tasks) {
      for (const task of configured.tasks()) this.enqueue(task.taskId, task.options);
      return;
    }
    if (configured.taskIds) this.resync(configured.taskIds());
  }

  private refillReadyResyncWork(completedTaskId: string): void {
    const configured = this.options.resync;
    if (!configured) return;
    if (configured.tasks) {
      for (const task of configured.tasks()) {
        if (task.taskId === completedTaskId) continue;
        this.enqueue(task.taskId, task.options);
      }
      return;
    }
    if (configured.taskIds) {
      for (const taskId of configured.taskIds()) {
        if (taskId === completedTaskId) continue;
        this.enqueue(taskId);
      }
    }
  }

  private isDrained(): boolean {
    return this.closed && this.startReady && this.queue.snapshot().running.length === 0;
  }

  private resolveDrainWaiters(): void {
    if (!this.isDrained()) return;
    for (const resolve of this.drainWaiters) resolve();
    this.drainWaiters.clear();
  }
}
