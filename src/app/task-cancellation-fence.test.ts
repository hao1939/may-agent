import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { cancelAppTask, claimObservedAppTask } from "./app-task-reconciler.js";
import { HumanTaskService } from "./human-task-service.js";
import type { AppTaskContext, TaskTree } from "./app-task-store.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Task cancellation fence", () => {
  it("prevents later claims and indexed recovery after durable cancellation", () => {
    const root = mkdtempSync(join(tmpdir(), "may-task-cancel-"));
    roots.push(root);
    const appDir = join(root, "sample.app");
    const projectDir = join(root, "project");
    mkdirSync(appDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    const dbPath = join(root, "host.sqlite");
    const store = AppTaskResourceStore.openStandalone(dbPath, "sample");
    const tree: TaskTree = {
      version: 1,
      project: "sample",
      project_lifecycle: "paused",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
      resources: {
        work: {
          metadata: { id: "work", generation: 1, resourceVersion: 1 },
          spec: {
            parentId: "root",
            outcome: "Finish the work",
            acceptance: ["done"],
            mode: "achieve",
            owner: "may",
          },
          status: {
            observedGeneration: 0,
            phase: "pending",
            lane: "human",
            updatedAt: "2026-08-22T00:00:00.000Z",
          },
        },
      },
      tasks: {},
    };
    store.bootstrapSnapshot(tree, "revision-1", ["work"]);
    store.setProjectLifecycle("active");
    const db = openDatabase(dbPath);
    applyDbSchema(db);
    const retainedEvent = db
      .prepare("SELECT event_json FROM app_task_events WHERE app_id = 'sample' AND task_id = 'work'")
      .get();
    const service = new HumanTaskService(db, {
      snapshot: () => ({ id: "test:1", generation: 1, entries: [] }),
    });
    const config: AppTaskContext = {
      appDir,
      projectDir,
      agent: "test",
      maxConcurrent: 1,
      resourceStore: store,
    };
    const before = service.getTask({ appId: "sample", taskId: "work" });
    if (!before) throw new Error("expected Task before cancellation");
    expect(() =>
      cancelAppTask(config, {
        appId: "sample",
        taskId: "work",
        reason: "stale control",
        expectedGeneration: before.generation,
        expectedResourceVersion: before.resourceVersion + 1,
      }),
    ).toThrow("resource version changed");
    const control = {
      appId: "sample",
      taskId: "work",
      reason: "superseded",
      expectedGeneration: before.generation,
      expectedResourceVersion: before.resourceVersion,
      controlKey: "app-task-cancel:sample:work:1:1",
    };
    expect(cancelAppTask(config, control).applied).toBeTrue();
    expect(cancelAppTask(config, control).applied).toBeFalse();
    expect(
      db.prepare("SELECT action FROM app_task_control_receipts WHERE control_key = ?").get(control.controlKey),
    ).toEqual({ action: "cancel" });

    // Recovery must trust the terminal cancellation even if a legacy writer
    // left stale scheduling columns behind. Cancellation is a fence, not a
    // destructive cleanup of the Task's evidence.
    db.prepare(
      `UPDATE app_tasks SET ready = 1, changed = 1, next_check_at = 1, lease_until = 1
       WHERE app_id = 'sample' AND task_id = 'work'`,
    ).run();

    expect(
      claimObservedAppTask(config, {
        taskId: "work",
        appAgent: "may",
        handler: "auto",
        isAgentRunnable: () => true,
      }),
    ).toEqual({ kind: "completed", taskId: "work", generation: 1 });
    expect(store.listRecoveryCandidates().items).toEqual([]);
    expect(store.nextDueAt()).toBeNull();
    expect(store.setRecoveryState("work", { ready: true, changed: true, nextCheckAt: 2 })).toBeFalse();
    expect(store.listTaskIdsByPhase(["attention", "pending"])).toEqual([]);
    expect(
      db.prepare("SELECT event_json FROM app_task_events WHERE app_id = 'sample' AND task_id = 'work'").get(),
    ).toEqual(retainedEvent);

    db.close();
    store.close();
  });
});
