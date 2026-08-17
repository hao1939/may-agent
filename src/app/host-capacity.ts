type CapacityWaiter = {
  active: boolean;
  foreground: boolean;
  grant(release: () => void): void;
};

/** One Host-owned limit shared by App request owners and task attempts. */
export class HostCapacity {
  private readonly limit: number;
  private readonly backgroundLimit: number;
  private running = 0;
  private backgroundRunning = 0;
  private readonly waiters: CapacityWaiter[] = [];

  constructor(maxConcurrent: number) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("HostCapacity maxConcurrent must be a positive integer");
    }
    this.limit = maxConcurrent;
    this.backgroundLimit = Math.max(1, maxConcurrent - 1);
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await work();
    } finally {
      release();
    }
  }

  /** Keep one lane available for a human-origin May owner pass. */
  async runForeground<T>(work: () => Promise<T>): Promise<T> {
    const release = await this.acquireForeground();
    try {
      return await work();
    } finally {
      release();
    }
  }

  tryAcquire(): (() => void) | null {
    if (this.running >= this.limit || this.backgroundRunning >= this.backgroundLimit) return null;
    this.running += 1;
    this.backgroundRunning += 1;
    return this.releaseHandle(false);
  }

  tryAcquireForeground(): (() => void) | null {
    if (this.running >= this.limit) return null;
    this.running += 1;
    return this.releaseHandle(true);
  }

  async acquire(): Promise<() => void> {
    const release = this.tryAcquire();
    if (release) return release;
    return new Promise((resolve) => this.waiters.push({ active: true, foreground: false, grant: resolve }));
  }

  async acquireForeground(): Promise<() => void> {
    const release = this.tryAcquireForeground();
    if (release) return release;
    return new Promise((resolve) => this.waiters.push({ active: true, foreground: true, grant: resolve }));
  }

  acquireCancellable(callback: (release: () => void) => void): () => void {
    let active = true;
    let reservedRelease: (() => void) | undefined;
    const waiter: CapacityWaiter = {
      active: true,
      foreground: false,
      grant: (release) => {
        reservedRelease = release;
        setTimeout(() => {
          if (!active) {
            reservedRelease?.();
            reservedRelease = undefined;
            return;
          }
          reservedRelease = undefined;
          active = false;
          callback(release);
        }, 0);
      },
    };
    const release = this.tryAcquire();
    if (release) waiter.grant(release);
    else this.waiters.push(waiter);

    return () => {
      if (!active) return;
      active = false;
      if (waiter.active) {
        waiter.active = false;
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
      }
      reservedRelease?.();
      reservedRelease = undefined;
    };
  }

  snapshot(): { running: number; waiting: number } {
    return { running: this.running, waiting: this.waiters.length };
  }

  private releaseHandle(foreground: boolean): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.running -= 1;
      if (!foreground) this.backgroundRunning -= 1;
      this.drainWaiters();
    };
  }

  private drainWaiters(): void {
    while (this.running < this.limit) {
      let index = this.waiters.findIndex((waiter) => waiter.active && waiter.foreground);
      if (index < 0 && this.backgroundRunning < this.backgroundLimit) {
        index = this.waiters.findIndex((waiter) => waiter.active && !waiter.foreground);
      }
      if (index < 0) return;
      const [next] = this.waiters.splice(index, 1);
      if (!next) return;
      if (!next.active) continue;
      next.active = false;
      this.running += 1;
      if (!next.foreground) this.backgroundRunning += 1;
      next.grant(this.releaseHandle(next.foreground));
    }
  }
}
