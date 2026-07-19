import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAppDir } from "./workflow-input.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("resolveAppDir", () => {
  test("uses an explicit controller-provided app path", () => {
    expect(resolveAppDir("/workspace/domain", "/workspace/domain.app")).toBe("/workspace/domain.app");
  });

  test("uses the sibling workspace.app convention", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-app-path-"));
    roots.push(root);
    const workspace = join(root, "sample");
    const appDir = `${workspace}.app`;
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "project.json"), "{}\n");

    expect(resolveAppDir(workspace)).toBe(appDir);
  });

  test("does not discover retired embedded app layouts", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-app-embedded-"));
    roots.push(root);
    mkdirSync(join(root, ".app"), { recursive: true });
    writeFileSync(join(root, ".app", "project.json"), "{}\n");

    expect(() => resolveAppDir(root)).toThrow("Cannot resolve sibling Agent App");
  });
});
