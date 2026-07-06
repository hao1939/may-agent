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
  test("uses an existing runtime task tree before legacy source", async () => {
    const appDir = await makeApp();
    await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
    await writeFile(join(appDir, ".state", "tasks", "tree.json"), `{"source":"runtime","tasks":{}}\n`, "utf8");
    await writeFile(join(appDir, "tasks", "tree.json"), `{"source":"legacy","tasks":{}}\n`, "utf8");

    const result = ensureTaskTreeState(appDir);
    const tree = JSON.parse(await readFile(result.path, "utf8"));

    expect(result).toMatchObject({ migrated: false, source: "runtime" });
    expect(tree.source).toBe("runtime");
  });

  test("copies legacy task tree once when runtime state is missing", async () => {
    const appDir = await makeApp();
    await writeFile(join(appDir, "tasks", "tree.json"), `{"source":"legacy","tasks":{}}\n`, "utf8");

    const result = ensureTaskTreeState(appDir);
    const tree = JSON.parse(await readFile(result.path, "utf8"));

    expect(result).toMatchObject({ migrated: true, source: "legacy-tree" });
    expect(result.path).toBe(projectRuntimePaths(appDir).taskTreePath);
    expect(tree.source).toBe("legacy");
    expect(existsSync(projectRuntimePaths(appDir).migrationLogPath)).toBe(true);
  });

  test("boots from seed when no runtime or legacy tree exists", async () => {
    const appDir = await makeApp();
    await writeFile(join(appDir, "tasks", "seed.json"), `{"source":"seed","tasks":{}}\n`, "utf8");

    const result = ensureTaskTreeState(appDir);
    const tree = JSON.parse(await readFile(result.path, "utf8"));

    expect(result).toMatchObject({ migrated: true, source: "seed" });
    expect(tree.source).toBe("seed");
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
