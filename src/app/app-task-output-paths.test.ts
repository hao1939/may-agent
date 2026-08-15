import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appTaskExecutionPaths, resolveAppTaskOutputPaths, withAppTaskWorkspace } from "./app-task-output-paths.js";

const roots: string[] = [];

function fixture() {
  const root = join(tmpdir(), `project-output-paths-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const appDir = join(root, "sample.app");
  const projectDir = join(root, "sample");
  mkdirSync(appDir, { recursive: true });
  mkdirSync(projectDir, { recursive: true });
  return { root, appDir, projectDir, paths: appTaskExecutionPaths(appDir, projectDir) };
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("App task output paths", () => {
  it("defaults unbound owner execution to the app while retaining explicit domain inspection", () => {
    const { appDir, projectDir, paths } = fixture();
    writeFileSync(join(projectDir, "domain-proof.txt"), "read-only domain evidence\n");

    expect(paths).toEqual({ appDir, projectDir, workspaceDir: appDir });
    expect(readFileSync(join(paths.projectDir, "domain-proof.txt"), "utf8")).toBe("read-only domain evidence\n");
  });

  it("replaces the owner cwd with a workflow-declared task worktree", () => {
    const { root, appDir, projectDir, paths } = fixture();
    const taskWorkspace = join(root, "worktrees", "task-example");
    mkdirSync(taskWorkspace, { recursive: true });

    expect(withAppTaskWorkspace(paths, taskWorkspace)).toEqual({
      appDir,
      projectDir,
      workspaceDir: taskWorkspace,
    });
  });

  it("resolves relative outputs against the declared domain workspace", () => {
    const { projectDir, paths } = fixture();
    expect(resolveAppTaskOutputPaths(["evidence/result.json"], paths)).toEqual([
      join(projectDir, "evidence", "result.json"),
    ]);
  });

  it("allows explicit app-state outputs", () => {
    const { appDir, paths } = fixture();
    expect(resolveAppTaskOutputPaths([join(appDir, ".state", "result.json")], paths)).toEqual([
      join(appDir, ".state", "result.json"),
    ]);
  });

  it("rejects lexical and symlink escapes", () => {
    const { root, projectDir, paths } = fixture();
    expect(() => resolveAppTaskOutputPaths(["../../outside.txt"], paths)).toThrow("escapes the app/domain roots");

    const outside = join(root, "outside");
    mkdirSync(outside);
    symlinkSync(outside, join(projectDir, "linked-outside"));
    expect(() => resolveAppTaskOutputPaths(["linked-outside/result.txt"], paths)).toThrow(
      "escapes the app/domain roots",
    );
  });
});
