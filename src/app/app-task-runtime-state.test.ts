import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTaskStateLifecycle } from "./app-task-runtime-state.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function writeState(value: unknown): string {
  const appDir = join(tmpdir(), `task-runtime-state-${Date.now()}-${Math.random().toString(36).slice(2)}.app`);
  roots.push(appDir);
  const stateDir = join(appDir, ".state", "tasks");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "state.json"), `${JSON.stringify(value, null, 2)}\n`);
  return appDir;
}

describe("task runtime state header", () => {
  it("reads a canonical top-level project lifecycle", () => {
    const appDir = writeState({
      version: 2,
      project: "sample",
      project_lifecycle: " paused ",
      conditions: {},
      resources: {},
    });
    expect(readTaskStateLifecycle(appDir)).toBe("paused");
  });

  it("does not mistake a nested lifecycle field for the project lifecycle", () => {
    const appDir = writeState({
      version: 2,
      project: "sample",
      conditions: { nested: { project_lifecycle: "paused" } },
      resources: {},
    });
    expect(readTaskStateLifecycle(appDir)).toBe("");
  });

  it("returns no lifecycle for a missing or malformed state header", () => {
    expect(readTaskStateLifecycle(join(tmpdir(), "missing-task-runtime-state.app"))).toBe("");
    const appDir = writeState({ project_lifecycle: 42, resources: {} });
    expect(readTaskStateLifecycle(appDir)).toBe("");
  });
});
