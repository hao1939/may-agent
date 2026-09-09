// Child-process-only mocks: exercise real orchestration with recovery held
// pending, then either resolved or rejected. Never start installed workloads.
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { EventBus } from "../../src/app/event-bus.js";
import type { CronRuntimeOptions } from "../../src/app/cron-startup.js";

const order: string[] = [];
const bus = new EventBus();
let settle!: () => void;
const recovery = new Promise<void>((resolve, reject) => {
  settle = process.argv[2] === "reject" ? () => reject(new Error("fixture recovery failure")) : resolve;
});
mock.module("../../src/app/app-task-runtime.js", () => ({
  recoverInstalledAppTasks: () => {
    order.push("recovery");
    return recovery;
  },
}));
mock.module("../../src/app/agent-loader.js", () => ({
  getAgentCrons: () => new Map(),
  getAgentSessionId: () => null,
  loadAgentHandlers: async () => {
    order.push("handlers");
    return { registered: [], errors: [] };
  },
}));
mock.module("../../src/app/cron-activation.js", () => ({
  activateAgentCrons: () => {
    order.push("crons");
  },
}));
const { startCronRuntime } = await import("../../src/app/cron-startup.js");
let markSettled!: () => void;
const settled = new Promise<void>((resolve) => {
  markSettled = resolve;
});
const messages: string[] = [];
bus.subscribe((event) => {
  if (event.type === "info") messages.push(event.message);
});
await startCronRuntime({
  manager: {
    resumeStaleSessions: (options: { abort?: boolean }) => {
      order.push(options.abort ? "abort-chat" : "resume");
      return { resumed: [], interrupted: [] };
    },
  } as unknown as CronRuntimeOptions["manager"],
  loaderOpts: {} as CronRuntimeOptions["loaderOpts"],
  bus,
  onTaskRecoverySettled: () => {
    order.push("controllers");
    markSettled();
  },
});
assert.deepEqual(order, ["recovery", "resume", "abort-chat", "handlers", "crons"]);
settle();
await settled;
assert.deepEqual(order, ["recovery", "resume", "abort-chat", "handlers", "crons", "controllers"]);
assert.equal(
  messages.some((message) => message.includes("fixture recovery failure")),
  process.argv[2] === "reject",
);
console.log("cron-startup-contract-ok");
