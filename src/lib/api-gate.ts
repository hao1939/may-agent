/**
 * ApiGate — concurrency limiter per API endpoint.
 *
 * Prevents "Request was aborted" errors from hitting provider rate limits
 * when multiple agent sessions stream from the same API simultaneously.
 *
 * Key by baseUrl: same provider at different URLs gets separate limits.
 * Sessions acquire a slot before making an LLM call and release after.
 * If all slots are taken, the session waits in a FIFO queue.
 *
 * Observable: emits events on the EventBus so the system can see
 * queue depth and adjust (e.g., agents can check if the API is busy).
 */

export interface ApiGateConfig {
  /** Default max concurrent streaming sessions per endpoint. */
  defaultConcurrency: number;
  /** Per-endpoint overrides. Key: baseUrl or provider name. */
  overrides?: Record<string, number>;
}

interface QueueEntry {
  resolve: () => void;
  sessionId: string;
  agent: string;
  queuedAt: number;
}

interface EndpointState {
  active: number;
  limit: number;
  queue: QueueEntry[];
  /** Session IDs currently holding a slot. */
  holders: Set<string>;
}

export interface ApiGateStatus {
  endpoint: string;
  active: number;
  limit: number;
  queued: number;
  queuedAgents: string[];
}

export class ApiGate {
  private endpoints = new Map<string, EndpointState>();
  private config: ApiGateConfig;
  private onEvent?: (event: {
    type: "api_gate";
    action: "acquired" | "queued" | "released" | "timeout";
    endpoint: string;
    sessionId: string;
    agent: string;
    active: number;
    queued: number;
    waitMs?: number;
  }) => void;

  constructor(config: ApiGateConfig, onEvent?: ApiGate["onEvent"]) {
    this.config = config;
    this.onEvent = onEvent;
  }

  /** Get or create endpoint state. */
  private getEndpoint(baseUrl: string): EndpointState {
    let ep = this.endpoints.get(baseUrl);
    if (!ep) {
      const limit =
        this.config.overrides?.[baseUrl] ?? this.config.defaultConcurrency;
      ep = { active: 0, limit, queue: [], holders: new Set() };
      this.endpoints.set(baseUrl, ep);
    }
    return ep;
  }

  /**
   * Acquire a slot for the given endpoint. Resolves immediately if a slot
   * is available, otherwise waits in queue until one opens up.
   *
   * Returns a release function that MUST be called when the LLM call completes.
   */
  async acquire(
    baseUrl: string,
    sessionId: string,
    agent: string,
    signal?: AbortSignal,
  ): Promise<() => void> {
    const ep = this.getEndpoint(baseUrl);

    // Fast path: slot available
    if (ep.active < ep.limit) {
      ep.active++;
      ep.holders.add(sessionId);
      this.onEvent?.({
        type: "api_gate",
        action: "acquired",
        endpoint: baseUrl,
        sessionId,
        agent,
        active: ep.active,
        queued: ep.queue.length,
      });
      return this.makeRelease(baseUrl, sessionId, agent);
    }

    // Slow path: queue and wait
    const queuedAt = Date.now();
    this.onEvent?.({
      type: "api_gate",
      action: "queued",
      endpoint: baseUrl,
      sessionId,
      agent,
      active: ep.active,
      queued: ep.queue.length + 1,
    });

    return new Promise<() => void>((resolve, reject) => {
      const entry: QueueEntry = {
        resolve: () => {
          ep.active++;
          ep.holders.add(sessionId);
          this.onEvent?.({
            type: "api_gate",
            action: "acquired",
            endpoint: baseUrl,
            sessionId,
            agent,
            active: ep.active,
            queued: ep.queue.length,
            waitMs: Date.now() - queuedAt,
          });
          resolve(this.makeRelease(baseUrl, sessionId, agent));
        },
        sessionId,
        agent,
        queuedAt,
      };
      ep.queue.push(entry);

      // If the session is aborted while waiting, remove from queue
      signal?.addEventListener(
        "abort",
        () => {
          const idx = ep.queue.indexOf(entry);
          if (idx >= 0) {
            ep.queue.splice(idx, 1);
            this.onEvent?.({
              type: "api_gate",
              action: "timeout",
              endpoint: baseUrl,
              sessionId,
              agent,
              active: ep.active,
              queued: ep.queue.length,
              waitMs: Date.now() - queuedAt,
            });
            reject(new Error("Request was aborted."));
          }
        },
        { once: true },
      );
    });
  }

  /** Create a release function for a held slot. */
  private makeRelease(
    baseUrl: string,
    sessionId: string,
    agent: string,
  ): () => void {
    let released = false;
    return () => {
      if (released) return; // idempotent
      released = true;
      const ep = this.endpoints.get(baseUrl);
      if (!ep) return;

      ep.active--;
      ep.holders.delete(sessionId);
      this.onEvent?.({
        type: "api_gate",
        action: "released",
        endpoint: baseUrl,
        sessionId,
        agent,
        active: ep.active,
        queued: ep.queue.length,
      });

      // Wake the next waiter
      if (ep.queue.length > 0) {
        const next = ep.queue.shift()!;
        next.resolve();
      }
    };
  }

  /** Get status of all endpoints (for observability). */
  status(): ApiGateStatus[] {
    const result: ApiGateStatus[] = [];
    for (const [endpoint, ep] of this.endpoints) {
      result.push({
        endpoint,
        active: ep.active,
        limit: ep.limit,
        queued: ep.queue.length,
        queuedAgents: ep.queue.map((e) => e.agent),
      });
    }
    return result;
  }

  /** Check if an endpoint has available slots (non-blocking). */
  hasCapacity(baseUrl: string): boolean {
    const ep = this.endpoints.get(baseUrl);
    if (!ep) return true;
    return ep.active < ep.limit;
  }

  /** Force-release all slots for a session (cleanup on cancel/error). */
  releaseAll(sessionId: string): void {
    for (const [_baseUrl, ep] of this.endpoints) {
      if (ep.holders.has(sessionId)) {
        ep.active--;
        ep.holders.delete(sessionId);
        // Wake next waiter
        if (ep.queue.length > 0) {
          const next = ep.queue.shift()!;
          next.resolve();
        }
      }
      // Also remove from queue if waiting
      const idx = ep.queue.findIndex((e) => e.sessionId === sessionId);
      if (idx >= 0) {
        ep.queue.splice(idx, 1);
      }
    }
  }
}
