import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk/app";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { prepareAppTaskRuntimeDescriptors } from "./runtime-definition.js";

test("coordination preparation requires an available shared workflow and a small explicit time bound", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-coordination-definition-"));
  const app = defineApp({ id: "sample", version: 1, agent: "owner", inputSchema: Type.Object({}),
    tasks: { coordination: { taskId: "runtime/review", workflow: "review", maxAttemptMs: 60_000 } } });
  try {
    const store = AppTaskResourceStore.fromDb(getDb(root), app.id);
    store.bootstrapSnapshot({ groups: { root: { id: "root" } } }, "coordination-fixture");
    const options = { persistDir: root, projectsRoot: root,
      appRegistrySnapshot: { id: "candidate", generation: 1, entries: [{ appDir: root, definition: app }] } };
    await expect(prepareAppTaskRuntimeDescriptors(options)).rejects.toThrow("workflow runner is unavailable");
    const runner = (workspace: "shared" | "task", available = true) => ({
      inspect: async () => ({ available, error: null, workspace }),
      execute: async () => { throw new Error("Preparation cannot execute work"); },
    });
    await expect(prepareAppTaskRuntimeDescriptors({ ...options, workflows: runner("task") })).rejects.toThrow("shared workspace");
    await expect(prepareAppTaskRuntimeDescriptors({ ...options, workflows: runner("shared", false) })).rejects.toThrow("shared workspace");
    const prepared = await prepareAppTaskRuntimeDescriptors({ ...options, workflows: runner("shared") });
    expect(prepared).toHaveLength(1);
    app.tasks!.coordination!.maxAttemptMs = 120_001;
    await expect(prepareAppTaskRuntimeDescriptors({ ...options, workflows: runner("shared") })).rejects.toThrow("attempt bound");
  } finally { closeDb(root); rmSync(root, { recursive: true, force: true }); }
});

test("taskAppIds resolves literal .app registry IDs before suffix aliases without preparing colliding runtimes", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-task-app-ids-collision-"));
  // "worker" requires a workflow runner and has no bootstrapped DB state; preparing it accidentally would throw or initialize state.
  const workerPlain = defineApp({
    id: "worker",
    version: 1,
    agent: "owner",
    inputSchema: Type.Object({}),
    tasks: { coordination: { taskId: "runtime/review", workflow: "review", maxAttemptMs: 60_000 } },
  });
  const workerDot = defineApp({ id: "worker.app", version: 1, agent: "owner", inputSchema: Type.Object({}), tasks: {} });
  const legacyAlias = defineApp({ id: "legacy", version: 1, agent: "owner", inputSchema: Type.Object({}), tasks: {} });
  try {
    const db = getDb(root);
    for (const id of ["worker.app", "legacy"]) {
      AppTaskResourceStore.fromDb(db, id).bootstrapSnapshot({ groups: { root: { id: "root" } } }, "collision-fixture");
    }
    const snapshot = {
      id: "collision-snap",
      generation: 1,
      entries: [
        { appDir: join(root, "worker"), definition: workerPlain },
        { appDir: join(root, "worker-dot"), definition: workerDot },
        { appDir: join(root, "legacy"), definition: legacyAlias },
      ],
    };

    const exactPrepared = await prepareAppTaskRuntimeDescriptors({
      persistDir: root,
      projectsRoot: root,
      appRegistrySnapshot: snapshot,
      taskAppIds: ["worker.app"],
    });
    expect(exactPrepared.map((d) => d.id)).toEqual(["worker.app"]);
    expect(AppTaskResourceStore.activeFromDb(db, "worker")).toBeNull();

    const aliasPrepared = await prepareAppTaskRuntimeDescriptors({
      persistDir: root,
      projectsRoot: root,
      appRegistrySnapshot: snapshot,
      taskAppIds: ["legacy.app"],
    });
    expect(aliasPrepared.map((d) => d.id)).toEqual(["legacy"]);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});


