import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAppArgs } from "../../src/app/app-args.js";
import { DefinitionSourceReleaseStore } from "../../src/app/app-source-release.js";
import {
  createTaskAdmissionProcess,
  runTaskAdmissionWorker,
} from "../../src/app/composition/workers/task-admission-process.js";
import { parseTaskWorkerDefinitionSource } from "../../src/app/composition/workers/task-attempt-process.js";
import { EVENT_ROW_ID, type AgentEvent } from "../../src/app/core/events/bus.js";
import type { AppEventAdmissionCommand } from "../../src/app/core/state/app-event-admission-store.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { closeDb, getDb } from "../../src/lib/db/connection.js";

const scenario = process.env.ADMISSION_TEST_SCENARIO ?? process.argv[2] ?? "healthy";
if (process.argv.includes("--task-admission-worker")) {
  if (["startup-timeout", "response-timeout", "close", "delayed-termination"].includes(scenario)) {
    process.on("message", () => {});
    if (scenario === "delayed-termination") {
      const keepAlive = setInterval(() => {}, 1_000);
      process.on("message", (msg: unknown) => {
        if (msg && typeof msg === "object" && "id" in msg) {
          process.send!({ id: (msg as { id: number }).id, ok: true, taskIds: ["work/parent"] });
        }
      });
      process.on("SIGTERM", () => {
        setTimeout(() => {
          clearInterval(keepAlive);
          process.exit(0);
        }, 200);
      });
      process.send!({ ready: true });
    } else {
      process.on("disconnect", () => process.exit(0));
      if (scenario === "response-timeout") process.send!({ ready: true });
    }
    await new Promise<void>(() => {});
  } else {
    const root = process.env.ADMISSION_TEST_ROOT!;
    const args = parseAppArgs();
    await runTaskAdmissionWorker({
      projectRoot: root,
      projectsRoot: join(root, "projects"),
      persistDir: join(root, "state"),
      ...(args.taskWorkerSource ? { definitionSource: parseTaskWorkerDefinitionSource(args.taskWorkerSource) } : {}),
    });
  }
  process.exit(0);
}

const root = mkdtempSync(join(tmpdir(), "task-admission-test-"));
process.env.ADMISSION_TEST_ROOT = root;
process.env.ADMISSION_TEST_SCENARIO = scenario;
const environment = {
  EXAMPLE_APP_SETTING: "custom installation value",
  EXAMPLE_SERVICE_TOKEN: "synthetic-service-key",
  EXAMPLE_EMPTY_SETTING: "",
};
if (scenario === "environment") {
  Object.assign(process.env, environment);
  process.env.MAY_TASK_ATTEMPT_CHILD = "1";
}
const persistDir = join(root, "state");
for (const directory of ["projects/sample.app/tasks", "agents", "shared/skills", "state"]) {
  mkdirSync(join(root, directory), { recursive: true });
}
writeFileSync(join(root, "shared/common-sense.md"), "Portable fixture; no external operations.\n");
writeFileSync(
  join(root, "projects/sample.app/tasks/seed.json"),
  JSON.stringify({
    root_task_id: "root",
    groups: { root: { id: "root", parent_id: null, state: "backlog", children: [] } },
  }),
);
writeFileSync(
  join(root, "projects/sample.app/app.js"),
  `${scenario === "environment" ? `
  for (const [key, value] of Object.entries(${JSON.stringify(environment)})) {
    if (process.env[key] !== value) throw new Error("Admission lost installation setting: " + key);
  }
  if (process.env.MAY_TASK_ATTEMPT_CHILD !== undefined) throw new Error("Admission inherited retired worker marker");
  ` : ""}
  export default {
  id: "sample", version: 1, agent: "sample-owner", inputSchema: { type: "object" },
  tasks: { maxConcurrent: 1 }
};\n`,
);
getDb(persistDir);
const release =
  scenario === "pinned-selection" ? new DefinitionSourceReleaseStore(root, persistDir).ensureCurrent() : undefined;
