import { expect } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { EventBus } from "../../../src/app/core/events/bus.js";
import {
  createTaskAttemptProcessExecutor,
  createTaskRecoveryProcessExecutor,
  parseTaskAttemptProcessRequest,
  type TaskAttemptProcessRequest,
} from "../../../src/app/task-attempt-process.js";

const request: TaskAttemptProcessRequest = {
  appId: "sample",
  taskId: "work/one",
  dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
};

function scriptedWorker(source: string): ChildProcess {
  return spawn(
    process.execPath,
    ["-e", `${source}\nif (process.connected && !process.listenerCount("message")) process.disconnect();`],
    {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      serialization: "json",
    },
  );
}

const scenarios: Record<string, () => void | Promise<void>> = {
  requestParsing() {
    expect(parseTaskAttemptProcessRequest(JSON.stringify(request))).toEqual(request);
    const pinned = {
      ...request,
      definitionSource: {
        agentsRoot: "/fixture/release/agents",
        projectsRoot: "/fixture/release/projects",
        sharedRoot: "/fixture/release/shared",
      },
    };
    expect(parseTaskAttemptProcessRequest(JSON.stringify(pinned))).toEqual(pinned);
    expect(() => parseTaskAttemptProcessRequest(JSON.stringify({ ...pinned, definitionSource: {} }))).toThrow(
      "Task worker agentsRoot must be non-empty",
    );
    expect(() =>
      parseTaskAttemptProcessRequest(JSON.stringify({ ...request, dispatch: { ...request.dispatch, lane: "fast" } })),
    ).toThrow("invalid dispatch context");
  },

  async sourceCapture() {
    const source = {
      id: "release-1",
      root: "/fixture/release-1",
      agentsRoot: "/fixture/release-1/agents",
      projectsRoot: "/fixture/release-1/projects",
      sharedRoot: "/fixture/release-1/shared",
    };
    let dispatched: TaskAttemptProcessRequest | undefined;
    const execute = createTaskAttemptProcessExecutor({
      bus: new EventBus(),
      definitionSource: () => source,
      spawnWorker: (work) => {
        dispatched = work;
        return scriptedWorker('process.send({ kind: "result", dependentTaskIds: [] });');
      },
    });
    await execute(request);
    expect(dispatched?.definitionSource).toEqual({
      agentsRoot: source.agentsRoot,
      projectsRoot: source.projectsRoot,
      sharedRoot: source.sharedRoot,
    });
  },

  async eventRelay() {
    const bus = new EventBus();
    const observed: string[] = [];
    bus.subscribe((event) => observed.push(event.type));
    const execute = createTaskAttemptProcessExecutor({
      bus,
      spawnWorker: () =>
        scriptedWorker(`

          process.send({kind:"event",eventId:41,event:{type:"info",message:"working"}});
          process.send({kind:"result",dependentTaskIds:["work/one","work/two"]});
        `),
    });

    await expect(execute(request)).resolves.toEqual(["work/one", "work/two"]);
    expect(observed).toEqual(["info"]);
  },

  async liveInput() {
    const bus = new EventBus();
    const target = { appId: request.appId, taskId: request.taskId };
    const unsubscribe = bus.listen((event) => {
      if (event.type !== "info" || event.message !== "ready-for-input") return;
      bus.fanoutPersisted({ type: "task.feedback", target: { ...target, taskId: "work/other" }, data: {} }, 42);
      bus.emit({ type: "task.feedback", target, data: { text: "not durable" } });
      bus.fanoutPersisted({ type: "task.feedback", target, data: { text: "correct scope" } }, 43);
      bus.fanoutPersisted({ type: "app.task.cancelled", target, data: { attemptId: "attempt-1" } }, 44);
    });
    const execute = createTaskAttemptProcessExecutor({
      bus,
      timeoutMs: 2_000,
      spawnWorker: () =>
        scriptedWorker(`

        const seen = [];
        process.on("message", (frame) => {
          seen.push(frame.event.type + ":" + frame.eventId);
          if (frame.event.type === "app.task.cancelled") {
            process.send({ kind: "result", dependentTaskIds: seen });
            process.disconnect();
          }
        });
        process.send({ kind: "event", eventId: 41, event: {
          type: "info", message: "ready-for-input", target: { appId: "sample", taskId: "work/one" }
        } });
      `),
    });
    try {
      await expect(execute(request)).resolves.toEqual(["task.feedback:43", "app.task.cancelled:44"]);
    } finally {
      unsubscribe();
    }
  },

  async parentResponsive() {
    const bus = new EventBus();
    const execute = createTaskAttemptProcessExecutor({
      bus,
      spawnWorker: () =>
        scriptedWorker(`

          const until = Date.now() + 300;
          while (Date.now() < until) {}
          process.send({kind:"result",dependentTaskIds:[]});
        `),
    });

    const startedAt = Date.now();
    const parentTurn = new Promise<number>((resolve) => setTimeout(() => resolve(Date.now() - startedAt), 20));
    const attempt = execute(request);

    expect(await parentTurn).toBeLessThan(150);
    await expect(attempt).resolves.toEqual([]);
  },

  async relayBatches() {
    const bus = new EventBus();
    let observed = 0;
    let resolveAfterFirst!: (count: number) => void;
    const afterFirst = new Promise<number>((resolve) => {
      resolveAfterFirst = resolve;
    });
    bus.subscribe(() => {
      observed += 1;
      if (observed === 1) setTimeout(() => resolveAfterFirst(observed), 10);
      const until = Date.now() + 4;
      while (Date.now() < until) {}
    });
    const execute = createTaskAttemptProcessExecutor({
      bus,
      spawnWorker: () =>
        scriptedWorker(`

          for (let eventId = 1; eventId <= 64; eventId += 1) {
            process.send({kind:"event",eventId,event:{type:"info",message:"progress"}});
          }
          process.send({kind:"result",dependentTaskIds:[]});
        `),
    });

    const startedAt = Date.now();
    const parentTurn = new Promise<number>((resolve) => setTimeout(() => resolve(Date.now() - startedAt), 20));
    const attempt = execute(request);

    expect(await parentTurn).toBeLessThan(180);
    expect(await afterFirst).toBeLessThan(16);
    await expect(attempt).resolves.toEqual([]);
    expect(observed).toBe(64);
  },

  async concurrentRelays() {
    const bus = new EventBus();
    const observed: string[] = [];
    let resolveAfterFirst!: (count: number) => void;
    const afterFirst = new Promise<number>((resolve) => {
      resolveAfterFirst = resolve;
    });
    bus.subscribe((event) => {
      observed.push(String(event.type));
      if (observed.length === 1) setTimeout(() => resolveAfterFirst(observed.length), 0);
      const until = Date.now() + 4;
      while (Date.now() < until) {}
    });
    const worker = (type: string) =>
      scriptedWorker(`

        const base = ${type === "info" ? 100 : 200};
        const until = Date.now() + 50;
        while (Date.now() < until) {}
        for (let index = 1; index <= 16; index += 1) {
          process.send({kind:"event",eventId:base+index,event:{type:"${type}",message:"working"}});
        }
        process.send({kind:"result",dependentTaskIds:[]});
      `);
    const first = createTaskAttemptProcessExecutor({ bus, spawnWorker: () => worker("info") });
    const second = createTaskAttemptProcessExecutor({ bus, spawnWorker: () => worker("prompt") });

    const attempts = Promise.all([first(request), second(request)]);
    expect(await afterFirst).toBe(1);
    await attempts;
    expect(observed.filter((type) => type === "info")).toHaveLength(16);
    expect(observed.filter((type) => type === "prompt")).toHaveLength(16);
  },

  async workerFailure() {
    const execute = createTaskAttemptProcessExecutor({
      bus: new EventBus(),
      spawnWorker: () =>
        scriptedWorker(`

          process.send({kind:"error",error:"attempt failed"});
          process.exitCode = 1;
        `),
    });

    await expect(execute(request)).rejects.toThrow("attempt failed");
  },

  async abruptExit() {
    const execute = createTaskAttemptProcessExecutor({
      bus: new EventBus(),
      timeoutMs: 2_000,
      spawnWorker: () => scriptedWorker("process.exit(7);"),
    });
    await expect(execute(request)).rejects.toThrow("Task worker exited with code 7");
  },

  async missingResult() {
    const execute = createTaskAttemptProcessExecutor({
      bus: new EventBus(),
      timeoutMs: 2_000,
      spawnWorker: () => scriptedWorker(""),
    });
    await expect(execute(request)).rejects.toThrow("Task worker exited without a result frame");
  },

  async workerChurn() {
    const execute = createTaskAttemptProcessExecutor({
      bus: new EventBus(),
      timeoutMs: 2_000,
      spawnWorker: () => {
        const child = scriptedWorker(`

        await Bun.sleep(20);
        process.send({kind:"result",dependentTaskIds:[]});
        `);
        return child;
      },
    });
    for (let wave = 0; wave < 30; wave += 1) {
      const attempts = Array.from({ length: 3 }, () => execute(request));
      Bun.gc(true);
      await Promise.all(attempts);
    }
  },

  async recovery() {
    const execute = createTaskRecoveryProcessExecutor({
      bus: new EventBus(),
      spawnWorker: () =>
        scriptedWorker(`

          process.send({kind:"result",dependentTaskIds:[]});
        `),
    });

    await expect(execute()).resolves.toBeUndefined();
  },
};

const scenario = scenarios[process.argv[2]];
if (!scenario) throw new Error("Expected a known worker protocol scenario");
await scenario();
