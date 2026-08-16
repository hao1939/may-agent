type CapacityWaiter = {
  active: boolean;
  grant(release: () => void): void;
};

/** One Host-owned limit shared by App request owners and task attempts. */
export class HostCapacity {
  private readonly limit: number;
  private running = 0;
  private readonly waiters: CapacityWaiter[] = [];

  constructor(maxConcurrent: number) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("HostCapacity maxConcurrent must be a positive integer");
    }
    this.limit = maxConcurrent;
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
    if (this.running >= this.limit) return null;
    this.running += 1;
    return this.releaseHandle();
  }

  async acquire(): Promise<() => void> {
    const release = this.tryAcquire();
    if (release) return release;
    return new Promise((resolve) => this.waiters.push({ active: true, grant: resolve }));
  }

  acquireCancellable(callback: (release: () => void) => void): () => void {
    let active = true;
    let reservedRelease: (() => void) | undefined;
    const waiter: CapacityWaiter = {
      active: true,
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

  private releaseHandle(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.running -= 1;
      this.drainWaiters();
    };
  }

  private drainWaiters(): void {
    while (this.running < this.limit) {
      const next = this.waiters.shift();
      if (!next) return;
      if (!next.active) continue;
      next.active = false;
      this.running += 1;
      next.grant(this.releaseHandle());
    }
  }
}
