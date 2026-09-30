#!/usr/bin/env bun
import { resolve } from "node:path";
import { admitTaskReconcileResult } from "../projects/may-agent/packages/sdk/src/task-contract.ts";
import { appTaskContext, observeAppTaskIntent } from "../projects/may-agent/src/app/core/tasks/app-task-reconciler.ts";
import { AppTaskResourceStore } from "../projects/may-agent/src/app/core/state/app-task-resource-store.ts";
import app, { dependencyResult, waitingResult } from "../projects/may-agent.app/docs/examples/app.ts";
import { reviewInput } from "../projects/may-agent.app/docs/examples/client.ts";
import seed from "../projects/sample.app/tasks/seed.json";

// Check the linked documentation example against source SDK types, independently
// of whichever SDK bundle an installation currently has activated.
const root = resolve(import.meta.dir, "..");
const compiler = Bun.spawn([
  "bun", resolve(root, "projects/may-agent/node_modules/typescript/bin/tsc"),
  "--project", resolve(root, "projects/may-agent.app/docs/examples/tsconfig.json"),
], { cwd: root, stdout: "inherit", stderr: "inherit" });
const exitCode = await compiler.exited;
if (exitCode !== 0) process.exit(exitCode);

const request = {
  id: "example-review-1",
  source: { kind: "system" as const, id: "documentation-check" },
  input: reviewInput.data.input,
};
const first = app.task!(request);
const repeated = app.task!(request);
if (first.kind !== "desired" || repeated.kind !== "desired" ||
    first.intent.id !== repeated.intent.id ||
    first.intent.outcome !== "Review the sample App README against its implementation") {
  throw new Error("The App example must map repeated input to the same desired Task");
}
for (const [name, result] of Object.entries({ waitingResult, dependencyResult })) {
  const admitted = admitTaskReconcileResult(result, {
    allowNeedsAgent: true, defaultParentId: "root",
  });
  if (!admitted.ok) throw new Error(`The documented ${name} is not admissible: ${admitted.error}`);
}

const store = AppTaskResourceStore.openStandalone(":memory:", app.id);
try {
  store.bootstrapSnapshot(seed, "documentation:seed");
  if (store.rootTaskId() !== first.intent.parentId) {
    throw new Error("The example seed must establish the Task's structural root");
  }
  const agent = app.agent ?? app.owner!;
  const context = appTaskContext({
    appDir: resolve(root, "projects/may-agent.app/docs/examples"),
    projectDir: resolve(root, "projects/may-agent.app/docs/examples"),
    agent, maxConcurrent: 1, resourceStore: store,
  });
  const observed = observeAppTaskIntent(context, {
    intent: first.intent, appAgent: agent, admissionKey: request.id,
  });
  const replayed = observeAppTaskIntent(context, {
    intent: repeated.intent, appAgent: agent, admissionKey: request.id,
  });
  if (replayed.kind !== "observed" || replayed.changed ||
      observed.taskId !== replayed.taskId || observed.generation !== replayed.generation) {
    throw new Error("Repeated example input must retain one admitted Task generation");
  }
} finally {
  store.close();
}
console.log("May design examples: SDK/control types, seeded Task admission/replay, and Condition/dependency result admission passed");
