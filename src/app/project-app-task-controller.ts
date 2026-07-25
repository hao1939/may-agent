import { ProjectAppTaskQueue, type ProjectAppTaskQueueOptions } from "./project-app-task-queue.js";

export type ProjectAppTaskControllerOptions = {
  maxConcurrent: number;
  /** Shared daemon capacity. App-local limits still apply independently. */
  capacity?: ProjectAppTaskCapacity;
  reconcile(taskId: string): Promise<void>;
  onError?(taskId: string, error: unknown, willRetry: boolean): void;
  maxRetries?: number;
  retryDelayMs?: (attempt: number) => number;
  /** Do not claim work until the controller instance being replaced has drained. */
  startAfter?: PromiseLike<void>;
  resync?: {
    intervalMs: number;
    taskIds?(): Iterable<string>;
    tasks?(): Iterable<{ taskId: string; options?: ProjectAppTaskQueueOptions }>;
  };
};

/** Mechanical backpressure shared by every app task controller in one daemon. */
export class ProjectAppTaskCapacity {
  private limit: number;
  private running = 0;
  private readonly waiters: Array<(release: () => void) => void> = [];

  constructor(
    maxConcurrent: number,
    private readonly parent?: ProjectAppTaskCapacity,
  ) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("ProjectAppTaskCapacity maxConcurrent must be a positive integer");
    }
    if (parent === this) throw new Error("ProjectAppTaskCapacity cannot be its own parent");
    this.limit = maxConcurrent;
  }

  get maxConcurrent(): number {
    return this.limit;
  }

  resize(maxConcurrent: number): void {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("ProjectAppTaskCapacity maxConcurrent must be a positive integer");
    }
    this.limit = maxConcurrent;
    this.drainWaiters();
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await work();
    } finally {
      release();
    }
  }

  tryAcquire(): (() => void) | null {
    const localRelease = this.tryAcquireLocal();
    if (!localRelease) return null;
    if (!this.parent) return localRelease;
    const parentRelease = this.parent.tryAcquire();
    if (!parentRelease) {
      localRelease();
      return null;
    }
    return this.combinedRelease(localRelease, parentRelease);
  }

  async acquire(): Promise<() => void> {
    const localRelease = await this.acquireLocal();
    if (!this.parent) return localRelease;
    const parentRelease = await this.parent.acquire();
    return this.combinedRelease(localRelease, parentRelease);
  }

  snapshot(): { running: number; waiting: number } {
    return { running: this.running, waiting: this.waiters.length };
  }

  private releaseHandle(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release();
    };
  }

  private release(): void {
    this.running -= 1;
    this.drainWaiters();
  }

  private tryAcquireLocal(): (() => void) | null {
    if (this.running >= this.limit) return null;
    this.running += 1;
    return this.releaseHandle();
  }

  private acquireLocal(): Promise<() => void> {
    const release = this.tryAcquireLocal();
    if (release) return Promise.resolve(release);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private drainWaiters(): void {
    while (this.running < this.limit) {
      const next = this.waiters.shift();
      if (!next) return;
      this.running += 1;
      next(this.releaseHandle());
    }
  }

  private combinedRelease(localRelease: () => void, parentRelease: () => void): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      parentRelease();
      localRelease();
    };
  }
}

/** One level-based reconciliation worker pool for one Agent App. */
export class ProjectAppTaskController {
  private readonly queue: ProjectAppTaskQueue;
  private readonly failures = new Map<string, number>();
  private scheduled = false;
  private closed = false;
  private startReady: boolean;
  private waitingForCapacity = false;
  private readonly drainWaiters = new Set<() => void>();
  private readonly resyncTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly options: ProjectAppTaskControllerOptions) {
    this.queue = new ProjectAppTaskQueue(options.maxConcurrent);
    this.startReady = !options.startAfter;
    if (options.startAfter) {
      void Promise.resolve(options.startAfter).then(
        () => this.releaseStartGate(),
        () => this.releaseStartGate(),
      );
    }
    if (options.resync) {
      if (!Number.isFinite(options.resync.intervalMs) || options.resync.intervalMs <= 0) {
        throw new Error("ProjectAppTaskController resync interval must be positive");
      }
      this.resyncTimer = setInterval(() => this.resyncConfiguredTasks(), options.resync.intervalMs);
      this.resyncTimer.unref?.();
      if (this.startReady) this.resyncConfiguredTasks();
    }
  }

  enqueue(taskId: string, opts: ProjectAppTaskQueueOptions = {}): boolean {
    if (this.closed) return false;
    const added = this.queue.enqueue(taskId, opts);
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
    if (this.resyncTimer) clearInterval(this.resyncTimer);
    this.resolveDrainWaiters();
  }

  /** Resolves after this closed controller and every inherited predecessor have drained. */
  whenDrained(): Promise<void> {
    if (this.isDrained()) return Promise.resolve();
    return new Promise((resolve) => this.drainWaiters.add(resolve));
  }

  snapshot(): ReturnType<ProjectAppTaskQueue["snapshot"]> {
    return this.queue.snapshot();
  }

  private schedulePump(): void {
    if (this.scheduled || this.closed || !this.startReady) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.pump();
    });
  }

  private pump(): void {
    if (this.closed) return;
    if (this.options.capacity) {
      while (this.queue.pendingCount > 0 && this.queue.runningCount < this.queue.maxConcurrent) {
        const release = this.options.capacity.tryAcquire();
        if (!release) {
          this.waitForCapacity();
          return;
        }
        const taskId = this.queue.take();
        if (!taskId) {
          release();
          return;
        }
        this.run(taskId, release);
      }
      return;
    }
    let taskId: string | null;
    while ((taskId = this.queue.take())) this.run(taskId);
  }

  private waitForCapacity(): void {
    if (this.waitingForCapacity || this.closed || !this.startReady || !this.options.capacity) return;
    this.waitingForCapacity = true;
    void this.options.capacity.acquire().then((release) => {
      this.waitingForCapacity = false;
      if (this.closed || !this.startReady) {
        release();
        this.resolveDrainWaiters();
        return;
      }
      const taskId = this.queue.take();
      if (taskId) this.run(taskId, release);
      else release();
      this.schedulePump();
    });
  }

  private run(taskId: string, capacityRelease?: () => void): void {
    const reconcile = () => (this.closed ? Promise.resolve() : this.options.reconcile(taskId));
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
          setTimeout(() => this.enqueue(taskId), delay);
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
    if (this.options.resync) this.resyncConfiguredTasks();
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
