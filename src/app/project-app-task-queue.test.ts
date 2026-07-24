import { describe, expect, it } from "bun:test";
import { ProjectAppTaskQueue } from "./project-app-task-queue.js";

describe("ProjectAppTaskQueue", () => {
  it("deduplicates pending task wakes", () => {
    const queue = new ProjectAppTaskQueue(2);
    expect(queue.enqueue("task-a")).toBe(true);
    expect(queue.enqueue("task-a")).toBe(false);
    expect(queue.snapshot()).toEqual({ pending: ["task-a"], running: [], dirty: [] });
  });

  it("promotes targeted pending work without duplicating it", () => {
    const queue = new ProjectAppTaskQueue(1);
    queue.enqueue("old-a");
    queue.enqueue("goal");
    queue.enqueue("old-b");

    expect(queue.enqueue("goal", { front: true })).toBe(true);
    expect(queue.snapshot().pending).toEqual(["goal", "old-a", "old-b"]);
    expect(queue.enqueue("goal", { front: true })).toBe(false);
  });

  it("preserves FIFO order within the front lane", () => {
    const queue = new ProjectAppTaskQueue(1);
    queue.enqueue("old-a");
    queue.enqueue("urgent-a", { front: true });
    queue.enqueue("old-b");
    queue.enqueue("urgent-b", { front: true });
    queue.enqueue("old-b", { front: true });

    expect(queue.snapshot().pending).toEqual(["urgent-a", "urgent-b", "old-b", "old-a"]);
    expect(queue.take()).toBe("urgent-a");
    queue.complete("urgent-a");
    expect(queue.take()).toBe("urgent-b");
  });

  it("runs oldest ordinary work after a bounded urgent burst", () => {
    const queue = new ProjectAppTaskQueue(1);
    queue.enqueue("old-a");
    queue.enqueue("old-b");
    for (const taskId of ["urgent-a", "urgent-b", "urgent-c", "urgent-d", "urgent-e"]) {
      queue.enqueue(taskId, { front: true });
    }

    for (const taskId of ["urgent-a", "urgent-b", "urgent-c", "old-a", "urgent-d"]) {
      expect(queue.take()).toBe(taskId);
      queue.complete(taskId);
    }
  });

  it("preserves front promotion for a wake received while running", () => {
    const queue = new ProjectAppTaskQueue(1);
    queue.enqueue("goal");
    expect(queue.take()).toBe("goal");
    queue.enqueue("old-a");
    queue.enqueue("goal", { front: true });

    queue.complete("goal");
    expect(queue.snapshot().pending).toEqual(["goal", "old-a"]);
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
