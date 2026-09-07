import { describe, expect, it } from "bun:test";
import { AppTaskController } from "././app-task-controller.js";
import { HostCapacity } from "./host-capacity.js";

async function waitUntil(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

describe("AppTaskController", () => {
  it("holds queued work behind an explicit startup gate", async () => {
    const started: string[] = [];
    let openGate = () => {};
    const startAfter = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const controller = new AppTaskController({
      maxConcurrent: 1,
      startAfter,
      reconcile: async (taskId) => {
        started.push(taskId);
      },
    });

    controller.enqueue("recovered-work");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(started).toEqual([]);

    openGate();
    await waitUntil(() => started.length === 1);
    expect(started).toEqual(["recovered-work"]);
    controller.close();
  });

  it("runs deduplicated keys through one bounded worker pool", async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const controller = new AppTaskController({
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

  it("reports one ready wait and trusted lane for each dispatch", async () => {
    const dispatches: Array<{ taskId: string; readyWaitMs: number; lane: string; enqueuedAt: number }> = [];
    const controller = new AppTaskController({
      maxConcurrent: 1,
      async reconcile(taskId, dispatch) {
        dispatches.push({ taskId, ...dispatch });
      },
    });

    controller.enqueue("human-turn", { lane: "human" });
    await waitUntil(() => dispatches.length === 1);

    expect(dispatches[0]?.taskId).toBe("human-turn");
    expect(dispatches[0]?.lane).toBe("human");
    expect(dispatches[0]?.readyWaitMs).toBeGreaterThanOrEqual(0);
    expect(dispatches[0]?.enqueuedAt).toBeLessThanOrEqual(Date.now());
    controller.close();
  });

  it("runs independent task keys concurrently up to the app limit", async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const controller = new AppTaskController({
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

  it("updates concurrency without replacing queued or running work", async () => {
    const started: string[] = [];
    const releases: Array<() => void> = [];
    const controller = new AppTaskController({
      maxConcurrent: 1,
      reconcile: (taskId) =>
        new Promise<void>((resolve) => {
          started.push(taskId);
          releases.push(resolve);
        }),
    });
    controller.enqueue("a");
    controller.enqueue("b");
    await waitUntil(() => started.length === 1);

    controller.updateMaxConcurrent(2);
    await waitUntil(() => started.length === 2);
    expect(started).toEqual(["a", "b"]);

    controller.updateMaxConcurrent(1);
    controller.enqueue("c");
    releases.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(started).toEqual(["a", "b"]);
    releases.shift()?.();
    await waitUntil(() => started.includes("c"));
    releases.shift()?.();
    controller.close();
    await controller.whenDrained();
  });

  it("yields to the event loop between immediately completed reconciles", async () => {
    const started: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const controller = new AppTaskController({
      maxConcurrent: 1,
      reconcile: async (taskId) => {
        started.push(taskId);
        if (taskId === "task-0") await new Promise<void>((resolve) => (releaseFirst = resolve));
      },
    });
    for (let index = 0; index < 40; index++) controller.enqueue(`task-${index}`);
    await waitUntil(() => started.length === 1);

    let startedWhenTimerRan = -1;
    const timerRan = new Promise<void>((resolve) => {
      setTimeout(() => {
        startedWhenTimerRan = started.length;
        resolve();
      }, 0);
    });
    releaseFirst?.();
    await timerRan;

    expect(startedWhenTimerRan).toBeLessThan(40);
    await waitUntil(() => started.length === 40);
    controller.close();
  });

  it("yields between synchronous claim prefixes while filling concurrency", async () => {
    let markerRan = false;
    const starts: Array<{ taskId: string; markerRan: boolean }> = [];
    const controller = new AppTaskController({
      maxConcurrent: 3,
      async reconcile(taskId) {
        starts.push({ taskId, markerRan });
        const until = performance.now() + 20;
        while (performance.now() < until) {
          // Model a large task-tree claim before the reconciler's first await.
        }
        await Bun.sleep(1);
      },
    });
    controller.enqueue("one");
    controller.enqueue("two");
    controller.enqueue("three");
    setTimeout(() => {
      markerRan = true;
    }, 0);

    await waitUntil(() => starts.length === 3 && controller.snapshot().running.length === 0);
    expect(starts.map((entry) => entry.taskId).sort()).toEqual(["one", "three", "two"]);
    expect(starts[0]?.markerRan).toBeFalse();
    expect(starts.slice(1).every((entry) => entry.markerRan)).toBeTrue();
    controller.close();
  });

  it("yields between synchronous claim prefixes from independent Apps", async () => {
    let markerRan = false;
    const starts: Array<{ app: string; markerRan: boolean }> = [];
    const controller = (app: string) =>
      new AppTaskController({
        maxConcurrent: 1,
        async reconcile() {
          starts.push({ app, markerRan });
          const until = performance.now() + 20;
          while (performance.now() < until) {
            // Model each App writing its own large canonical task state.
          }
        },
      });
    const first = controller("first");
    const second = controller("second");
    first.enqueue("work");
    second.enqueue("work");
    setTimeout(() => {
      markerRan = true;
    }, 0);

    await waitUntil(() => starts.length === 2);
    expect(starts[0]?.markerRan).toBeFalse();
    expect(starts[1]?.markerRan).toBeTrue();
    first.close();
    second.close();
  });

  it("yields to the event loop between shared-capacity handoffs", async () => {
    const capacity = new HostCapacity(1);
    const started: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const controller = new AppTaskController({
      maxConcurrent: 1,
      capacity,
      reconcile: async (taskId) => {
        started.push(taskId);
        if (taskId === "task-0") await new Promise<void>((resolve) => (releaseFirst = resolve));
      },
    });
    for (let index = 0; index < 40; index++) controller.enqueue(`task-${index}`);
    await waitUntil(() => started.length === 1);

    let startedWhenTimerRan = -1;
    const timerRan = new Promise<void>((resolve) => {
      setTimeout(() => {
        startedWhenTimerRan = started.length;
        resolve();
      }, 0);
    });
    releaseFirst?.();
    await timerRan;

    expect(startedWhenTimerRan).toBeLessThan(40);
    await waitUntil(() => started.length === 40);
    controller.close();
  });

  it("shares one Host capacity across independent App controllers", async () => {
    const capacity = new HostCapacity(1);
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const controllerA = new AppTaskController({
      maxConcurrent: 2,
      capacity,
      reconcile: (taskId) =>
        new Promise<void>((resolve) => {
          started.push(`a:${taskId}`);
          releases.set(`a:${taskId}`, resolve);
        }),
    });
    const controllerB = new AppTaskController({
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
    await waitUntil(() => capacity.snapshot().waiting === 1);
    expect(capacity.snapshot()).toEqual({ running: 1, waiting: 1 });

    releases.get(started[0])?.();
    await waitUntil(() => started.length === 2);
    expect(new Set(started)).toEqual(new Set(["a:one", "b:two"]));
    releases.get(started[1])?.();
    await waitUntil(() => capacity.snapshot().running === 0);
    controllerA.close();
    controllerB.close();
  });

  it("keeps Task priority inside the controller without consuming interactive capacity", async () => {
    const capacity = new HostCapacity(2);
    const releaseBackground = capacity.tryAcquire();
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const controller = new AppTaskController({
      maxConcurrent: 2,
      capacity,
      reconcile: (taskId) =>
        new Promise<void>((resolve) => {
          started.push(taskId);
          releases.set(taskId, resolve);
        }),
    });

    controller.enqueue("normal", { lane: "normal", priority: "P0" });
    await waitUntil(() => capacity.snapshot().waiting === 1);
    controller.enqueue("human", { lane: "human", priority: "P2" });
    await Bun.sleep(20);

    expect(started).toEqual([]);
    expect(capacity.snapshot()).toEqual({ running: 1, waiting: 1 });

    releaseBackground?.();
    await waitUntil(() => started.length === 1);
    expect(started).toEqual(["human"]);
    releases.get("human")?.();
    await waitUntil(() => started.includes("normal"));
    releases.get("normal")?.();
    await waitUntil(() => capacity.snapshot().running === 0);
    controller.close();
  });

  it("shares the Host limit across independent controllers", async () => {
    // One of three Host slots is reserved for foreground May conversation.
    const appCapacity = new HostCapacity(3);
    const started: string[] = [];
    let releaseOld: (() => void) | undefined;
    let releaseCurrent: (() => void) | undefined;
    const old = new AppTaskController({
      maxConcurrent: 2,
      capacity: appCapacity,
      reconcile: () =>
        new Promise<void>((resolve) => {
          started.push("old");
          releaseOld = resolve;
        }),
    });
    old.enqueue("old");
    await waitUntil(() => started.length === 1);
    old.close();

    const current = new AppTaskController({
      maxConcurrent: 2,
      capacity: appCapacity,
      reconcile: (taskId) =>
        new Promise<void>((resolve) => {
          started.push(taskId);
          releaseCurrent = resolve;
        }),
    });
    current.enqueue("current");

    await waitUntil(() => started.includes("current"));
    expect(started).toEqual(["old", "current"]);
    expect(appCapacity.snapshot()).toEqual({ running: 2, waiting: 0 });

    releaseOld?.();
    releaseCurrent?.();
    await waitUntil(() => appCapacity.snapshot().running === 0);
    current.close();
  });

  it("keeps independent controllers within the shared Host limit", async () => {
    const appCapacity = new HostCapacity(1);
    const started: string[] = [];
    let releaseOld: (() => void) | undefined;
    let releaseCurrent: (() => void) | undefined;
    const old = new AppTaskController({
      maxConcurrent: 1,
      capacity: appCapacity,
      reconcile: () =>
        new Promise<void>((resolve) => {
          started.push("old");
          releaseOld = resolve;
        }),
    });
    old.enqueue("old");
    await waitUntil(() => started.length === 1);
    old.close();

    const current = new AppTaskController({
      maxConcurrent: 1,
      capacity: appCapacity,
      reconcile: () =>
        new Promise<void>((resolve) => {
          started.push("current");
          releaseCurrent = resolve;
        }),
    });
    current.enqueue("current");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(started).toEqual(["old"]);

    releaseOld?.();
    await waitUntil(() => started.includes("current"));
    expect(appCapacity.snapshot().running).toBe(1);
    releaseCurrent?.();
    await waitUntil(() => appCapacity.snapshot().running === 0);
    current.close();
  });

  it("chooses the current exact wake only after shared capacity is available", async () => {
    const capacity = new HostCapacity(1);
    const started: string[] = [];
    let releaseBlocker: (() => void) | undefined;
    let releaseGoal: (() => void) | undefined;
    const blocker = new AppTaskController({
      maxConcurrent: 1,
      capacity,
      reconcile: () =>
        new Promise<void>((resolve) => {
          started.push("blocker");
          releaseBlocker = resolve;
        }),
    });
    const goal = new AppTaskController({
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
    goal.enqueue("urgent-goal", { promote: true });

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
    const controller = new AppTaskController({
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
    const controller = new AppTaskController({
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

  it("cancels stale capacity waits when controllers close", async () => {
    const appCapacity = new HostCapacity(1);
    const releaseGlobal = await appCapacity.acquire();
    const started: string[] = [];

    for (let index = 0; index < 50; index++) {
      const stale = new AppTaskController({
        maxConcurrent: 5,
        capacity: appCapacity,
        reconcile: async (taskId) => {
          started.push(taskId);
        },
      });
      stale.enqueue(`stale-${index}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      stale.close();
    }

    const current = new AppTaskController({
      maxConcurrent: 5,
      capacity: appCapacity,
      reconcile: async (taskId) => {
        started.push(taskId);
      },
    });
    current.enqueue("current");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(started).toEqual([]);
    expect(appCapacity.snapshot().waiting).toBe(1);

    releaseGlobal();
    await waitUntil(() => started.includes("current"));
    expect(started).toEqual(["current"]);
    current.close();
    await current.whenDrained();
  });

  it("supports an explicit startup chain when the caller requires one", async () => {
    const started: string[] = [];
    let releaseOld: (() => void) | undefined;
    const old = new AppTaskController({
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

    const replacedBeforeStart = new AppTaskController({
      maxConcurrent: 1,
      startAfter: old.whenDrained(),
      reconcile: async (taskId) => {
        started.push(taskId);
      },
    });
    replacedBeforeStart.enqueue("discarded-on-reload");
    replacedBeforeStart.close();

    const current = new AppTaskController({
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
