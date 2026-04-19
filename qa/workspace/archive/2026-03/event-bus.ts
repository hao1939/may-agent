/**
 * EventBus — A typed publish/subscribe event system with support for
 * one-time listeners, wildcard subscriptions, and event history replay.
 *
 * Used by the notification service and real-time dashboard.
 */

type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

interface Subscription {
  event: string;
  handler: EventHandler;
  once: boolean;
}

interface EventRecord {
  event: string;
  payload: unknown;
  timestamp: number;
}

export class EventBus {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private history: EventRecord[] = [];
  private maxHistorySize: number;
  private wildcardSubs: Subscription[] = [];

  constructor(options: { maxHistorySize?: number } = {}) {
    this.maxHistorySize = options.maxHistorySize ?? 100;
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    const sub: Subscription = { event, handler: handler as EventHandler, once: false };

    if (event === '*') {
      this.wildcardSubs.push(sub);
    } else {
      const subs = this.subscriptions.get(event) ?? [];
      subs.push(sub);
      this.subscriptions.set(event, subs);
    }

    return () => this.off(event, handler as EventHandler);
  }

  /**
   * Subscribe to an event for a single emission, then auto-unsubscribe.
   */
  once<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    const sub: Subscription = { event, handler: handler as EventHandler, once: true };

    if (event === '*') {
      this.wildcardSubs.push(sub);
    } else {
      const subs = this.subscriptions.get(event) ?? [];
      subs.push(sub);
      this.subscriptions.set(event, subs);
    }

    return () => this.off(event, handler as EventHandler);
  }

  /**
   * Remove a specific handler from an event.
   */
  off(event: string, handler: EventHandler): void {
    if (event === '*') {
      this.wildcardSubs = this.wildcardSubs.filter(s => s.handler !== handler);
      return;
    }

    const subs = this.subscriptions.get(event);
    if (!subs) return;

    const filtered = subs.filter(s => s.handler !== handler);
    if (filtered.length === 0) {
      this.subscriptions.delete(event);
    } else {
      this.subscriptions.set(event, filtered);
    }
  }

  /**
   * Emit an event to all subscribers. Wildcard subscribers receive all events.
   * One-time subscribers are removed after being called.
   */
  async emit(event: string, payload?: unknown): Promise<void> {
    // Record in history
    this.history.push({ event, payload, timestamp: Date.now() });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Notify specific subscribers
    const subs = this.subscriptions.get(event) ?? [];
    const onceSubs: Subscription[] = [];

    for (const sub of subs) {
      await sub.handler(payload);
      if (sub.once) {
        onceSubs.push(sub);
      }
    }

    // Remove one-time subscribers
    if (onceSubs.length > 0) {
      const remaining = subs.filter(s => !onceSubs.includes(s));
      this.subscriptions.set(event, remaining);
    }

    // Notify wildcard subscribers
    for (const sub of this.wildcardSubs) {
      await sub.handler(payload);
      if (sub.once) {
        this.wildcardSubs = this.wildcardSubs.filter(s => s !== sub);
      }
    }
  }

  /**
   * Replay the last N events from history to a handler.
   * Useful for late-joining subscribers who need to catch up.
   */
  replay(handler: EventHandler<EventRecord>, count?: number): void {
    const events = count
      ? this.history.slice(-count)
      : this.history;

    for (const record of events) {
      handler(record);
    }
  }

  /**
   * Get the number of subscribers for a specific event.
   * Includes wildcard subscribers.
   */
  listenerCount(event: string): number {
    const specific = this.subscriptions.get(event)?.length ?? 0;
    return specific + this.wildcardSubs.length;
  }

  /**
   * Remove all subscribers for a specific event, or all subscribers entirely.
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.subscriptions.delete(event);
    } else {
      this.subscriptions.clear();
      this.wildcardSubs = [];
    }
  }

  /**
   * Wait for a specific event to be emitted. Returns the payload.
   * Times out after the specified duration (default: 5000ms).
   */
  waitFor<T = unknown>(event: string, timeoutMs: number = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event "${event}" after ${timeoutMs}ms`));
      }, timeoutMs);

      this.once(event, (payload: unknown) => {
        clearTimeout(timer);
        resolve(payload as T);
      });
    });
  }

  /**
   * Pipe events from this bus to another bus.
   * All events emitted on this bus will be re-emitted on the target bus.
   */
  pipe(target: EventBus, filter?: string[]): () => void {
    const handler: EventHandler = (payload) => {
      const record = payload as EventRecord;
      if (!filter || filter.includes(record.event)) {
        target.emit(record.event, record.payload);
      }
    };

    this.on('*', handler);
    return () => this.off('*', handler);
  }

  /**
   * Get a snapshot of the event history.
   */
  getHistory(): EventRecord[] {
    return [...this.history];
  }

  /**
   * Clear all event history.
   */
  clearHistory(): void {
    this.history = [];
  }
}
