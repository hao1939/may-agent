/**
 * Session Logger — structured logging for iteration events
 * Captures events as JSON lines for observability and analysis
 */

import * as fs from 'fs';
import * as path from 'path';

export interface LogEvent {
  type: 'iteration-start' | 'iteration-end' | 'error' | 'checkpoint' | 'retry' | 'validation' | 'custom';
  task?: string;
  duration?: number;
  outcome?: 'success' | 'failure' | 'skipped';
  error?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface StoredEvent extends LogEvent {
  timestamp: string;
}

export interface LogSummary {
  totalIterations: number;
  successRate: number;
  avgDuration: number;
  errorCount: number;
  firstEvent: string | null;
  lastEvent: string | null;
}

export interface EventFilter {
  type?: LogEvent['type'];
  outcome?: LogEvent['outcome'];
  since?: string;
  until?: string;
}

export interface Logger {
  log(event: LogEvent): void;
  getEvents(filter?: EventFilter): StoredEvent[];
  summary(): LogSummary;
  clear(): void;
}

export function createLogger(logPath: string): Logger {
  // Ensure directory exists
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  function log(event: LogEvent): void {
    const stored: StoredEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };
    fs.appendFileSync(logPath, JSON.stringify(stored) + '\n', 'utf-8');
  }

  function readAllEvents(): StoredEvent[] {
    if (!fs.existsSync(logPath)) {
      return [];
    }
    const content = fs.readFileSync(logPath, 'utf-8').trim();
    if (!content) return [];
    return content.split('\n').map(line => {
      try {
        return JSON.parse(line) as StoredEvent;
      } catch {
        return null;
      }
    }).filter((e): e is StoredEvent => e !== null);
  }

  function getEvents(filter?: EventFilter): StoredEvent[] {
    let events = readAllEvents();
    if (!filter) return events;

    if (filter.type) {
      events = events.filter(e => e.type === filter.type);
    }
    if (filter.outcome) {
      events = events.filter(e => e.outcome === filter.outcome);
    }
    if (filter.since) {
      events = events.filter(e => e.timestamp >= filter.since!);
    }
    if (filter.until) {
      events = events.filter(e => e.timestamp <= filter.until!);
    }
    return events;
  }

  function summary(): LogSummary {
    const events = readAllEvents();
    const iterations = events.filter(e => e.type === 'iteration-end');
    const successes = iterations.filter(e => e.outcome === 'success');
    const durations = iterations.filter(e => typeof e.duration === 'number').map(e => e.duration!);
    const errors = events.filter(e => e.type === 'error' || e.outcome === 'failure');

    return {
      totalIterations: iterations.length,
      successRate: iterations.length > 0 ? successes.length / iterations.length : 0,
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      errorCount: errors.length,
      firstEvent: events.length > 0 ? events[0].timestamp : null,
      lastEvent: events.length > 0 ? events[events.length - 1].timestamp : null,
    };
  }

  function clear(): void {
    if (fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '', 'utf-8');
    }
  }

  return { log, getEvents, summary, clear };
}
