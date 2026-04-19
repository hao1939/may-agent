/**
 * TaskScheduler — Priority-based task execution with concurrency limits.
 *
 * Tasks are queued with a priority (lower number = higher priority).
 * The scheduler processes up to `maxConcurrent` tasks simultaneously.
 * When a task completes, the next highest-priority task is dequeued.
 */

export interface Task {
  id: string;
  priority: number;
  execute: () => Promise<void>;
}

interface QueuedTask {
  task: Task;
  resolve: (value: void) => void;
  reject: (reason: unknown) => void;
}

export class TaskScheduler {
  private queue: QueuedTask[] = [];
  private running: number = 0;
  private readonly maxConcurrent: number;
  private completed: string[] = [];
  private failed: string[] = [];

  constructor(maxConcurrent: number) {
    if (maxConcurrent < 1) {
      throw new Error("maxConcurrent must be at least 1");
    }
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Submit a task for execution. Returns a promise that resolves
   * when the task completes.
   */
  async submit(task: Task): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.enqueue({ task, resolve, reject });
      this.processNext();
    });
  }

  /**
   * Insert into queue maintaining priority order.
   * Lower priority number = higher priority = closer to front.
   */
  private enqueue(item: QueuedTask): void {
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (item.task.priority < this.queue[i].task.priority) {
        insertIndex = i;
        break;
      }
    }
    this.queue.splice(insertIndex, 0, item);
  }

  /**
   * Attempt to run the next queued task if under concurrency limit.
   */
  private processNext(): void {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift()!;
    this.running++;

    item.task
      .execute()
      .then(() => {
        this.completed.push(item.task.id);
        item.resolve();
      })
      .catch((err) => {
        this.failed.push(item.task.id);
        item.reject(err);
      })
      .finally(() => {
        this.running--;
        this.processNext();
      });
  }

  /**
   * Drain the scheduler: wait until all submitted tasks have finished.
   * Returns the count of completed tasks.
   */
  async drain(): Promise<number> {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
    return this.completed.length;
  }

  /**
   * Cancel all pending (not yet running) tasks.
   * Returns the IDs of cancelled tasks.
   */
  cancelPending(): string[] {
    const cancelled = this.queue.map((item) => {
      item.reject(new Error("Task cancelled"));
      return item.task.id;
    });
    this.queue = [];
    return cancelled;
  }

  /**
   * Get a snapshot of scheduler stats.
   */
  getStats(): {
    queued: number;
    running: number;
    completed: number;
    failed: number;
  } {
    return {
      queued: this.queue.length,
      running: this.running,
      completed: this.completed.length,
      failed: this.failed.length,
    };
  }

  /**
   * Submit multiple tasks and wait for all to complete.
   * Returns the IDs of tasks that succeeded.
   */
  async submitBatch(tasks: Task[]): Promise<string[]> {
    const results: string[] = [];

    const promises = tasks.map(async (task) => {
      try {
        await this.submit(task);
        results.push(task.id);
      } catch {
        // Task failed — don't include in results
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get the next N tasks that would be executed, without removing them.
   * Useful for previewing the queue.
   */
  peek(n: number): Task[] {
    const count = Math.min(n, this.queue.length);
    const result: Task[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.queue[i].task);
    }
    return result;
  }

  /**
   * Remove a specific task from the queue by ID.
   * Returns true if the task was found and removed.
   */
  remove(taskId: string): boolean {
    const index = this.queue.findIndex((item) => item.task.id === taskId);
    if (index === -1) {
      return false;
    }
    const [removed] = this.queue.splice(index, 1);
    removed.reject(new Error("Task removed"));
    return true;
  }

  /**
   * Reprioritize a task already in the queue.
   * Returns true if the task was found and moved.
   */
  reprioritize(taskId: string, newPriority: number): boolean {
    const index = this.queue.findIndex((item) => item.task.id === taskId);
    if (index === -1) {
      return false;
    }
    const [item] = this.queue.splice(index, 1);
    item.task.priority = newPriority;
    this.enqueue(item);
    return true;
  }
}