if (release) {
  writeFileSync(join(root, "projects/sample.app/.disabled"), "");
  // A later activated source must not change this already selected worker.
  writeFileSync(join(root, "projects/sample.app/app.js"), 'throw new Error("replacement App imported");');
  const releases = new DefinitionSourceReleaseStore(root, persistDir);
  releases.activate(releases.stage());
}
let onExitAt = 0;
let onTerminatedAt = 0;
let terminatedPromiseResolve: (() => void) | undefined;
const terminatedPromise = new Promise<void>((resolveDone) => {
  terminatedPromiseResolve = resolveDone;
});
const worker = createTaskAdmissionProcess({
  timeoutMs: scenario.endsWith("timeout") ? 500 : 5_000,
  ...(release ? { definitionSource: { ...release, appDirectories: ["sample.app"] } } : {}),
  onExit: () => {
    onExitAt = Date.now();
  },
  onTerminated: () => {
    onTerminatedAt = Date.now();
    terminatedPromiseResolve?.();
  },
});
const command: AppEventAdmissionCommand = {
  appId: "sample",
  kind: "task",
  routeId: "work/parent",
  payloadVersion: 2,
  status: "pending",
  conditionTaskIds: [],
  intent: {
    id: "work/parent",
    parentId: "root",
    outcome: "Reconcile current state",
    acceptance: ["State examined"],
    agent: "sample-owner",
  },
};
const event = (id: number, type = "sample.changed"): AgentEvent => {
  const value = { type, source: "test", data: {}, timestamp: Date.now() } as AgentEvent;
  Object.defineProperty(value, EVENT_ROW_ID, { value: id });
  return value;
};
try {
  if (scenario.endsWith("timeout")) {
    await assert.rejects(worker.dispatch(command, event(1)), /Task admission worker exceeded 500ms/);
    await assert.rejects(worker.dispatch(command, event(2)), /unavailable/);
  } else if (scenario === "close") {
    const pending = worker.dispatch(command, event(1));
    worker.close();
    await assert.rejects(pending, /Task admission worker closed/);
  } else if (scenario === "delayed-termination") {
    assert.deepEqual((await worker.dispatch(command, event(1))).taskIds, ["work/parent"]);
    const pending = worker.dispatch(command, event(2));
    const closeAt = Date.now();
    worker.close();
    await assert.rejects(pending, /Task admission worker closed/);
    // Right after close(), the child ignores SIGTERM for 200ms so onTerminated has not fired yet!
    assert.equal(onTerminatedAt, 0);
    await terminatedPromise;
    assert.ok(onTerminatedAt - closeAt >= 150, `Expected delayed termination >=150ms, got ${onTerminatedAt - closeAt}ms (onExitAt=${onExitAt})`);
  } else {
    if (scenario === "error-then-healthy") {
      await assert.rejects(
        worker.dispatch({ ...command, appId: "missing" }, event(99)),
        /no loaded Task admission state/,
      );
    }
    // No startup sleep or fake IPC: dispatch immediately through real App loading.
    const initial = worker.dispatch(command, event(1));
    const tickCommand: AppEventAdmissionCommand = {
      appId: "sample",
      kind: "exact-task",
      routeId: "work/parent",
      targetedTaskId: "work/parent",
      payloadVersion: 2,
      status: "pending",
      conditionTaskIds: [],
    };
    const ticks = [2, 3].map((id) => worker.dispatch(tickCommand, event(id, "project.task.tick")));
    for (const result of await Promise.all([initial, ...ticks])) assert.deepEqual(result.taskIds, ["work/parent"]);
    const store = AppTaskResourceStore.activeFromDb(getDb(persistDir), "sample")!;
    assert.deepEqual(
      store.readTrigger("work/parent")?.events?.map((item) => item.event.eventId),
      [1, 3],
    );
    assert.equal(store.readTask("work/parent")?.metadata.resourceVersion, 3);
  }
  console.log(JSON.stringify({ scenario, passed: true }));
} finally {
  worker.close();
  closeDb(persistDir);
  rmSync(root, { recursive: true, force: true });
}
