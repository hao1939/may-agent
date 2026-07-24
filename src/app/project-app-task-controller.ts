import { ProjectAppTaskQueue } from "./project-app-task-queue.js";

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
    taskIds(): Iterable<string>;
  };
};

/** Mechanical backpressure shared by every app task controller in one daemon. */
export class ProjectAppTaskCapacity {
  private running = 0;
  private readonly waiters: Array<(release: () => void) => void> = [];

  constructor(readonly maxConcurrent: number) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("ProjectAppTaskCapacity maxConcurrent must be a positive integer");
    }
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
    if (this.running >= this.maxConcurrent) return null;
    this.running += 1;
    return this.releaseHandle();
  }

  acquire(): Promise<() => void> {
    const release = this.tryAcquire();
    if (release) return Promise.resolve(release);
    return new Promise((resolve) => this.waiters.push(resolve));
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
    const next = this.waiters.shift();
    if (next) {
      next(this.releaseHandle());
      return;
    }
    this.running -= 1;
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
      this.resyncTimer = setInterval(() => this.resync(options.resync!.taskIds()), options.resync.intervalMs);
      this.resyncTimer.unref?.();
    }
  }

  enqueue(taskId: string, opts: { front?: boolean } = {}): boolean {
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
