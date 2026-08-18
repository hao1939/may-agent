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

  it("does not repeat an initial resync when startup already seeded the queue", async () => {
    let openGate = () => {};
    let resyncs = 0;
    const startAfter = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const controller = new AppTaskController({
      maxConcurrent: 1,
      startAfter,
      reconcile: async () => {},
      resync: {
        intervalMs: 10_000,
        onStart: false,
        tasks: () => {
          resyncs += 1;
          return [];
        },
      },
    });

    openGate();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(resyncs).toBe(0);
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
    expect(capacity.snapshot()).toEqual({ running: 1, waiting: 1 });

    releases.get(started[0])?.();
    await waitUntil(() => started.length === 2);
    expect(new Set(started)).toEqual(new Set(["a:one", "b:two"]));
    releases.get(started[1])?.();
    await waitUntil(() => capacity.snapshot().running === 0);
    controllerA.close();
    controllerB.close();
  });

  it("shares the Host limit across replacement controllers", async () => {
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

  it("keeps replacement controllers within the shared Host limit", async () => {
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

  it("chooses the current front task only after shared capacity is available", async () => {
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

  it("feeds periodic resync through the same deduplicating queue", async () => {
    let runs = 0;
    const controller = new AppTaskController({
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

  it("refills newly ready resync work as soon as capacity opens", async () => {
    const ready = ["first"];
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const controller = new AppTaskController({
      maxConcurrent: 1,
      resync: {
        intervalMs: 60_000,
        taskIds: () => [...ready],
      },
      reconcile: (taskId) =>
        new Promise<void>((resolve) => {
          started.push(taskId);
          releases.set(taskId, resolve);
        }),
    });

    await waitUntil(() => started.length === 1);
    expect(started).toEqual(["first"]);
    ready.splice(0, ready.length, "second");

    releases.get("first")?.();
    await waitUntil(() => started.length === 2);
    expect(started).toEqual(["first", "second"]);
    releases.get("second")?.();
    await waitUntil(() => !controller.snapshot().running.length);
    controller.close();
  });

  it("resyncs runnable state as soon as a replacement controller becomes active", async () => {
    const started: string[] = [];
    let releaseOld: (() => void) | undefined;
    const old = new AppTaskController({
      maxConcurrent: 1,
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
      startAfter: old.whenDrained(),
      resync: {
        intervalMs: 60_000,
        taskIds: () => ["recovered-runnable-task"],
      },
      reconcile: async (taskId) => {
        started.push(taskId);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(started).toEqual(["old"]);
    releaseOld?.();
    await waitUntil(() => started.includes("recovered-runnable-task"));
    expect(started).toEqual(["old", "recovered-runnable-task"]);
    current.close();
    await current.whenDrained();
  });

  it("cancels stale capacity waits when hot reload replaces controllers", async () => {
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

  it("keeps replacement controllers behind the draining predecessor chain", async () => {
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
