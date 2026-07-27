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

  it("orders front-lane wakes by priority and preserves FIFO within one priority", () => {
    const queue = new ProjectAppTaskQueue(1);
    queue.enqueue("old-p2-a", { front: true, priority: "P2" });
    queue.enqueue("p0-terminal-wake", { front: true, priority: "P0" });
    queue.enqueue("old-p2-b", { front: true, priority: "P2" });

    for (const taskId of ["p0-terminal-wake", "old-p2-a", "old-p2-b"]) {
      expect(queue.take()).toBe(taskId);
      queue.complete(taskId);
    }
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

  it("orders ordinary work by priority and preserves FIFO within one priority", () => {
    const queue = new ProjectAppTaskQueue(1);
    queue.enqueue("old-p2", { priority: "P2" });
    queue.enqueue("first-p0", { priority: "P0" });
    queue.enqueue("second-p0", { priority: "P0" });
    queue.enqueue("p1", { priority: "P1" });

    for (const taskId of ["first-p0", "second-p0", "p1", "old-p2"]) {
      expect(queue.take()).toBe(taskId);
      queue.complete(taskId);
    }
  });

  it("runs prioritized ordinary work after the bounded continuation burst", () => {
    const queue = new ProjectAppTaskQueue(1);
    queue.enqueue("ordinary-p2", { priority: "P2" });
    queue.enqueue("ordinary-p0", { priority: "P0" });
    for (const taskId of ["wake-a", "wake-b", "wake-c", "wake-d"]) {
      queue.enqueue(taskId, { front: true, priority: "P2" });
    }

    for (const taskId of ["wake-a", "wake-b", "wake-c", "ordinary-p0", "wake-d"]) {
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
