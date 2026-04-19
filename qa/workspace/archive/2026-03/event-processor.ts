/**
 * EventProcessor - Processes events in batches with priority ordering.
 * Events are queued and processed in configurable batch sizes.
 * Higher-priority events are processed first within each batch.
 */

export interface QueuedEvent {
  id: string;
  type: string;
  payload: unknown;
  priority: number;  // 1 = highest, 10 = lowest
  timestamp: number;
  retries: number;
}

export interface ProcessResult {
  eventId: string;
  success: boolean;
  error?: string;
}

type ProcessorFn = (event: QueuedEvent) => Promise<ProcessResult>;

export class EventProcessor {
  private queue: QueuedEvent[] = [];
  private processing: boolean = false;
  private batchSize: number;
  private maxRetries: number;
  private deadLetter: QueuedEvent[] = [];
  private processorFn: ProcessorFn;

  constructor(
    processorFn: ProcessorFn,
    batchSize: number = 10,
    maxRetries: number = 3
  ) {
    this.processorFn = processorFn;
    this.batchSize = batchSize;
    this.maxRetries = maxRetries;
  }

  enqueue(event: Omit<QueuedEvent, 'retries'>): void {
    this.queue.push({ ...event, retries: 0 });
  }

  async processBatch(): Promise<ProcessResult[]> {
    if (this.processing) {
      throw new Error('Already processing a batch');
    }
    this.processing = true;

    try {
      // Sort by priority (lower number = higher priority)
      this.queue.sort((a, b) => a.priority - b.priority);

      // Take a batch
      const batch = this.queue.splice(0, this.batchSize);
      const results: ProcessResult[] = [];

      for (let i = 0; i < batch.length; i++) {
        const event = batch[i];
        try {
          const result = await this.processorFn(event);
          results.push(result);
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          results.push({ eventId: event.id, success: false, error });

          // Retry logic
          event.retries++;
          if (event.retries <= this.maxRetries) {
            this.queue.push(event);
          } else {
            this.deadLetter.push(event);
          }
        }
      }

      return results;
    } finally {
      this.processing = false;
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getDeadLetterQueue(): QueuedEvent[] {
    return [...this.deadLetter];
  }

  /**
   * Drain: process all queued events in batches until queue is empty.
   * Returns total results across all batches.
   */
  async drain(): Promise<ProcessResult[]> {
    const allResults: ProcessResult[] = [];
    while (this.queue.length > 0) {
      const batchResults = await this.processBatch();
      allResults.push(...batchResults);
    }
    return allResults;
  }

  /**
   * Peek at the next N events that would be processed (in priority order).
   */
  peek(n: number = 5): QueuedEvent[] {
    const sorted = [...this.queue].sort((a, b) => a.priority - b.priority);
    return sorted.slice(0, Math.min(n, sorted.length));
  }

  /**
   * Remove all events of a specific type from the queue.
   * Returns the number of events removed.
   */
  purgeByType(type: string): number {
    const before = this.queue.length;
    this.queue = this.queue.filter(e => e.type !== type);
    return before - this.queue.length;
  }
}
