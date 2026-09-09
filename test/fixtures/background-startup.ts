// Child-process-only mocks: exercise real orchestration with recovery held
// pending, then either resolved or rejected. Never start installed workloads.
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { EventBus } from "../../src/app/event-bus.js";
import type { BackgroundRuntimeOptions } from "../../src/app/composition/background-startup.js";

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
    resumeStaleSessions: (options: { abort?: boolean }) => {
      order.push(options.abort ? "abort-chat" : "resume");
      return { resumed: [], interrupted: [] };
    },
  } as unknown as BackgroundRuntimeOptions["manager"],
  projectsRoot: "/fixture/projects",
  persistDir: "/fixture/state",
  bus,
  onTaskRecoverySettled: () => {
    order.push("controllers");
    markSettled();
  },
});
assert.deepEqual(order, ["recovery", "resume", "abort-chat"]);
settle();
await settled;
assert.deepEqual(order, ["recovery", "resume", "abort-chat", "controllers"]);
assert.equal(
  messages.some((message) => message.includes("fixture recovery failure")),
  process.argv[2] === "reject",
);
console.log("background-startup-contract-ok");
