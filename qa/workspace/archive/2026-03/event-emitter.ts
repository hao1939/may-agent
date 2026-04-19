/**
 * EventEmitter - A typed event emitter with wildcard support.
 * Supports registering handlers for specific event names or wildcard patterns.
 */

type EventHandler<T = unknown> = (payload: T) => void;

interface EventRegistration {
  event: string;
  handler: EventHandler;
  once: boolean;
}

export class EventEmitter {
  private registrations: EventRegistration[] = [];
  private maxListeners: number;

  constructor(maxListeners: number = 100) {
    this.maxListeners = maxListeners;
  }

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (this.registrations.length >= this.maxListeners) {
      throw new Error(`Maximum listener count (${this.maxListeners}) reached.`);
    }
    const registration: EventRegistration = {
      event,
      handler: handler as EventHandler,
      once: false,
    };
    this.registrations.push(registration);
    return () => {
      const idx = this.registrations.indexOf(registration);
      if (idx !== -1) this.registrations.splice(idx, 1);
    };
  }

  once<T>(event: string, handler: EventHandler<T>): () => void {
    if (this.registrations.length >= this.maxListeners) {
      throw new Error(`Maximum listener count (${this.maxListeners}) reached.`);
    }
    const registration: EventRegistration = {
      event,
      handler: handler as EventHandler,
      once: true,
    };
    this.registrations.push(registration);
    return () => {
      const idx = this.registrations.indexOf(registration);
      if (idx !== -1) this.registrations.splice(idx, 1);
    };
  }

  emit<T>(event: string, payload: T): number {
    let count = 0;
    const toRemove: EventRegistration[] = [];
    for (const reg of this.registrations) {
      if (this.matches(reg.event, event)) {
        reg.handler(payload);
        count++;
        if (reg.once) toRemove.push(reg);
      }
    }
    for (const reg of toRemove) {
      const idx = this.registrations.indexOf(reg);
      if (idx !== -1) this.registrations.splice(idx, 1);
    }
    return count;
  }

  removeAll(event?: string): void {
    if (event === undefined) {
      this.registrations = [];
    } else {
      this.registrations = this.registrations.filter(r => r.event !== event);
    }
  }

  listenerCount(event: string): number {
    return this.registrations.filter(r => this.matches(r.event, event)).length;
  }

  private matches(pattern: string, event: string): boolean {
    if (pattern === event) return true;
    const patternParts = pattern.split('.');
    const eventParts = event.split('.');
    let pi = 0, ei = 0;
    while (pi < patternParts.length && ei < eventParts.length) {
      if (patternParts[pi] === '**') {
        if (pi === patternParts.length - 1) return true;
        for (let skip = 0; skip <= eventParts.length - ei; skip++) {
          if (this.matches(
            patternParts.slice(pi + 1).join('.'),
            eventParts.slice(ei + skip).join('.')
          )) return true;
        }
        return false;
      }
      if (patternParts[pi] === '*') { pi++; ei++; continue; }
      if (patternParts[pi] !== eventParts[ei]) return false;
      pi++; ei++;
    }
    return pi === patternParts.length && ei === eventParts.length;
  }
}
