/**
 * EventStore - Persistent event store with TTL-based expiration.
 * Events are stored with timestamps and automatically expire after their TTL.
 * Supports querying by type, time range, and tag filters.
 */

export interface StoredEvent {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  ttl: number;       // Time-to-live in milliseconds
  tags: string[];
}

export class EventStore {
  private events: Map<string, StoredEvent> = new Map();
  private defaultTtl: number;

  constructor(defaultTtl: number = 3600000) {  // 1 hour default
    this.defaultTtl = defaultTtl;
  }

  store(event: Omit<StoredEvent, 'ttl'> & { ttl?: number }): void {
    const stored: StoredEvent = {
      ...event,
      ttl: event.ttl ?? this.defaultTtl,
    };
    this.events.set(stored.id, stored);
  }

  get(id: string): StoredEvent | undefined {
    const event = this.events.get(id);
    if (!event) return undefined;

    if (this.isExpired(event)) {
      this.events.delete(id);
      return undefined;
    }

    return event;
  }

  /**
   * Query events by type, returning only non-expired events.
   */
  queryByType(type: string): StoredEvent[] {
    this.purgeExpired();
    const results: StoredEvent[] = [];
    for (const event of Array.from(this.events.values())) {
      if (event.type === type) {
        results.push(event);
      }
    }
    return results;
  }

  /**
   * Query events within a time range.
   */
  queryByTimeRange(start: number, end: number): StoredEvent[] {
    this.purgeExpired();
    const results: StoredEvent[] = [];
    for (const event of Array.from(this.events.values())) {
      if (event.timestamp >= start && event.timestamp <= end) {
        results.push(event);
      }
    }
    return results;
  }

  /**
   * Query events that have ALL specified tags.
   */
  queryByTags(tags: string[]): StoredEvent[] {
    this.purgeExpired();
    const results: StoredEvent[] = [];
    for (const event of Array.from(this.events.values())) {
      const hasAllTags = tags.every(tag => event.tags.includes(tag));
      if (hasAllTags) {
        results.push(event);
      }
    }
    return results;
  }

  /**
   * Get total count of non-expired events.
   */
  count(): number {
    this.purgeExpired();
    return this.events.size;
  }

  /**
   * Remove all expired events and return how many were removed.
   */
  purgeExpired(): number {
    let removed = 0;
    for (const [id, event] of Array.from(this.events.entries())) {
      if (this.isExpired(event)) {
        this.events.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Check if an event has expired based on its timestamp and TTL.
   */
  private isExpired(event: StoredEvent): boolean {
    const now = Date.now();
    return now - event.timestamp > event.ttl;
  }

  /**
   * Get events expiring within the next N milliseconds.
   */
  getExpiringSoon(withinMs: number): StoredEvent[] {
    this.purgeExpired();
    const now = Date.now();
    const results: StoredEvent[] = [];
    for (const event of Array.from(this.events.values())) {
      const expiresAt = event.timestamp + event.ttl;
      const timeLeft = expiresAt - now;
      if (timeLeft > 0 && timeLeft <= withinMs) {
        results.push(event);
      }
    }
    return results;
  }
}
