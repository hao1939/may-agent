import { describe, expect, it } from "bun:test";
import { ProjectAppTaskQueue } from "./project-app-task-queue.js";

describe("ProjectAppTaskQueue", () => {
  it("deduplicates pending task wakes", () => {
    const queue = new ProjectAppTaskQueue(2);
    expect(queue.enqueue("task-a")).toBe(true);
    expect(queue.enqueue("task-a")).toBe(false);
    expect(queue.snapshot()).toEqual({ pending: ["task-a"], running: [], dirty: [] });
  });

  it("enforces app concurrency and preserves FIFO order", () => {
    const queue = new ProjectAppTaskQueue(1);
    queue.enqueue("task-a");
    queue.enqueue("task-b");
    expect(queue.take()).toBe("task-a");
    expect(queue.take()).toBeNull();
    queue.complete("task-a");
    expect(queue.take()).toBe("task-b");
  });

  it("runs one fresh pass when a task changes during reconciliation", () => {
    const queue = new ProjectAppTaskQueue(1);
    queue.enqueue("task-a");
    expect(queue.take()).toBe("task-a");
    expect(queue.enqueue("task-a")).toBe(true);
    expect(queue.enqueue("task-a")).toBe(false);
    expect(queue.snapshot().dirty).toEqual(["task-a"]);
    queue.complete("task-a");
    expect(queue.snapshot()).toEqual({ pending: ["task-a"], running: [], dirty: [] });
  });

  it("rejects invalid limits, keys, and completions", () => {
    expect(() => new ProjectAppTaskQueue(0)).toThrow("positive integer");
    const queue = new ProjectAppTaskQueue(1);
    expect(() => queue.enqueue(" ")).toThrow("non-empty task ID");
    expect(() => queue.complete("missing")).toThrow("not running");
  });
});
