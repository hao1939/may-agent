// Child-process-only mocks: exercise real orchestration with recovery held
// pending, then either resolved or rejected. Never start installed workloads.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import type { BackgroundRuntimeOptions } from "../../src/app/composition/background-startup.js";
import { EventBus } from "../../src/app/core/events/bus.js";

const order: string[] = [];
const bus = new EventBus();
let settle!: () => void;
const recovery = new Promise<void>((resolve, reject) => {
  settle = process.argv[2] === "reject" ? () => reject(new Error("fixture recovery failure")) : resolve;
});
mock.module("../../src/app/core/tasks/app-task-runtime.js", () => ({
  recoverInstalledAppTasks: () => {
    order.push("recovery");
    return recovery;
  },
}));
const { startBackgroundRuntime } = await import("../../src/app/composition/background-startup.js");
let markSettled!: () => void;
const settled = new Promise<void>((resolve) => {
  markSettled = resolve;
});
const messages: string[] = [];
bus.subscribe((event) => {
  if (event.type === "info") messages.push(event.message);
});
await startBackgroundRuntime({
  manager: {
    cleanupStaleSessions: () => {
      order.push("cleanup");
      return { interrupted: [] };
    },
  } as unknown as BackgroundRuntimeOptions["manager"],
  persistDir: "/fixture/state",
  bus,
  onTaskRecoverySettled: () => {
    order.push("controllers");
    markSettled();
  },
});
assert.deepEqual(order, ["recovery", "cleanup"]);
settle();
await settled;
assert.deepEqual(order, ["recovery", "cleanup", "controllers"]);
assert.equal(
  messages.some((message) => message.includes("fixture recovery failure")),
  process.argv[2] === "reject",
);
console.log("background-startup-contract-ok");
