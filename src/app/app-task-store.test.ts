import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  ensureTaskState,
  loadProjectReadModel,
  projectRuntimePaths,
  saveProjectRuntimeState,
} from "./app-task-runtime-state.js";
import {
  cacheTaskStateReads,
  readTaskState,
  refreshAppTaskTreeProjection,
  saveTaskState,
  type TaskStateConfig,
} from "./app-task-store.js";

async function makeApp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "may-sdk-runtime-state-"));
  await mkdir(join(dir, "tasks"), { recursive: true });
  return dir;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("project runtime state paths", () => {
  test("does not restore canonical resource state from the generated tree projection", async () => {
    const appDir = await makeApp();
    await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
    await writeFile(join(appDir, ".state", "tasks", "tree.json"), `{"source":"runtime","tasks":{}}\n`, "utf8");
    await writeFile(join(appDir, "tasks", "tree.json"), `{"source":"legacy","tasks":{}}\n`, "utf8");

    const result = ensureTaskState(appDir);
    const tree = JSON.parse(await readFile(result.path, "utf8"));

    expect(result).toMatchObject({ migrated: true, source: "empty" });
    expect(result.path).toBe(projectRuntimePaths(appDir).taskStatePath);
    expect(tree.source).toBeUndefined();
  });

  test("does not bootstrap mutable runtime state from a legacy tree", async () => {
    const appDir = await makeApp();
    await writeFile(join(appDir, "tasks", "tree.json"), `{"source":"legacy","tasks":{}}\n`, "utf8");

    const result = ensureTaskState(appDir);
    const tree = JSON.parse(await readFile(result.path, "utf8"));

    expect(result).toMatchObject({ migrated: true, source: "empty" });
    expect(result.path).toBe(projectRuntimePaths(appDir).taskStatePath);
    expect(tree.source).toBeUndefined();
    expect(tree.groups).toEqual({});
    expect(tree.resources).toEqual({});
    expect(existsSync(projectRuntimePaths(appDir).migrationLogPath)).toBe(true);
  });

  test("boots from seed when no runtime or legacy tree exists", async () => {
    const appDir = await makeApp();
    await writeFile(join(appDir, "tasks", "seed.json"), `{"source":"seed","groups":{},"resources":{}}\n`, "utf8");

    const result = ensureTaskState(appDir);
    const tree = JSON.parse(await readFile(result.path, "utf8"));

    expect(result).toMatchObject({ migrated: true, source: "seed" });
    expect(tree.source).toBe("seed");
    expect(existsSync(projectRuntimePaths(appDir).taskTreePath)).toBe(false);
  });

  test("activates branch App code against one existing canonical task-state lineage", async () => {
    const root = await mkdtemp(join(tmpdir(), "may-app-state-lineage-"));
    const canonicalProjectsRoot = join(root, "canonical-projects");
    const canonicalAppDir = join(canonicalProjectsRoot, "sample.app");
    const branchAppDir = join(root, "branch-checkout", "projects", "sample.app");
    const taskId = "domain/stable-wait";
    const canonicalState = {
      version: 3,
      groups: {},
      resources: {
        [taskId]: {
          metadata: { id: taskId, generation: 8, resourceVersion: 42 },
          spec: { outcome: "Preserve the wait", acceptance: ["wait survives"], mode: "achieve" },
          status: { observedGeneration: 8, phase: "waiting", conditionIds: ["pipeline-176876683-completed"] },
        },
      },
      conditions: {
        "pipeline-176876683-completed": {
          metadata: { id: "pipeline-176876683-completed", resourceVersion: 3 },
          taskId,
          taskGeneration: 8,
          type: "pipeline-run.state",
          subject: "pipeline-run:176876683",
          expected: { field: "state", equals: "completed" },
          state: "waiting",
        },
      },
      receipts: { prior: { metadata: { id: "prior", generation: 7, resourceVersion: 1 } } },
      attempts: { current: { taskId, taskGeneration: 8, state: "completed" } },
    };
    await writeJson(join(canonicalAppDir, ".state", "tasks", "state.json"), canonicalState);
    await writeJson(join(branchAppDir, "tasks", "seed.json"), {
      version: 3,
      groups: {},
      resources: { [taskId]: { metadata: { id: taskId, generation: 1, resourceVersion: 1 } } },
    });

    const first = ensureTaskState(branchAppDir, canonicalProjectsRoot);
    const second = ensureTaskState(branchAppDir, canonicalProjectsRoot);
    const selected = JSON.parse(await readFile(first.path, "utf8"));
    const migrationLines = (await readFile(join(canonicalAppDir, ".state", "runtime-state-migrations.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(first).toEqual({
      path: join(canonicalAppDir, ".state", "tasks", "state.json"),
      migrated: false,
      source: "runtime",
    });
    expect(second.path).toBe(first.path);
    expect(existsSync(join(branchAppDir, ".state", "tasks", "state.json"))).toBe(false);
    expect(selected).toEqual(canonicalState);
    expect(selected.resources[taskId].metadata).toEqual({ id: taskId, generation: 8, resourceVersion: 42 });
    expect(selected.conditions["pipeline-176876683-completed"].state).toBe("waiting");
    expect(selected.receipts.prior).toBeDefined();
    expect(selected.attempts.current.taskGeneration).toBe(8);
    expect(migrationLines).toEqual([
      expect.objectContaining({
        kind: "task_state_canonical_lineage_selected",
        activeAppDir: branchAppDir,
        canonicalAppDir,
        taskStatePath: first.path,
      }),
    ]);
  });

  test("still seed-bootstraps a genuinely new branch App with no durable canonical state", async () => {
    const root = await mkdtemp(join(tmpdir(), "may-new-app-state-"));
    const canonicalProjectsRoot = join(root, "canonical-projects");
    const branchAppDir = join(root, "branch-checkout", "projects", "new.app");
    await writeJson(join(branchAppDir, "tasks", "seed.json"), {
      source: "seed",
      groups: {},
      resources: {},
    });

    const result = ensureTaskState(branchAppDir, canonicalProjectsRoot);

    expect(result).toEqual({
      path: join(branchAppDir, ".state", "tasks", "state.json"),
      migrated: true,
      source: "seed",
    });
    expect(JSON.parse(await readFile(result.path, "utf8"))).toMatchObject({ source: "seed" });
    expect(existsSync(join(canonicalProjectsRoot, "new.app", ".state", "tasks", "state.json"))).toBe(false);
  });

  test("uses existing canonical resource state without consulting the projection", async () => {
    const appDir = await makeApp();
    const paths = projectRuntimePaths(appDir);
    await writeJson(paths.taskStatePath, { source: "state", groups: {}, resources: {} });
    await writeJson(paths.taskTreePath, { source: "projection", tasks: {} });

    const result = ensureTaskState(appDir);
    const state = JSON.parse(await readFile(result.path, "utf8"));

    expect(result).toMatchObject({ migrated: false, source: "runtime" });
    expect(state.source).toBe("state");
  });

  test("does not copy canonical state into a missing generated projection", async () => {
    const appDir = await makeApp();
    const paths = projectRuntimePaths(appDir);
    await writeJson(paths.taskStatePath, { groups: {}, resources: {}, tasks: undefined });

    ensureTaskState(appDir);

    expect(existsSync(paths.taskTreePath)).toBe(false);
  });

  test("refreshes the disposable projection without rewriting canonical state", async () => {
    const appDir = await makeApp();
    const paths = projectRuntimePaths(appDir);
    await writeJson(paths.taskStatePath, {
      project: "sample",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null, children: ["work"] } },
      resources: {
        work: {
          metadata: { id: "work", generation: 1, resourceVersion: 1 },
          spec: { parentId: "root", outcome: "Do work", acceptance: ["done"], mode: "achieve" },
          status: { observedGeneration: 0, phase: "pending", updatedAt: "2026-07-20T00:00:00.000Z" },
        },
      },
    });
    const before = await readFile(paths.taskStatePath, "utf8");
    const config: TaskStateConfig = {
      appDir,
      projectDir: appDir,
      statePath: paths.taskStatePath,
      journalPath: paths.journalPath,
      worker: "owner",
      maxConcurrent: 1,
    };

    refreshAppTaskTreeProjection(config);

    expect(await readFile(paths.taskStatePath, "utf8")).toBe(before);
    expect(JSON.parse(await readFile(paths.taskTreePath, "utf8"))).toMatchObject({
      schema_version: 2,
      tasks: { work: { phase: "pending", outcome: "Do work" } },
    });
  });

  test("preserves a current disposable projection during startup refresh", async () => {
    const appDir = await makeApp();
    const paths = projectRuntimePaths(appDir);
    await writeJson(paths.taskStatePath, {
      project: "sample",
      groups: {},
      resources: {},
    });
    const config: TaskStateConfig = {
      appDir,
      projectDir: appDir,
      statePath: paths.taskStatePath,
      journalPath: paths.journalPath,
      worker: "owner",
      maxConcurrent: 1,
    };
    refreshAppTaskTreeProjection(config);
    const before = statSync(paths.taskTreePath);

    refreshAppTaskTreeProjection(config, { ifStaleOnly: true });

    expect(statSync(paths.taskTreePath).ino).toBe(before.ino);
  });

  test("reuses one parsed tree during a bounded startup pass and notices external changes", async () => {
    const appDir = await makeApp();
    const paths = projectRuntimePaths(appDir);
    await writeJson(paths.taskStatePath, { project: "first", groups: {}, resources: {} });
    const config: TaskStateConfig = {
      appDir,
      projectDir: appDir,
      statePath: paths.taskStatePath,
      journalPath: paths.journalPath,
      worker: "owner",
      maxConcurrent: 1,
    };
    cacheTaskStateReads(config);

    const first = readTaskState(config);
    expect(readTaskState(config)).toBe(first);

    await writeJson(paths.taskStatePath, { project: "externally-updated", groups: {}, resources: {} });
    const updated = readTaskState(config);
    expect(updated).not.toBe(first);
    expect(updated.project).toBe("externally-updated");
  });

  test("writes structural groups to canonical state and full nodes to the generated tree", async () => {
    const appDir = await makeApp();
    const state = ensureTaskState(appDir);
    const paths = projectRuntimePaths(appDir);
    const config: TaskStateConfig = {
      appDir,
      projectDir: appDir,
      statePath: state.path,
      journalPath: paths.journalPath,
      worker: "owner",
      maxConcurrent: 1,
    };

    saveTaskState(
      config,
      {
        project_lifecycle: "active",
        groups: { root: { id: "root", parent_id: null, state: "backlog", children: [] } },
        tasks: {},
      },
      { projectLifecycleReason: "activate test project" },
    );

    const canonical = JSON.parse(await readFile(paths.taskStatePath, "utf8"));
    const projection = JSON.parse(await readFile(paths.taskTreePath, "utf8"));
    expect(canonical.tasks).toBeUndefined();
    expect(canonical.groups.root).toMatchObject({ id: "root" });
    expect(projection.groups).toBeUndefined();
    expect(projection.tasks.root).toMatchObject({ id: "root", children: [] });
  });

  test("writes an explicit current-focused projection without canonical history payloads", async () => {
    const appDir = await makeApp();
    const state = ensureTaskState(appDir);
    const paths = projectRuntimePaths(appDir);
    const config: TaskStateConfig = {
      appDir,
      projectDir: appDir,
      statePath: state.path,
      journalPath: paths.journalPath,
      worker: "owner",
      maxConcurrent: 1,
    };

    saveTaskState(
      config,
      {
        version: 3,
        project: "sample",
        project_lifecycle: "active",
        root_task_id: "root",
        groups: { root: { id: "root", parent_id: null, owner: "owner" } },
        resources: {
          consumer: {
            metadata: { id: "consumer", generation: 2, resourceVersion: 7 },
            spec: {
              parentId: "root",
              outcome: "Consume the completed dependency",
              acceptance: ["Dependency is consumed"],
              mode: "maintain",
              dependsOn: ["completed-dependency", "converged-dependency", "live-dependency"],
            },
            status: {
              observedGeneration: 1,
              phase: "running",
              currentAttemptId: "attempt-active",
              summary: "Working",
              evidence: ["session:s_active"],
              updatedAt: "2026-07-20T00:00:00.000Z",
            },
          },
          "converged-dependency": {
            metadata: { id: "converged-dependency", generation: 1, resourceVersion: 2 },
            spec: {
              parentId: "root",
              outcome: "Maintain the live dependency",
              acceptance: ["Dependency is healthy"],
              mode: "maintain",
            },
            status: {
              observedGeneration: 1,
              phase: "converged",
              updatedAt: "2026-07-20T00:00:00.000Z",
            },
          },
        },
        attempts: {
          "attempt-old": {
            metadata: { id: "attempt-old", resourceVersion: 2 },
            taskId: "consumer",
            taskGeneration: 1,
            specHash: "old",
            owner: "owner",
            handler: "agent:owner",
            runtimeId: "old-runtime",
            state: "completed",
            reason: "task-controller",
            startedAt: "2026-07-19T00:00:00.000Z",
            finishedAt: "2026-07-19T00:01:00.000Z",
          },
          "attempt-active": {
            metadata: { id: "attempt-active", resourceVersion: 1 },
            taskId: "consumer",
            taskGeneration: 2,
            specHash: "current",
            owner: "owner",
            handler: "workflow:consumer",
            runtimeId: "current-runtime",
            state: "running",
            reason: "event",
            startedAt: "2026-07-20T00:00:00.000Z",
          },
        },
        taskTriggers: {
          consumer: {
            taskId: "consumer",
            taskGeneration: 2,
            resourceVersion: 7,
            event: { type: "sample.ready", eventId: 42 },
            observedAt: "2026-07-20T00:00:00.000Z",
          },
        },
        receipts: {
          "completed-dependency": {
            metadata: { id: "completed-dependency", generation: 1, resourceVersion: 1 },
            specHash: "completed",
            parentId: "root",
            outcome: "Complete dependency",
            acceptance: ["Completed"],
            owner: "owner",
            handler: "agent:owner",
            summary: "Completed",
            evidence: ["proof"],
            acceptanceBasis: { method: "agent-judgment", evidence: ["proof"] },
            failureFingerprints: [],
            completedAt: "2026-07-19T00:00:00.000Z",
          },
        },
        conditions: {},
        tasks: {},
      },
      { projectLifecycleReason: "activate projection test" },
    );

    const canonical = JSON.parse(await readFile(paths.taskStatePath, "utf8"));
    const projection = JSON.parse(await readFile(paths.taskTreePath, "utf8"));

    expect(canonical.attempts).toHaveProperty("attempt-old");
    expect(canonical.attempts).toHaveProperty("attempt-active");
    expect(canonical.receipts).toHaveProperty("completed-dependency");
    expect(canonical.taskTriggers).toHaveProperty("consumer");
    expect(canonical).not.toHaveProperty("satisfied_dependency_ids");
    expect(projection).not.toHaveProperty("resources");
    expect(projection).not.toHaveProperty("attempts");
    expect(projection).not.toHaveProperty("receipts");
    expect(projection).not.toHaveProperty("taskTriggers");
    expect(projection).toMatchObject({ schema_version: 2, max_concurrent: 1 });
    expect(projection.satisfied_dependency_ids).toEqual(["completed-dependency", "converged-dependency"]);
    expect(projection.tasks.consumer).toMatchObject({
      item_type: "task",
      outcome: "Consume the completed dependency",
      mode: "maintain",
      phase: "running",
      generation: 2,
      observed_generation: 1,
      synchronized: false,
      readiness: {
        state: "not-applicable",
        reason: "Task phase is running",
      },
      summary: "Working",
      evidence: ["session:s_active"],
      attempt_count: 2,
      active_attempt: {
        id: "attempt-active",
        handler: "workflow:consumer",
        state: "running",
        reason: "event",
        started_at: "2026-07-20T00:00:00.000Z",
      },
    });
    expect(projection.tasks.consumer).not.toHaveProperty("state");
    expect(projection.tasks.consumer).not.toHaveProperty("reconcile_mode");
    expect(projection.integrity).toContainEqual({
      code: "missing-dependency",
      task_id: "consumer",
      related_ids: ["live-dependency"],
      message: "Dependencies are missing: live-dependency",
    });
  });

  test("treats edits to the generated tree projection as non-authoritative", async () => {
    const appDir = await makeApp();
    const state = ensureTaskState(appDir);
    const paths = projectRuntimePaths(appDir);
    const config: TaskStateConfig = {
      appDir,
      projectDir: appDir,
      statePath: state.path,
      journalPath: paths.journalPath,
      worker: "owner",
      maxConcurrent: 1,
    };
    saveTaskState(config, {
      groups: { canonical: { id: "canonical", parent_id: null, state: "backlog", children: [] } },
      tasks: {},
    });

    await writeJson(paths.taskTreePath, {
      tasks: { projectionEdit: { id: "projectionEdit", state: "done", children: [] } },
    });

    expect(readTaskState(config).tasks).toEqual({
      canonical: { id: "canonical", parent_id: null, state: "backlog", children: [] },
    });
    const canonical = JSON.parse(await readFile(paths.taskStatePath, "utf8"));
    expect(canonical.tasks).toBeUndefined();
    expect(canonical.groups.projectionEdit).toBeUndefined();
  });

  test("projects parent and owner from the task resource instead of a stale node", async () => {
    const appDir = await makeApp();
    const state = ensureTaskState(appDir);
    const paths = projectRuntimePaths(appDir);
    const config: TaskStateConfig = {
      appDir,
      projectDir: appDir,
      statePath: state.path,
      journalPath: paths.journalPath,
      worker: "app-owner",
      maxConcurrent: 1,
    };
    saveTaskState(config, {
      groups: {
        root: { id: "root", parent_id: null, owner: "app-owner", children: ["work"] },
        stale: { id: "stale", parent_id: "root", children: ["work"] },
      },
      tasks: {},
      resources: {
        work: {
          metadata: { id: "work", generation: 1, resourceVersion: 1 },
          spec: {
            parentId: "root",
            outcome: "Converge work",
            acceptance: ["Work converges"],
            mode: "achieve",
            owner: "resource-owner",
          },
          status: {
            observedGeneration: 0,
            phase: "pending",
            updatedAt: "2026-07-20T00:00:00.000Z",
          },
        },
      },
    });

    const canonical = JSON.parse(await readFile(paths.taskStatePath, "utf8"));
    const projection = JSON.parse(await readFile(paths.taskTreePath, "utf8"));
    expect(canonical.tasks).toBeUndefined();
    expect(canonical.groups.work).toBeUndefined();
    expect(projection.tasks.work).toMatchObject({
      item_type: "task",
      parent_id: "root",
      owner: "resource-owner",
      phase: "pending",
      readiness: { state: "ready" },
    });
    expect(projection.tasks.root.children).toContain("work");
    expect(projection.tasks.stale.children).not.toContain("work");
  });

  test("merges static project json with runtime project state", async () => {
    const appDir = await makeApp();
    await writeJson(join(appDir, "project.json"), {
      id: "example",
      status: "active",
      currentState: { summary: "stale" },
    });
    saveProjectRuntimeState(appDir, {
      currentState: { summary: "runtime" },
      updatedAt: "2026-07-06T00:00:00.000Z",
    });

    const model = loadProjectReadModel(appDir);

    expect(model.id).toBe("example");
    expect(model.status).toBe("active");
    expect(model.currentState).toEqual({ summary: "runtime" });
    expect(model.updatedAt).toBe("2026-07-06T00:00:00.000Z");
  });
});
