import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectAppExecutionPaths, resolveProjectAppOutputPaths } from "./project-output-paths.js";

const roots: string[] = [];

function fixture() {
  const root = join(tmpdir(), `project-output-paths-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const appDir = join(root, "sample.app");
  const projectDir = join(root, "sample");
  mkdirSync(appDir, { recursive: true });
  mkdirSync(projectDir, { recursive: true });
  return { root, appDir, projectDir, paths: projectAppExecutionPaths(appDir, projectDir) };
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("project app output paths", () => {
  it("resolves relative outputs against the declared domain workspace", () => {
    const { projectDir, paths } = fixture();
    expect(resolveProjectAppOutputPaths(["evidence/result.json"], paths)).toEqual([
      join(projectDir, "evidence", "result.json"),
    ]);
  });

  it("allows explicit app-state outputs", () => {
    const { appDir, paths } = fixture();
    expect(resolveProjectAppOutputPaths([join(appDir, ".state", "result.json")], paths)).toEqual([
      join(appDir, ".state", "result.json"),
    ]);
  });

  it("rejects lexical and symlink escapes", () => {
    const { root, projectDir, paths } = fixture();
    expect(() => resolveProjectAppOutputPaths(["../../outside.txt"], paths)).toThrow("escapes the app/domain roots");

    const outside = join(root, "outside");
    mkdirSync(outside);
    symlinkSync(outside, join(projectDir, "linked-outside"));
    expect(() => resolveProjectAppOutputPaths(["linked-outside/result.txt"], paths)).toThrow(
      "escapes the app/domain roots",
    );
  });
});
