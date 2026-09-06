import { expect } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { EventBus } from "../../../src/app/event-bus.js";
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
  return spawn(process.execPath, ["-e", source], {
    stdio: ["pipe", "ignore", "ignore", "pipe"],
  });
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
        return scriptedWorker(
          'require("node:fs").writeSync(3, JSON.stringify({ kind: "result", dependentTaskIds: [] }) + "\\n");',
        );
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
          const fs = require("node:fs");
          fs.writeSync(3, JSON.stringify({kind:"event",eventId:41,event:{type:"info",message:"working"}})+"\\n");
          fs.writeSync(3, JSON.stringify({kind:"result",dependentTaskIds:["work/one","work/two"]})+"\\n");
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
        const fs = require("node:fs");
        const seen = [];
        const input = require("node:readline").createInterface({ input: process.stdin });
        input.on("line", (line) => {
          const frame = JSON.parse(line);
          seen.push(frame.event.type + ":" + frame.eventId);
          if (frame.event.type === "app.task.cancelled") {
            fs.writeSync(3, JSON.stringify({ kind: "result", dependentTaskIds: seen }) + "\\n");
            process.exit(0);
          }
        });
        fs.writeSync(3, JSON.stringify({ kind: "event", eventId: 41, event: {
          type: "info", message: "ready-for-input", target: { appId: "sample", taskId: "work/one" }
        } }) + "\\n");
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
          const fs = require("node:fs");
          const until = Date.now() + 300;
          while (Date.now() < until) {}
          fs.writeSync(3, JSON.stringify({kind:"result",dependentTaskIds:[]})+"\\n");
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
          const fs = require("node:fs");
          for (let eventId = 1; eventId <= 64; eventId += 1) {
            fs.writeSync(3, JSON.stringify({kind:"event",eventId,event:{type:"info",message:"progress"}})+"\\n");
          }
          fs.writeSync(3, JSON.stringify({kind:"result",dependentTaskIds:[]})+"\\n");
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
        const fs = require("node:fs");
        const base = ${type === "info" ? 100 : 200};
        const until = Date.now() + 50;
        while (Date.now() < until) {}
        for (let index = 1; index <= 16; index += 1) {
          fs.writeSync(3, JSON.stringify({kind:"event",eventId:base+index,event:{type:"${type}",message:"working"}})+"\\n");
        }
        fs.writeSync(3, JSON.stringify({kind:"result",dependentTaskIds:[]})+"\\n");
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
          const fs = require("node:fs");
          fs.writeSync(3, JSON.stringify({kind:"error",error:"attempt failed"})+"\\n");
          process.exit(1);
        `),
    });

    await expect(execute(request)).rejects.toThrow("attempt failed");
  },

  async recovery() {
    const execute = createTaskRecoveryProcessExecutor({
      bus: new EventBus(),
      spawnWorker: () =>
        scriptedWorker(`
          const fs = require("node:fs");
          fs.writeSync(3, JSON.stringify({kind:"result",dependentTaskIds:[]})+"\\n");
        `),
    });

    await expect(execute()).resolves.toBeUndefined();
  },
};

const scenario = scenarios[process.argv[2]];
if (!scenario) throw new Error("Expected a known worker protocol scenario");
await scenario();
