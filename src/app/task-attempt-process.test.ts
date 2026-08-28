import { describe, expect, it } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { EventBus } from "./event-bus.js";
import {
  createTaskAttemptProcessExecutor,
  createTaskRecoveryProcessExecutor,
  parseTaskAttemptProcessRequest,
  type TaskAttemptProcessRequest,
} from "./task-attempt-process.js";

const request: TaskAttemptProcessRequest = {
  appId: "sample",
  taskId: "work/one",
  dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
};

function scriptedWorker(source: string): ChildProcess {
  return spawn(process.execPath, ["-e", source], {
    stdio: ["ignore", "ignore", "ignore", "pipe"],
  });
}

describe("isolated Task attempt process", () => {
  it("validates the exact Task and dispatch context", () => {
    expect(parseTaskAttemptProcessRequest(JSON.stringify(request))).toEqual(request);
    expect(() =>
      parseTaskAttemptProcessRequest(JSON.stringify({ ...request, dispatch: { ...request.dispatch, lane: "fast" } })),
    ).toThrow("invalid dispatch context");
  });

  it("relays persisted events and returns dependent Task identities", async () => {
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
  });

  it("keeps the parent event loop responsive during CPU-heavy Task work", async () => {
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
  });

  it("yields between bounded batches of worker event notifications", async () => {
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
  });

  it("shares relay turns across concurrent Task workers", async () => {
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
  });

  it("surfaces worker failure without inventing another Task", async () => {
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
  });

  it("runs startup recovery through the same isolated process protocol", async () => {
    const execute = createTaskRecoveryProcessExecutor({
      bus: new EventBus(),
      spawnWorker: () =>
        scriptedWorker(`
          const fs = require("node:fs");
          fs.writeSync(3, JSON.stringify({kind:"result",dependentTaskIds:[]})+"\\n");
        `),
    });

    await expect(execute()).resolves.toBeUndefined();
  });
});
