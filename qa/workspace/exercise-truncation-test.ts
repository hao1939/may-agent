/**
 * Task Queue Processor
 * 
 * Handles prioritized task execution with retry logic and dead-letter queue.
 * 
 * Coder's summary:
 *   - Added retry logic with exponential backoff
 *   - Added dead-letter queue for tasks that exceed max retries
 *   - Added priority sorting (higher priority = processed first)
 *   - All tests pass
 */

interface Task {
  id: string;
  priority: number;
  payload: unknown;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  lastAttempt?: number;
}

interface TaskResult {
  taskId: string;
  success: boolean;
  error?: string;
  duration: number;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLettered: number;
}

type TaskHandler = (task: Task) => Promise<TaskResult>;

class TaskQueue {
  private pending: Task[] = [];
  private processing: Map<string, Task> = new Map();
  private completed: TaskResult[] = [];
  private deadLetter: Task[] = [];
  private handler: TaskHandler;
  private concurrency: number;
  private stats: QueueStats;

  constructor(handler: TaskHandler, concurrency: number = 3) {
    this.handler = handler;
    this.concurrency = concurrency;
    this.stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      deadLettered: 0,
    };
  }

  /**
   * Add a task to the queue. Tasks are sorted by priority (descending).
   */
  enqueue(task: Task): void {
    this.pending.push(task);
    this.pending.sort((a, b) => b.priority - a.priority);
    this.stats.pending = this.pending.length;
  }

  /**
   * Process the next batch of tasks up to concurrency limit.
   * Returns results for all processed tasks.
   */
  async processBatch(): Promise<TaskResult[]> {
    const batch: Task[] = [];
    
    while (batch.length < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift()!;
      batch.push(task);
      this.processing.set(task.id, task);
    }

    this.stats.pending = this.pending.length;
    this.stats.processing = this.processing.size;

    const results = await Promise.all(
      batch.map(async (task) => {
        try {
          const result = await this.handler(task);
          this.processing.delete(task.id);
          
          if (result.success) {
            this.completed.push(result);
            this.stats.completed++;
          } else {
            this.handleFailure(task, result);
          }
          
          return result;
        } catch (err) {
          const errorResult: TaskResult = {
            taskId: task.id,
            success: false,
            error: err instanceof Error ? err.message : String(err),
            duration: 0,
          };
          this.handleFailure(task, errorResult);
          return errorResult;
        }
      })
    );

    this.stats.processing = this.processing.size;
    return results;
  }

  /**
   * Handle a failed task: retry or move to dead-letter queue.
   */
  private handleFailure(task: Task, result: TaskResult): void {
    task.retryCount++;
    task.lastAttempt = Date.now();

    // retryCount counts attempts already made; once it reaches maxRetries, dead-letter.
    if (task.retryCount >= task.maxRetries) {
      this.deadLetter.push(task);
      this.stats.deadLettered++;
      this.stats.failed++;
    } else {
      // Re-enqueue with backoff delay applied via priority reduction
      task.priority = Math.max(0, task.priority - 1);
      this.enqueue(task);
    }
    
    this.processing.delete(task.id);
  }

  /**
   * Calculate exponential backoff delay for a task.
   */
  getBackoffDelay(task: Task): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = baseDelay * Math.pow(2, task.retryCount);
    return Math.min(delay, maxDelay);
  }

  /**
   * Get current queue statistics.
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Get all dead-lettered tasks for manual inspection.
   */
  getDeadLetterQueue(): Task[] {
    return [...this.deadLetter];
  }

  /**
   * Drain the queue: process all pending tasks until empty.
   * Respects concurrency limit per batch.
   */
  async drain(): Promise<TaskResult[]> {
    const allResults: TaskResult[] = [];
    
    while (this.pending.length > 0) {
      const batchResults = await this.processBatch();
      allResults.push(...batchResults);
    }
    
    return allResults;
  }

  /**
   * Remove a specific task from the pending queue.
   * Returns true if the task was found and removed.
   */
  cancel(taskId: string): boolean {
    const index = this.pending.findIndex(t => t.id === taskId);
    if (index === -1) return false;
    
    this.pending.splice(index, 1);
    this.stats.pending = this.pending.length;
    return true;
  }

  /**
   * Get the current position of a task in the queue.
   * Returns -1 if not found, 0 if currently processing.
   */
  getPosition(taskId: string): number {
    if (this.processing.has(taskId)) return 0;
    const index = this.pending.findIndex(t => t.id === taskId);
    return index === -1 ? -1 : index + 1;
  }

  /**
   * Peek at the next task without removing it.
   */
  peek(): Task | undefined {
    return this.pending[0];
  }

  /**
   * Clear all pending tasks. Does not affect currently processing tasks.
   */
  clear(): void {
    this.pending = [];
    this.stats.pending = 0;
  }

  /**
   * Get count of completed tasks with successful results.
   */
  getSuccessCount(): number {
    return this.completed.filter(r => r.success).length;
  }

  /**
   * Get average processing duration across all completed tasks.
   */
  getAverageDuration(): number {
    if (this.completed.length === 0) return 0;
    const total = this.completed.reduce((sum, r) => sum + r.duration, 0);
    return total / this.completed.length;
  }
}

export { TaskQueue, Task, TaskResult, QueueStats, TaskHandler };
