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
};

/** Cheap causal timing passed to the App runtime; it is not durable authority. */
export type AppTaskDispatch = {
  enqueuedAt: number;
  startedAt: number;
  readyWaitMs: number;
  lane: AppTaskLane;
};

/** One level-based reconciliation worker pool for one App. */
export class AppTaskController {
  private readonly queue: AppTaskQueue;
  private readonly failures = new Map<string, number>();
  private readonly readySince = new Map<string, number>();
  private scheduled = false;
  private closed = false;
  private enabled = true;
  private startReady: boolean;
  private waitingForCapacity = false;
  private waitingCapacityLane?: AppTaskLane;
  private cancelCapacityWait?: () => void;
  private readonly drainWaiters = new Set<() => void>();

  constructor(private readonly options: AppTaskControllerOptions) {
    this.queue = new AppTaskQueue(options.maxConcurrent);
    this.startReady = !options.startAfter;
    if (options.startAfter) {
      void Promise.resolve(options.startAfter).then(
        () => this.releaseStartGate(),
        () => this.releaseStartGate(),
      );
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

  /** Apply a reloaded App limit while preserving queued and in-flight work. */
  updateMaxConcurrent(maxConcurrent: number): void {
    if (this.closed) return;
    this.queue.updateMaxConcurrent(maxConcurrent);
    this.schedulePump();
  }

  /** Pause or resume new claims without discarding the queue or active work. */
  setEnabled(enabled: boolean): void {
    if (this.closed || this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      cancelHostPumps(this);
      this.scheduled = false;
      this.cancelCapacityWait?.();
      this.cancelCapacityWait = undefined;
      this.waitingForCapacity = false;
      this.waitingCapacityLane = undefined;
      return;
    }
    this.schedulePump();
  }

  close(): void {
    this.closed = true;
    cancelHostPumps(this);
    this.cancelCapacityWait?.();
    this.cancelCapacityWait = undefined;
    this.waitingForCapacity = false;
    this.waitingCapacityLane = undefined;
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
    if (this.scheduled || this.closed || !this.enabled || !this.startReady) return;
    this.scheduled = true;
    // A ready-work chain must not monopolize the event loop between tasks.
    scheduleHostPump(this, () => {
      this.scheduled = false;
      this.pump();
    });
  }

  private pump(): void {
    if (this.closed || !this.enabled) return;
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
    if (this.waitingForCapacity || this.closed || !this.enabled || !this.startReady || !this.options.capacity) return;
    this.waitingForCapacity = true;
    this.waitingCapacityLane = lane;
    const acquired = (release: () => void) => {
      this.waitingForCapacity = false;
      this.waitingCapacityLane = undefined;
      this.cancelCapacityWait = undefined;
      if (this.closed || !this.enabled || !this.startReady) {
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
        this.resolveDrainWaiters();
        this.schedulePump();
      });
  }

  private releaseStartGate(): void {
    this.startReady = true;
    this.resolveDrainWaiters();
    this.schedulePump();
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
