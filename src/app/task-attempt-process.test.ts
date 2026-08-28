import { describe, expect, it } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { EventBus } from "./event-bus.js";
import {
  createTaskAttemptProcessExecutor,
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
});
