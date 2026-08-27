import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../lib/requests.js";
import { projectRuntimePaths } from "./app-task-runtime-state.js";
import {
  activateTaskResourceCutover,
  inspectTaskResourceCutover,
  pauseTaskResourceCutover,
  type TaskResourceCutoverInspection,
} from "./app-task-resource-cutover.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import type { TaskStateConfig, TaskTree } from "./app-task-store.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(join(root, "state"));
    rmSync(root, { recursive: true, force: true });
  }
});

function harness(input: { running?: boolean } = {}): {
  root: string;
  persistDir: string;
  config: TaskStateConfig;
} {
  const root = mkdtempSync(join(tmpdir(), "may-task-cutover-"));
  roots.push(root);
  const appDir = join(root, "sample.app");
  const persistDir = join(root, "state");
  const paths = projectRuntimePaths(appDir, root);
  mkdirSync(join(appDir, ".state", "tasks"), { recursive: true });
  const tree: TaskTree = {
    version: 1,
    project: "sample",
    project_lifecycle: "active",
    root_task_id: "root",
    groups: { root: { id: "root", parent_id: null } },
    resources: {
      work: {
        metadata: { id: "work", generation: 1, resourceVersion: 1 },
        spec: { parentId: "root", outcome: "finish work", acceptance: ["done"], mode: "achieve" },
        status: {
          observedGeneration: 0,
          phase: input.running ? "running" : "pending",
          ...(input.running ? { currentAttemptId: "attempt-1" } : {}),
          updatedAt: "2026-08-21T00:00:00.000Z",
        },
      },
    },
    attempts: input.running
      ? {
          "attempt-1": {
            metadata: { id: "attempt-1", resourceVersion: 1 },
            taskId: "work",
            taskGeneration: 1,
            specHash: "hash",
            owner: "may",
            handler: "agent",
            runtimeId: "runtime",
            state: "running",
            reason: "test",
            startedAt: "2026-08-21T00:00:00.000Z",
          },
        }
      : {},
    tasks: {},
  };
  writeFileSync(paths.taskStatePath, `${JSON.stringify(tree)}\n`);
  return {
    root,
    persistDir,
    config: {
      appDir,
      projectDir: root,
      statePath: paths.taskStatePath,
      journalPath: paths.journalPath,
      worker: "cutover-test",
      maxConcurrent: 1,
    },
  };
}

describe("Task resource cutover", () => {
  it("requires an explicit pause, drain, reviewed revision, and offline assertion", () => {
    const { config, persistDir } = harness();
    expect(inspectTaskResourceCutover(config, persistDir)).toMatchObject({
      appId: "sample",
      lifecycle: "active",
      taskCount: 1,
      runningAttemptIds: [],
      resourceAuthority: "none",
    });

    const paused = pauseTaskResourceCutover(config, persistDir, "prepare guarded cutover");
    expect(paused.lifecycle).toBe("paused");
    expect(() =>
      activateTaskResourceCutover({
        config,
        persistDir,
        expectedSourceRevision: "wrong",
        daemonStopped: true,
      }),
    ).toThrow("source revision mismatch");

    const activated = activateTaskResourceCutover({
      config,
      persistDir,
      expectedSourceRevision: paused.sourceRevision,
      daemonStopped: true,
      resume: true,
    });
    expect(activated).toMatchObject({ lifecycle: "active", resourceAuthority: "resources" });
    const store = AppTaskResourceStore.activeFromDb(getDb(persistDir), "sample");
    expect(store?.readTask("work")?.spec.outcome).toBe("finish work");
    expect(() =>
      activateTaskResourceCutover({
        config,
        persistDir,
        expectedSourceRevision: paused.sourceRevision,
        daemonStopped: true,
      }),
    ).toThrow("already active");
    expect(store?.readTask("work")?.spec.outcome).toBe("finish work");
    expect(inspectTaskResourceCutover(config, persistDir)).toMatchObject({
      lifecycle: "active",
      taskCount: 1,
      resourceAuthority: "resources",
    });
    expect(() => pauseTaskResourceCutover(config, persistDir, "must not touch legacy state")).toThrow("already active");
  });

  it("refuses activation while a paused source still owns a running attempt", () => {
    const { config, persistDir } = harness({ running: true });
    const paused = pauseTaskResourceCutover(config, persistDir, "wait for drain");
    expect(paused.runningAttemptIds).toEqual(["attempt-1"]);
    expect(() =>
      activateTaskResourceCutover({
        config,
        persistDir,
        expectedSourceRevision: paused.sourceRevision,
        daemonStopped: true,
      }),
    ).toThrow("requires drained attempts");
  });

  it("runs the guarded inspect, pause, and offline activate command end to end", () => {
    const { config, persistDir } = harness();
    const script = join(import.meta.dir, "../../scripts/cutover-task-resources.ts");
    const run = (...args: string[]) =>
      Bun.spawnSync([process.execPath, script, ...args, "--app-dir", config.appDir, "--persist-dir", persistDir], {
        stdout: "pipe",
        stderr: "pipe",
      });

    const inspected = run("inspect");
    expect(inspected.exitCode).toBe(0);
    expect(JSON.parse(inspected.stdout.toString())).toMatchObject({
      appId: "sample",
      lifecycle: "active",
      resourceAuthority: "none",
    });

    const paused = run("pause", "--reason", "command test");
    expect(paused.exitCode).toBe(0);
    const pausedState = JSON.parse(paused.stdout.toString()) as TaskResourceCutoverInspection;
    expect(pausedState.lifecycle).toBe("paused");

    const missingConfirmation = run("activate", "--expected-revision", pausedState.sourceRevision);
    expect(missingConfirmation.exitCode).toBe(1);
    expect(missingConfirmation.stderr.toString()).toContain("Usage:");

    const activated = run(
      "activate",
      "--expected-revision",
      pausedState.sourceRevision,
      "--confirm-daemon-stopped",
      "--resume",
    );
    expect(activated.exitCode).toBe(0);
    expect(JSON.parse(activated.stdout.toString())).toMatchObject({
      lifecycle: "active",
      resourceAuthority: "resources",
    });
  });
});
