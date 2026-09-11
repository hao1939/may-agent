import { AppTaskQueue, type AppTaskLane, type AppTaskQueueOptions } from "./queue.js";
import type { HostCapacity } from "../scheduling/host-capacity.js";

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
  /** One current scheduling read per dispatch boundary, not per queued key. */
  readScheduling?(): { backgroundPaused: boolean; foregroundTaskIds: ReadonlySet<string> };
  reconcile(taskId: string, dispatch: AppTaskDispatch): Promise<void>;
  /** Best-effort diagnostics; never holds capacity or gates retries. */
  onError?(taskId: string, error: unknown, willRetry: boolean): void | Promise<void>;
  /** Dispatch-error pacing only; unfinished work retries until this controller closes. */
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
  // Dispatch failures may precede any durable Task write. Keep their timer
  // authoritative across ordinary wakes; settled Task failures use stored due work.
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly readySince = new Map<string, number>();
  private scheduled = false;
  private closed = false;
  private enabled = true;
  private startReady: boolean;
  private waitingForCapacity = false;
  private waitingCapacityLane?: AppTaskLane;
  private waitingCapacityForeground?: boolean;
  private cancelCapacityWait?: () => void;
  private readonly drainWaiters = new Set<() => void>();
  private scheduling = { backgroundPaused: false, foregroundTaskIds: new Set<string>() as ReadonlySet<string> };

  constructor(private readonly options: AppTaskControllerOptions) {
    this.queue = new AppTaskQueue(
      options.maxConcurrent,
      (taskId) =>
        !this.retryTimers.has(taskId) &&
        (!this.scheduling.backgroundPaused || this.scheduling.foregroundTaskIds.has(taskId)),
      (taskId) => this.scheduling.foregroundTaskIds.has(taskId),
    );
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
    if (!this.refreshScheduling()) return added;
    const next = this.queue.peek();
    if (
      this.waitingForCapacity &&
      next &&
      (this.waitingCapacityForeground !== next.foreground ||
        (this.waitingCapacityLane === "normal" && next.lane === "human"))
    ) {
      this.cancelCapacityWait?.();
      this.cancelCapacityWait = undefined;
      this.waitingForCapacity = false;
      this.waitingCapacityLane = undefined;
      this.waitingCapacityForeground = undefined;
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
      this.waitingCapacityForeground = undefined;
      return;
    }
    this.schedulePump();
  }

  close(): void {
    this.closed = true;
    for (const timer of this.retryTimers.values()) clearTimeout(timer);
    this.retryTimers.clear();
    cancelHostPumps(this);
    this.cancelCapacityWait?.();
    this.cancelCapacityWait = undefined;
    this.waitingForCapacity = false;
    this.waitingCapacityLane = undefined;
    this.waitingCapacityForeground = undefined;
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
    if (!this.refreshScheduling()) return;
    const next = this.queue.peek();
    if (!next) return;
    if (this.options.capacity) {
      // Priority orders work; only durable human Conversation input earns the reserve.
      const release = next.foreground
        ? this.options.capacity.tryAcquireForeground()
        : this.options.capacity.tryAcquire();
      if (!release) {
        this.waitForCapacity(next.lane, next.foreground);
        return;
      }
      const taskId = this.queue.take();
      if (!taskId) {
        release();
        return;
      }
      this.run(taskId, release, next.lane);
      // Reconciliation has a synchronous state-claim prefix. Fill available
      // concurrency on later loop turns so readiness I/O can run between claims.
      if (this.queue.peek()) this.schedulePump();
      return;
    }
    const taskId = this.queue.take();
    if (!taskId) return;
    this.run(taskId, undefined, next.lane);
    if (this.queue.peek()) this.schedulePump();
  }

  private waitForCapacity(lane: AppTaskLane, foreground: boolean): void {
    if (this.waitingForCapacity || this.closed || !this.enabled || !this.startReady || !this.options.capacity) return;
    this.waitingForCapacity = true;
    this.waitingCapacityLane = lane;
    this.waitingCapacityForeground = foreground;
    const acquired = (release: () => void) => {
      this.waitingForCapacity = false;
      this.waitingCapacityLane = undefined;
      this.waitingCapacityForeground = undefined;
      this.cancelCapacityWait = undefined;
      if (this.closed || !this.enabled || !this.startReady) {
        release();
        this.resolveDrainWaiters();
        return;
      }
      if (!this.refreshScheduling()) {
        release();
        return;
      }
      const next = this.queue.peek();
      const taskId = next?.foreground === foreground ? this.queue.take() : null;
      if (taskId) this.run(taskId, release, next!.lane);
      else release();
      this.schedulePump();
    };
    this.cancelCapacityWait = foreground
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
    // An async boundary also captures callbacks that throw before returning a Promise.
    const reconcile = async () => {
      if (!this.closed) await this.options.reconcile(taskId, dispatch);
    };
    void reconcile()
      .then(() => {
        this.failures.delete(taskId);
      })
      .catch((error) => this.recordFailure(taskId, error, lane))
      .finally(() => {
        this.queue.complete(taskId);
        capacityRelease?.();
        this.resolveDrainWaiters();
        this.schedulePump();
      });
  }

  private refreshScheduling(): boolean {
    try {
      if (this.options.readScheduling) this.scheduling = this.options.readScheduling();
      return true;
    } catch (error) {
      // A failed storage read uses the same dispatch backoff and keeps queued work.
      const taskId = this.queue.snapshot().pending[0];
      if (taskId && !this.retryTimers.has(taskId)) this.recordFailure(taskId, error, "normal");
      return false;
    }
  }

  private recordFailure(taskId: string, error: unknown, lane: AppTaskLane): void {
    const attempt = (this.failures.get(taskId) ?? 0) + 1;
    const willRetry = !this.closed;
    this.failures.set(taskId, attempt);
    if (willRetry) {
      const delay = Math.max(0, this.options.retryDelayMs?.(attempt) ?? Math.min(30_000, 250 * 2 ** (attempt - 1)));
      const timer = setTimeout(() => {
        this.retryTimers.delete(taskId);
        this.enqueue(taskId, { lane });
      }, delay);
      this.retryTimers.set(taskId, timer);
    }
    const reportFailure = (reportError: unknown) => {
      console.error(`Task ${taskId} failure reporter failed; willRetry=${willRetry}`, { error, reportError });
    };
    try {
      // Do not await reporting: a slow diagnostic sink must not hold a Task slot.
      void Promise.resolve(this.options.onError?.(taskId, error, willRetry)).catch(reportFailure);
    } catch (reportError) {
      reportFailure(reportError);
    }
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
