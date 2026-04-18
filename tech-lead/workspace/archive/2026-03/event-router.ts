/**
 * EventRouter - Routes events to registered handlers by type.
 * Used by the agent system to dispatch lifecycle events.
 */

interface EventHandler {
  type: string;
  priority: number;
  handler: (event: Event) => Promise<void>;
}

interface Event {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export class EventRouter {
  private handlers: EventHandler[] = [];
  private eventLog: Event[] = [];

  /**
   * Register a handler for a specific event type.
   * Handlers are sorted by priority (lower = higher priority).
   */
  register(type: string, handler: (event: Event) => Promise<void>, priority: number = 10): void {
    this.handlers.push({ type, priority, handler });
    this.handlers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Dispatch an event to all matching handlers.
   * Returns the number of handlers that executed successfully.
   */
  async dispatch(event: Event): Promise<number> {
    this.eventLog.push(event);
    const matching = this.handlers.filter(h => h.type === event.type);
    let successCount = 0;

    for (let i = 0; i < matching.length; i++) {
      try {
        await matching[i].handler(event);
        successCount++;
      } catch (err) {
        console.error(`Handler failed for event ${event.type}:`, err);
      }
    }

    return successCount;
  }

  /**
   * Get the last N events from the log.
   */
  getRecentEvents(n: number): Event[] {
    return this.eventLog.slice(-n);
  }

  /**
   * Remove all handlers for a specific type.
   */
  unregister(type: string): number {
    const before = this.handlers.length;
    this.handlers = this.handlers.filter(h => h.type !== type);
    return before - this.handlers.length;
  }

  /**
   * Get handler count by type.
   */
  getHandlerCount(type?: string): number {
    if (type) {
      return this.handlers.filter(h => h.type === type).length;
    }
    return this.handlers.length;
  }
}
