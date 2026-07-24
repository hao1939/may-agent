import { describe, expect, it } from "bun:test";
import { ProjectAppTaskCapacity, ProjectAppTaskController } from "./project-app-task-controller.js";

async function waitUntil(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

describe("ProjectAppTaskController", () => {
  it("runs deduplicated keys through one bounded worker pool", async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const controller = new ProjectAppTaskController({
      maxConcurrent: 1,
      reconcile: (taskId) =>
        new Promise<void>((resolve) => {
          started.push(taskId);
          releases.set(taskId, resolve);
        }),
    });

    controller.enqueue("a");
    controller.enqueue("a");
    controller.enqueue("b");
    await waitUntil(() => started.length === 1);
    expect(started).toEqual(["a"]);
    releases.get("a")?.();
    await waitUntil(() => started.length === 2);
    expect(started).toEqual(["a", "b"]);
    releases.get("b")?.();
    await waitUntil(() => !controller.snapshot().running.length);
    controller.close();
  });

  it("runs independent task keys concurrently up to the app limit", async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const controller = new ProjectAppTaskController({
      maxConcurrent: 2,
      reconcile: (taskId) =>
        new Promise<void>((resolve) => {
          started.push(taskId);
          releases.set(taskId, resolve);
        }),
    });

    controller.enqueue("focus-a");
    controller.enqueue("focus-b");
    controller.enqueue("focus-c");
    await waitUntil(() => started.length === 2);
    expect(new Set(started)).toEqual(new Set(["focus-a", "focus-b"]));
    expect(controller.snapshot().running).toHaveLength(2);
    expect(controller.snapshot().pending).toEqual(["focus-c"]);

    releases.get("focus-a")?.();
    await waitUntil(() => started.includes("focus-c"));
    expect(controller.snapshot().running).toHaveLength(2);
    releases.get("focus-b")?.();
    releases.get("focus-c")?.();
    await waitUntil(() => !controller.snapshot().running.length);
    controller.close();
  });

  it("shares one daemon capacity across independent app controllers", async () => {
    const capacity = new ProjectAppTaskCapacity(1);
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const controllerA = new ProjectAppTaskController({
      maxConcurrent: 2,
      capacity,
      reconcile: (taskId) =>
        new Promise<void>((resolve) => {
          started.push(`a:${taskId}`);
          releases.set(`a:${taskId}`, resolve);
        }),
    });
    const controllerB = new ProjectAppTaskController({
      maxConcurrent: 2,
      capacity,
      reconcile: (taskId) =>
        new Promise<void>((resolve) => {
          started.push(`b:${taskId}`);
          releases.set(`b:${taskId}`, resolve);
        }),
    });

    controllerA.enqueue("one");
    controllerB.enqueue("two");
    await waitUntil(() => started.length === 1);
    expect(capacity.snapshot()).toEqual({ running: 1, waiting: 1 });

    releases.get(started[0])?.();
    await waitUntil(() => started.length === 2);
    expect(new Set(started)).toEqual(new Set(["a:one", "b:two"]));
    releases.get(started[1])?.();
    await waitUntil(() => capacity.snapshot().running === 0);
    controllerA.close();
    controllerB.close();
  });

  it("chooses the current front task only after shared capacity is available", async () => {
    const capacity = new ProjectAppTaskCapacity(1);
    const started: string[] = [];
    let releaseBlocker: (() => void) | undefined;
    let releaseGoal: (() => void) | undefined;
    const blocker = new ProjectAppTaskController({
      maxConcurrent: 1,
      capacity,
      reconcile: () =>
        new Promise<void>((resolve) => {
          started.push("blocker");
          releaseBlocker = resolve;
        }),
    });
    const goal = new ProjectAppTaskController({
      maxConcurrent: 2,
      capacity,
      reconcile: (taskId) =>
        new Promise<void>((resolve) => {
          started.push(taskId);
          releaseGoal = resolve;
        }),
    });

    blocker.enqueue("blocker");
    await waitUntil(() => started.length === 1);
    goal.enqueue("older-a");
    goal.enqueue("older-b");
    await waitUntil(() => capacity.snapshot().waiting === 1);
    goal.enqueue("urgent-goal", { front: true });

    expect(goal.snapshot()).toMatchObject({
      pending: ["urgent-goal", "older-a", "older-b"],
      running: [],
    });
    releaseBlocker?.();
    await waitUntil(() => started.length === 2);
    expect(started).toEqual(["blocker", "urgent-goal"]);

    blocker.close();
    goal.close();
    releaseGoal?.();
    await waitUntil(() => capacity.snapshot().running === 0);
  });

  it("performs a fresh pass for a wake received during a run", async () => {
    let runs = 0;
    let release: (() => void) | undefined;
    const controller = new ProjectAppTaskController({
      maxConcurrent: 1,
      reconcile: async () => {
        runs++;
        if (runs === 1) await new Promise<void>((resolve) => (release = resolve));
      },
    });
    controller.enqueue("a");
    await waitUntil(() => runs === 1);
    controller.enqueue("a");
    controller.enqueue("a");
    release?.();
    await waitUntil(() => runs === 2);
    controller.close();
  });

  it("retries controller failures with bounded backoff", async () => {
    let runs = 0;
    const errors: boolean[] = [];
    const controller = new ProjectAppTaskController({
      maxConcurrent: 1,
      maxRetries: 2,
      retryDelayMs: () => 0,
      reconcile: async () => {
        runs++;
        if (runs < 3) throw new Error("temporary");
      },
      onError: (_taskId, _error, willRetry) => errors.push(willRetry),
    });
    controller.enqueue("a");
    await waitUntil(() => runs === 3);
    expect(errors).toEqual([true, true]);
    controller.close();
  });

  it("feeds periodic resync through the same deduplicating queue", async () => {
    let runs = 0;
    const controller = new ProjectAppTaskController({
      maxConcurrent: 1,
      resync: {
        intervalMs: 5,
        taskIds: () => ["standing-task", "standing-task"],
      },
      reconcile: async (taskId) => {
        expect(taskId).toBe("standing-task");
        runs++;
      },
    });

    await waitUntil(() => runs > 0);
    expect(controller.snapshot().running.length).toBeLessThanOrEqual(1);
    controller.close();
  });

  it("keeps replacement controllers behind the draining predecessor chain", async () => {
    const started: string[] = [];
    let releaseOld: (() => void) | undefined;
    const old = new ProjectAppTaskController({
      maxConcurrent: 1,
      reconcile: (taskId) =>
        new Promise<void>((resolve) => {
          started.push(taskId);
          releaseOld = resolve;
        }),
    });
    old.enqueue("old");
    await waitUntil(() => started.length === 1);
    old.close();

    const replacedBeforeStart = new ProjectAppTaskController({
      maxConcurrent: 1,
      startAfter: old.whenDrained(),
      reconcile: async (taskId) => {
        started.push(taskId);
      },
    });
    replacedBeforeStart.enqueue("discarded-on-reload");
    replacedBeforeStart.close();

    const current = new ProjectAppTaskController({
      maxConcurrent: 1,
      startAfter: replacedBeforeStart.whenDrained(),
      reconcile: async (taskId) => {
        started.push(taskId);
      },
    });
    current.enqueue("current");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(started).toEqual(["old"]);

    releaseOld?.();
    await waitUntil(() => started.includes("current"));
    expect(started).toEqual(["old", "current"]);
    current.close();
    await current.whenDrained();
  });
});
