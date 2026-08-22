import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../lib/db.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { claimObservedAppTask } from "./app-task-reconciler.js";
import { HumanTaskService } from "./human-task-service.js";
import type { TaskStateConfig, TaskTree } from "./app-task-store.js";

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
      groups: { root: { id: "root", parent_id: null, goal: "sample" } },
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
    store.importPausedSnapshot(tree, "revision-1", ["work"]);
    store.activate("revision-1");
    store.setProjectLifecycle("active");
    const db = openDatabase(dbPath);
    const service = new HumanTaskService(db, {
      snapshot: () => ({ id: "test:1", generation: 1, entries: [] }),
    });
    service.cancelTask({ appId: "sample", taskId: "work", reason: "superseded" });

    const config: TaskStateConfig = {
      appDir,
      projectDir,
      statePath: join(appDir, ".state", "tasks.json"),
      journalPath: join(appDir, ".state", "tasks.jsonl"),
      worker: "test",
      maxConcurrent: 1,
      resourceStore: store,
    };
    expect(
      claimObservedAppTask(config, {
        taskId: "work",
        appOwner: "may",
        handler: "auto",
        isOwnerRunnable: () => true,
      }),
    ).toEqual({ kind: "completed", taskId: "work", generation: 1 });
    expect(store.listRecoveryCandidates().items).toEqual([]);
    expect(store.listTaskIdsByPhase(["attention", "pending"])).toEqual([]);

    db.close();
    store.close();
  });
});
