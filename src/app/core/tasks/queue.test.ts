import { describe, expect, it } from "bun:test";
import { AppTaskQueue } from "./queue.js";

describe("AppTaskQueue", () => {
  it("deduplicates pending task wakes", () => {
    const queue = new AppTaskQueue(2);
    expect(queue.enqueue("task-a")).toBe(true);
    expect(queue.enqueue("task-a")).toBe(false);
    expect(queue.snapshot()).toEqual({ pending: ["task-a"], running: [], dirty: [] });
  });

  it("promotes a targeted wake ahead of passive peers without duplicating it", () => {
    const queue = new AppTaskQueue(1);
    for (let index = 0; index < 200; index++) queue.enqueue(`passive-${index}`, { priority: "P1" });
    queue.enqueue("exact-task", { priority: "P1" });

    expect(queue.enqueue("exact-task", { promote: true, priority: "P1" })).toBe(true);
    expect(queue.snapshot().pending.filter((taskId) => taskId === "exact-task")).toHaveLength(1);
    expect(queue.take()).toBe("exact-task");
    queue.complete("exact-task");
    expect(queue.take()).toBe("passive-0");
  });

  it("preserves FIFO order among fresh exact promotions", () => {
    const queue = new AppTaskQueue(1);
    queue.enqueue("passive-a", { priority: "P1" });
    queue.enqueue("exact-a", { priority: "P1" });
    queue.enqueue("passive-b", { priority: "P1" });
    queue.enqueue("exact-b", { priority: "P1" });

    queue.enqueue("exact-a", { promote: true, priority: "P1" });
    queue.enqueue("exact-b", { promote: true, priority: "P1" });
    expect(queue.snapshot().pending).toEqual(["exact-a", "exact-b", "passive-a", "passive-b"]);
  });

  it("orders work by priority and preserves FIFO within one priority", () => {
    const queue = new AppTaskQueue(1);
    queue.enqueue("old-p2", { priority: "P2" });
    queue.enqueue("first-p0", { priority: "P0" });
    queue.enqueue("second-p0", { priority: "P0" });
    queue.enqueue("p1", { priority: "P1" });

    for (const taskId of ["first-p0", "second-p0", "p1", "old-p2"]) {
      expect(queue.take()).toBe(taskId);
      queue.complete(taskId);
    }
  });

  it("does not let promotion override a higher persisted priority", () => {
    const queue = new AppTaskQueue(1);
    queue.enqueue("promoted-p2", { priority: "P2", promote: true });
    queue.enqueue("ordinary-p0", { priority: "P0" });

    expect(queue.take()).toBe("ordinary-p0");
    queue.complete("ordinary-p0");
    expect(queue.take()).toBe("promoted-p2");
  });

  it("runs trusted human work before normal work regardless of App priority", () => {
    const queue = new AppTaskQueue(1);
    queue.enqueue("normal-p0", { lane: "normal", promote: true, priority: "P0" });
    queue.enqueue("human-p2", { lane: "human", priority: "P2" });

    expect(queue.nextLane()).toBe("human");
    expect(queue.take()).toBe("human-p2");
    queue.complete("human-p2");
    expect(queue.nextLane()).toBe("normal");
    expect(queue.take()).toBe("normal-p0");
  });

  it("preserves exact promotion for a wake received while running", () => {
    const queue = new AppTaskQueue(1);
    queue.enqueue("goal");
    expect(queue.take()).toBe("goal");
    queue.enqueue("old-a");
    queue.enqueue("goal", { promote: true });

    queue.complete("goal");
    expect(queue.snapshot().pending).toEqual(["goal", "old-a"]);
  });

  it("preserves the human lane for a wake received while running", () => {
    const queue = new AppTaskQueue(1);
    queue.enqueue("conversation", { lane: "human" });
    expect(queue.take()).toBe("conversation");
    queue.enqueue("conversation");

    queue.complete("conversation");
    expect(queue.nextLane()).toBe("human");
    expect(queue.take()).toBe("conversation");
  });

  it("enforces App concurrency", () => {
    const queue = new AppTaskQueue(1);
    queue.enqueue("task-a");
    queue.enqueue("task-b");
    expect(queue.take()).toBe("task-a");
    expect(queue.take()).toBeNull();
    queue.complete("task-a");
    expect(queue.take()).toBe("task-b");
  });

  it("runs one fresh pass when a task changes during reconciliation", () => {
    const queue = new AppTaskQueue(1);
    queue.enqueue("task-a");
    expect(queue.take()).toBe("task-a");
    expect(queue.enqueue("task-a")).toBe(true);
    expect(queue.enqueue("task-a")).toBe(false);
    expect(queue.snapshot().dirty).toEqual(["task-a"]);
    queue.complete("task-a");
    expect(queue.snapshot()).toEqual({ pending: ["task-a"], running: [], dirty: [] });
  });

  it("keeps coordination's turn across background dispatches between human turns", () => {
    const queue = new AppTaskQueue(1, () => true,
      id => id.startsWith("human") || id === "review", id => id === "review");
    queue.enqueue("review", { priority: "P3" });
    for (const id of ["human-0", "human-1", "human-2"]) queue.enqueue(id, { lane: "human" });
    for (const index of [0, 1]) {
      const human = `human-${index}`;
      expect(queue.take()).toBe(human);
      const background = `background-${index}`;
      queue.enqueue(background, { priority: "P0" });
      expect(queue.take()).toBe(background);
      queue.complete(background);
      queue.complete(human);
    }
    expect(queue.take()).toBe("review");
  });

  it("only successful human takes count toward an eligible coordination turn", () => {
    let coordinationReady = true;
    const queue = new AppTaskQueue(1, id => id !== "review" || coordinationReady,
      id => id !== "ordinary", id => id === "review");
    queue.enqueue("review", { priority: "P3" });
    queue.enqueue("ordinary", { lane: "human", priority: "P0" });
    for (const id of ["human-0", "human-1", "human-2"]) queue.enqueue(id, { lane: "human" });
    for (const id of ["human-0", "human-1"]) {
      for (let count = 0; count < 10; count++) expect(queue.peek()?.taskId).toBe(id);
      expect(queue.take()).toBe(id);
      queue.complete(id);
    }
    coordinationReady = false;
    expect(queue.peek()?.taskId).toBe("human-2");
    coordinationReady = true;
    expect(queue.take()).toBe("review");
    queue.complete("review");
    expect(queue.take()).toBe("human-2");
  });

  it("rejects invalid limits, keys, and completions", () => {
    expect(() => new AppTaskQueue(0)).toThrow("positive integer");
    const queue = new AppTaskQueue(1);
    expect(() => queue.enqueue(" ")).toThrow("non-empty task ID");
    expect(() => queue.complete("missing")).toThrow("not running");
  });
});
