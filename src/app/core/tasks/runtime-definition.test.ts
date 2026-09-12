import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { migrateTaskCompletionReceipts } from "../state/task-receipt-cutover.js";
import { appTaskContext, appTaskSpecHash } from "./app-task-reconciler.js";
import { prepareAppTaskRuntimeDescriptors, standaloneAppTaskAdmissionDescriptors } from "./runtime-definition.js";

test("runtime preparation requires offline receipt conversion before admission or execution", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-runtime-definition-"));
  const app = defineApp({
    id: "sample",
    version: 1,
    agent: "worker",
    inputSchema: Type.Object({}),
    tasks: {},
  });
  try {
    const store = AppTaskResourceStore.fromDb(getDb(root), app.id);
    const assignment = {
      id: "measurement",
      parentId: "root",
      mode: "achieve" as const,
      outcome: "Measure the sample",
      acceptance: ["Measurement recorded"],
    };
    const receipt = {
      metadata: { id: assignment.id, generation: 1, resourceVersion: 1 },
      specHash: appTaskSpecHash(assignment, "worker"),
      parentId: assignment.parentId,
      outcome: assignment.outcome,
      acceptance: assignment.acceptance,
      owner: "worker",
      handler: "agent:worker",
      summary: "Measured 17",
      result: { value: 17 },
      evidence: ["sample.json"],
      failureFingerprints: [],
      completedAt: "2026-09-01T00:00:00.000Z",
    };
    store.bootstrapSnapshot(
      {
        project: app.id,
        groups: { root: { id: "root", parent_id: null } },
        receipts: { [assignment.id]: receipt },
      },
      "legacy-fixture",
    );
    const options = {
      persistDir: root,
      projectsRoot: root,
      entries: [{ appDir: root, definition: app }],
    };
    const prepare = () =>
      prepareAppTaskRuntimeDescriptors({
        ...options,
        appRegistrySnapshot: { id: "candidate", generation: 1, entries: options.entries },
      });
    const before = store.readSnapshot();
    const version = store.revision();
    await expect(prepare()).rejects.toThrow("unconverted completion history for Task measurement");
    expect(() => standaloneAppTaskAdmissionDescriptors(options)).toThrow("offline Task state cutover");
    expect(store.readSnapshot()).toEqual(before);
    expect(store.revision()).toBe(version);

    const config = appTaskContext({ appDir: root, agent: "worker", resourceStore: store });
    expect(migrateTaskCompletionReceipts(config, { oldRuntimeStopped: true }).imported).toBe(1);
    expect(await prepare()).toHaveLength(1);
    expect(standaloneAppTaskAdmissionDescriptors(options).size).toBe(1);
    expect(store.readReceipt(assignment.id)).toEqual(receipt);
    expect(store.readTask(assignment.id)?.status.result).toEqual({ value: 17 });
    expect(store.isCancelled(assignment.id)).toBe(true);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
