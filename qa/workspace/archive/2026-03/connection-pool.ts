/**
 * ConnectionPool — manages a pool of reusable database connections.
 *
 * Features:
 * - Configurable min/max pool size
 * - Connection health checks before reuse
 * - Idle timeout eviction
 * - Wait queue when pool is exhausted
 */

interface PoolConfig {
  minSize: number;
  maxSize: number;
  idleTimeoutMs: number;
  healthCheckIntervalMs: number;
  acquireTimeoutMs: number;
}

interface Connection {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  lastHealthCheck: number;
  healthy: boolean;
}

type Waiter = {
  resolve: (conn: Connection) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_CONFIG: PoolConfig = {
  minSize: 2,
  maxSize: 10,
  idleTimeoutMs: 30_000,
  healthCheckIntervalMs: 10_000,
  acquireTimeoutMs: 5_000,
};

export class ConnectionPool {
  private config: PoolConfig;
  private idle: Connection[] = [];
  private active: Set<Connection> = new Set();
  private waitQueue: Waiter[] = [];
  private nextId = 0;
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.minSize < 0) {
      throw new Error('minSize must be non-negative');
    }
    if (this.config.maxSize < this.config.minSize) {
      throw new Error('maxSize must be >= minSize');
    }
  }

  /**
   * Initialize the pool — create minSize connections and start eviction timer.
   */
  async initialize(): Promise<void> {
    for (let i = 0; i < this.config.minSize; i++) {
      const conn = this.createConnection();
      this.idle.push(conn);
    }
    this.startEvictionTimer();
  }

  /**
   * Acquire a connection from the pool.
   * Returns an idle connection if available, creates a new one if under max,
   * or waits in queue if pool is exhausted.
   */
  async acquire(): Promise<Connection> {
    // Try to get a healthy idle connection
    while (this.idle.length > 0) {
      const conn = this.idle.pop()!;
      if (this.needsHealthCheck(conn)) {
        const healthy = await this.checkHealth(conn);
        if (!healthy) {
          continue; // discard unhealthy, try next
        }
      }
      this.active.add(conn);
      return conn;
    }

    // No idle connections — can we create a new one?
    const totalConnections = this.active.size + this.idle.length;
    if (totalConnections < this.config.maxSize) {
      const conn = this.createConnection();
      this.active.add(conn);
      return conn;
    }

    // Pool exhausted — wait in queue
    return this.waitForConnection();
  }

  /**
   * Release a connection back to the pool.
   * If waiters are queued, hand it directly to the next waiter.
   */
  release(conn: Connection): void {
    if (!this.active.has(conn)) {
      throw new Error(`Connection ${conn.id} is not active`);
    }

    this.active.delete(conn);
    conn.lastUsedAt = Date.now();

    // If someone is waiting, give them this connection directly
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      clearTimeout(waiter.timer);
      this.active.add(conn);
      waiter.resolve(conn);
      return;
    }

    this.idle.push(conn);
  }

  /**
   * Destroy a connection (don't return to pool).
   * Used when a connection is known to be broken.
   */
  destroy(conn: Connection): void {
    this.active.delete(conn);
    conn.healthy = false;

    // If below minSize, create a replacement
    const total = this.active.size + this.idle.length;
    if (total < this.config.minSize) {
      const replacement = this.createConnection();
      this.idle.push(replacement);
    }
  }

  /**
   * Shut down the pool — reject all waiters, clear all connections.
   */
  async shutdown(): Promise<void> {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }

    // Reject all waiters
    for (const waiter of this.waitQueue) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Pool shutting down'));
    }
    this.waitQueue = [];

    // Clear connections
    this.idle = [];
    this.active.clear();
  }

  /**
   * Get pool statistics.
   */
  stats(): { idle: number; active: number; waiting: number; total: number } {
    return {
      idle: this.idle.length,
      active: this.active.size,
      waiting: this.waitQueue.length,
      total: this.idle.length + this.active.size,
    };
  }

  // --- Private methods ---

  private createConnection(): Connection {
    return {
      id: `conn_${this.nextId++}`,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      lastHealthCheck: Date.now(),
      healthy: true,
    };
  }

  private needsHealthCheck(conn: Connection): boolean {
    return Date.now() - conn.lastHealthCheck > this.config.healthCheckIntervalMs;
  }

  private async checkHealth(conn: Connection): Promise<boolean> {
    conn.lastHealthCheck = Date.now();
    // Simulate health check — in production this would ping the DB
    conn.healthy = true;
    return conn.healthy;
  }

  private waitForConnection(): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waitQueue.findIndex(w => w.timer === timer);
        if (idx >= 0) {
          this.waitQueue.splice(idx, 1);
        }
        reject(new Error(`Acquire timeout after ${this.config.acquireTimeoutMs}ms`));
      }, this.config.acquireTimeoutMs);

      this.waitQueue.push({ resolve, reject, timer });
    });
  }

  private startEvictionTimer(): void {
    this.evictionTimer = setInterval(() => {
      this.evictIdleConnections();
    }, this.config.idleTimeoutMs / 2);
  }

  /**
   * Evict idle connections that have exceeded the idle timeout.
   * Always keeps at least minSize connections in the pool.
   */
  private evictIdleConnections(): void {
    const now = Date.now();
    const total = this.active.size + this.idle.length;

    // Only evict if we're above minSize
    let evictable = total - this.config.minSize;

    this.idle = this.idle.filter(conn => {
      if (evictable <= 0) return true;
      const idleTime = now - conn.lastUsedAt;
      if (idleTime >= this.config.idleTimeoutMs) {
        evictable--;
        return false; // evict
      }
      return true;
    });
  }
}

/**
 * Utility: run a callback with a pooled connection, ensuring release.
 */
export async function withConnection<T>(
  pool: ConnectionPool,
  fn: (conn: Connection) => Promise<T>,
): Promise<T> {
  const conn = await pool.acquire();
  try {
    const result = await fn(conn);
    pool.release(conn);
    return result;
  } catch (err) {
    pool.destroy(conn);
    throw err;
  }
}

/**
 * Batch acquire multiple connections at once.
 * Returns connections in order. If any acquisition fails,
 * releases all previously acquired connections.
 */
export async function batchAcquire(
  pool: ConnectionPool,
  count: number,
): Promise<Connection[]> {
  const connections: Connection[] = [];
  try {
    for (let i = 0; i < count; i++) {
      const conn = await pool.acquire();
      connections.push(conn);
    }
    return connections;
  } catch (err) {
    // Release any we already got
    for (const conn of connections) {
      pool.release(conn);
    }
    throw err;
  }
}
