import { describe, expect, it, spyOn } from "bun:test";
import { AppTaskController } from "./controller.js";
import { HostCapacity } from "../scheduling/host-capacity.js";

async function waitUntil(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const started = performance.now();
  while (!predicate()) {
    if (performance.now() - started > timeoutMs) throw new Error("timed out");
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

  it("yields to the event loop between shared-capacity handoffs despite a wall-clock jump", async () => {
    const capacity = new HostCapacity(1);
    const started: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const originalNow = Date.now;
    const clock = spyOn(Date, "now").mockImplementation(originalNow);
    const controller = new AppTaskController({
      maxConcurrent: 1,
      capacity,
      reconcile: async (taskId) => {
        started.push(taskId);
        if (taskId === "task-10") clock.mockReturnValue(originalNow() + 60_000);
        if (taskId === "task-0") await new Promise<void>((resolve) => (releaseFirst = resolve));
      },
    });
    try {
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
    } finally {
      releaseFirst?.();
      controller.close();
      clock.mockRestore();
    }
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

  it("replaces a background capacity wait when human Conversation work becomes ready", async () => {
    const capacity = new HostCapacity(2);
    const releaseBackground = capacity.tryAcquire()!;
    const started: string[] = [];
    const finishHuman = Promise.withResolvers<void>();
    const controller = new AppTaskController({
      maxConcurrent: 1,
      capacity,
      readScheduling: () => ({ backgroundPaused: false, foregroundTaskIds: new Set(["conversation"]) }),
      reconcile: async (taskId) => {
        started.push(taskId);
        if (taskId === "conversation") await finishHuman.promise;
      },
    });
    try {
      controller.enqueue("ordinary", { lane: "human", priority: "P0" });
      await waitUntil(() => capacity.snapshot().waiting === 1);
      controller.enqueue("conversation");
      await waitUntil(() => started.length === 1);
      expect(started).toEqual(["conversation"]);
      expect(capacity.snapshot().running).toBe(2);
      finishHuman.resolve();
      await waitUntil(() => controller.snapshot().running.length === 0 && capacity.snapshot().waiting === 1);
      releaseBackground();
      await waitUntil(() => started.includes("ordinary") && capacity.snapshot().running === 0);
      expect(started).toEqual(["conversation", "ordinary"]);
      expect(capacity.snapshot().waiting).toBe(0);
    } finally {
      finishHuman.resolve();
      releaseBackground();
      controller.close();
      await controller.whenDrained();
    }
  });

  it("rechecks input class after waiting instead of spending the foreground reserve on a system review", async () => {
    const capacity = new HostCapacity(2);
    const releaseBackground = capacity.tryAcquire()!;
    const releaseForeground = capacity.tryAcquireForeground()!;
    let humanPending = true;
    const started: string[] = [];
    const controller = new AppTaskController({
      maxConcurrent: 1,
      capacity,
      readScheduling: () => ({
        backgroundPaused: false,
        foregroundTaskIds: new Set(humanPending ? ["conversation"] : []),
      }),
      reconcile: async (taskId) => {
        started.push(taskId);
      },
    });
    try {
      controller.enqueue("conversation");
      await waitUntil(() => capacity.snapshot().waiting === 1);
      humanPending = false;
      releaseForeground();
      await waitUntil(() => capacity.snapshot().running === 1 && capacity.snapshot().waiting === 1);
      expect(started).toEqual([]);
      releaseBackground();
      await waitUntil(() => started.length === 1 && capacity.snapshot().running === 0);
      expect(started).toEqual(["conversation"]);
      expect(capacity.snapshot().waiting).toBe(0);
    } finally {
      releaseBackground();
      releaseForeground();
      controller.close();
      await controller.whenDrained();
    }
  });

  it("releases reserved capacity and backs off when the scheduling read fails", async () => {
    const capacity = new HostCapacity(2);
    const releaseBackground = capacity.tryAcquire()!;
    const releaseForeground = capacity.tryAcquireForeground()!;
    const reported = Promise.withResolvers<void>();
    let readBroken = false;
    let starts = 0;
    const controller = new AppTaskController({
      maxConcurrent: 1,
      capacity,
      retryDelayMs: () => 30,
      readScheduling: () => {
        if (readBroken) throw new Error("Scheduling storage unavailable");
        return { backgroundPaused: false, foregroundTaskIds: new Set(["conversation"]) };
      },
      reconcile: async () => {
        starts++;
      },
      onError: (_taskId, error, willRetry) => {
        expect(String(error)).toContain("Scheduling storage unavailable");
        expect(willRetry).toBe(true);
        reported.resolve();
      },
    });
    try {
      controller.enqueue("conversation");
      await waitUntil(() => capacity.snapshot().waiting === 1);
      readBroken = true;
      releaseForeground();
      await reported.promise;
      expect(starts).toBe(0);
      expect(capacity.snapshot()).toEqual({ running: 1, waiting: 0 });
      expect(controller.snapshot().pending).toEqual(["conversation"]);
      readBroken = false;
      await waitUntil(() => starts === 1 && controller.snapshot().running.length === 0);
      expect(capacity.snapshot()).toEqual({ running: 1, waiting: 0 });
    } finally {
      releaseBackground();
      releaseForeground();
      controller.close();
      await controller.whenDrained();
    }
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
      onError: (_taskId, _error, willRetry) => {
        errors.push(willRetry);
      },
    });
    controller.enqueue("a");
    await waitUntil(() => runs === 3);
    expect(errors).toEqual([true, true]);
    controller.close();
  });

  it.each([false, true])("preserves dispatch backoff across wakes without holding other work (capacity: %s)", async (shared) => {
    const delay = 80;
    const capacity = shared ? new HostCapacity(1) : undefined;
    const starts: Array<{ taskId: string; at: number; lane: string }> = [];
    let failedAt = 0;
    const controller = new AppTaskController({
      maxConcurrent: 1,
      capacity,
      retryDelayMs: () => delay,
      async reconcile(taskId, dispatch) {
        starts.push({ taskId, at: Date.now(), lane: dispatch.lane });
        if (taskId === "bad" && !failedAt) {
          failedAt = Date.now();
          controller.enqueue(taskId);
          throw new Error("Storage unavailable before claim");
        }
      },
      onError(taskId) {
        for (let i = 0; i < 10; i++) controller.enqueue(taskId, { lane: "human", promote: true });
        controller.enqueue("good");
      },
    });
    try {
      controller.enqueue("bad");
      await waitUntil(() => starts.some(({ taskId }) => taskId === "good"));
      expect(starts.map(({ taskId }) => taskId)).toEqual(["bad", "good"]);
      await waitUntil(() => controller.snapshot().running.length === 0);
      expect(capacity?.snapshot().running ?? 0).toBe(0);
      controller.enqueue("bad");
      await waitUntil(() => starts.length === 3);
      expect(starts[2]).toMatchObject({ taskId: "bad", lane: "human" });
      expect(starts[2]!.at - failedAt).toBeGreaterThanOrEqual(delay);
      await waitUntil(() => controller.snapshot().running.length === 0);
      // Allow the original timer interval to pass again: an early wake must
      // not leave behind a delayed, duplicate successful reconciliation.
      await new Promise((resolve) => setTimeout(resolve, delay));
      expect(starts).toHaveLength(3);
      expect(controller.snapshot()).toEqual({ pending: [], running: [], dirty: [] });
    } finally {
      controller.close();
      await controller.whenDrained();
    }
  });

  it.each(["pause", "close"])("respects %s while a dispatch retry timer expires", async (control) => {
    let runs = 0;
    let reported = false;
    const controller = new AppTaskController({
      maxConcurrent: 1,
      retryDelayMs: () => 30,
      async reconcile() {
        if (++runs === 1) throw new Error("Storage unavailable");
      },
      onError(taskId) {
        controller.enqueue(taskId);
        if (control === "close") controller.close();
        else controller.setEnabled(false);
        reported = true;
      },
    });
    try {
      controller.enqueue("bad");
      await waitUntil(() => reported && controller.snapshot().running.length === 0);
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(runs).toBe(1);
      if (control === "pause") {
        controller.setEnabled(true);
        await waitUntil(() => runs === 2);
      }
    } finally {
      controller.close();
      await controller.whenDrained();
    }
  });

  it.each([
    { execution: "throw", reporter: "absent" },
    { execution: "reject", reporter: "throw" },
    { execution: "throw", reporter: "throw" },
    { execution: "reject", reporter: "reject" },
    { execution: "throw", reporter: "reject" },
    { execution: "reject", reporter: "pending" },
  ])("contains $execution execution and $reporter reporting failures", async ({ execution, reporter }) => {
    const capacity = new HostCapacity(1);
    const starts: string[] = [];
    const failure = new Error("execution failed");
    const reportError = new Error("reporting failed");
    const reports: unknown[] = [];
    const fallback = spyOn(console, "error").mockImplementation(() => {});
    const controller = new AppTaskController({
      maxConcurrent: 1,
      capacity,
      maxRetries: 1,
      retryDelayMs: () => 0,
      reconcile(taskId) {
        starts.push(taskId);
        if (taskId === "bad" && starts.filter((id) => id === "bad").length === 1) {
          if (execution === "throw") throw failure;
          return Promise.reject(failure);
        }
        return Promise.resolve();
      },
      onError:
        reporter === "absent"
          ? undefined
          : (_taskId, error) => {
              reports.push(error);
              if (reporter === "throw") throw reportError;
              if (reporter === "reject") return Promise.reject(reportError);
              return new Promise<void>(() => {});
            },
    });
    try {
      controller.enqueue("bad");
      controller.enqueue("good");
      await waitUntil(() => starts.length === 3 && capacity.snapshot().running === 0);
      expect(starts.filter((id) => id === "bad")).toHaveLength(2);
      expect(starts.filter((id) => id === "good")).toHaveLength(1);
      expect(controller.snapshot()).toEqual({ pending: [], running: [], dirty: [] });
      expect(reports).toEqual(reporter === "absent" ? [] : [failure]);
      if (reporter === "throw" || reporter === "reject") {
        expect(fallback).toHaveBeenCalledWith(expect.stringContaining("Task bad"), { error: failure, reportError });
      } else {
        expect(fallback).not.toHaveBeenCalled();
      }
    } finally {
      controller.close();
      fallback.mockRestore();
    }
    await controller.whenDrained();
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
