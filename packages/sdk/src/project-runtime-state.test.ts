import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  ensureTaskTreeState,
  loadProjectReadModel,
  projectRuntimePaths,
  saveProjectRuntimeState,
} from "./project-runtime-state.js";
import { readTaskTree, saveTaskTree, type TaskTreeConfig } from "./project-task-tree-store.js";

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
  test("migrates an existing runtime tree into canonical resource state", async () => {
    const appDir = await makeApp();
    await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
    await writeFile(join(appDir, ".state", "tasks", "tree.json"), `{"source":"runtime","tasks":{}}\n`, "utf8");
    await writeFile(join(appDir, "tasks", "tree.json"), `{"source":"legacy","tasks":{}}\n`, "utf8");

    const result = ensureTaskTreeState(appDir);
    const tree = JSON.parse(await readFile(result.path, "utf8"));

    expect(result).toMatchObject({ migrated: true, source: "runtime" });
    expect(result.path).toBe(projectRuntimePaths(appDir).taskStatePath);
    expect(tree.source).toBe("runtime");
  });

  test("does not bootstrap mutable runtime state from a legacy tree", async () => {
    const appDir = await makeApp();
    await writeFile(join(appDir, "tasks", "tree.json"), `{"source":"legacy","tasks":{}}\n`, "utf8");

    const result = ensureTaskTreeState(appDir);
    const tree = JSON.parse(await readFile(result.path, "utf8"));

    expect(result).toMatchObject({ migrated: true, source: "empty" });
    expect(result.path).toBe(projectRuntimePaths(appDir).taskStatePath);
    expect(tree.source).toBeUndefined();
    expect(tree.tasks).toEqual({});
    expect(existsSync(projectRuntimePaths(appDir).migrationLogPath)).toBe(true);
  });

  test("boots from seed when no runtime or legacy tree exists", async () => {
    const appDir = await makeApp();
    await writeFile(join(appDir, "tasks", "seed.json"), `{"source":"seed","tasks":{}}\n`, "utf8");

    const result = ensureTaskTreeState(appDir);
    const tree = JSON.parse(await readFile(result.path, "utf8"));

    expect(result).toMatchObject({ migrated: true, source: "seed" });
    expect(tree.source).toBe("seed");
    expect(existsSync(projectRuntimePaths(appDir).taskTreePath)).toBe(true);
  });

  test("uses existing canonical resource state without consulting the projection", async () => {
    const appDir = await makeApp();
    const paths = projectRuntimePaths(appDir);
    await writeJson(paths.taskStatePath, { source: "state", tasks: {} });
    await writeJson(paths.taskTreePath, { source: "projection", tasks: {} });

    const result = ensureTaskTreeState(appDir);
    const state = JSON.parse(await readFile(result.path, "utf8"));

    expect(result).toMatchObject({ migrated: false, source: "runtime" });
    expect(state.source).toBe("state");
  });

  test("writes the canonical state and generated tree projection together", async () => {
    const appDir = await makeApp();
    const state = ensureTaskTreeState(appDir);
    const paths = projectRuntimePaths(appDir);
    const config: TaskTreeConfig = {
      appDir,
      projectDir: appDir,
      treePath: state.path,
      journalPath: paths.journalPath,
      worker: "owner",
      maxConcurrent: 1,
    };

    saveTaskTree(
      config,
      {
        project_lifecycle: "active",
        tasks: { root: { id: "root", state: "backlog", children: [] } },
      },
      { projectLifecycleReason: "activate test project" },
    );

    expect(JSON.parse(await readFile(paths.taskStatePath, "utf8"))).toEqual(
      JSON.parse(await readFile(paths.taskTreePath, "utf8")),
    );
  });

  test("treats edits to the generated tree projection as non-authoritative", async () => {
    const appDir = await makeApp();
    const state = ensureTaskTreeState(appDir);
    const paths = projectRuntimePaths(appDir);
    const config: TaskTreeConfig = {
      appDir,
      projectDir: appDir,
      treePath: state.path,
      journalPath: paths.journalPath,
      worker: "owner",
      maxConcurrent: 1,
    };
    saveTaskTree(config, {
      tasks: { canonical: { id: "canonical", state: "backlog", children: [] } },
    });

    await writeJson(paths.taskTreePath, {
      tasks: { projectionEdit: { id: "projectionEdit", state: "done", children: [] } },
    });

    expect(readTaskTree(config).tasks).toEqual({
      canonical: { id: "canonical", state: "backlog", children: [] },
    });
    expect(JSON.parse(await readFile(paths.taskStatePath, "utf8")).tasks.projectionEdit).toBeUndefined();
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
