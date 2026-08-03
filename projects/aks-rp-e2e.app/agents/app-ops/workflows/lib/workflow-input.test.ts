import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAppDir } from "./workflow-input.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveAppDir", () => {
  test("uses a valid explicit app directory", () => {
    const root = mkdtempSync(join(tmpdir(), "aks-workflow-input-"));
    tempDirs.push(root);
    const projectDir = join(root, "domain");
    const appDir = join(root, "explicit.app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "project.json"), "{}\n");

    expect(resolveAppDir(projectDir, appDir)).toBe(appDir);
  });

  test("falls back from a bundled runtime directory to the sibling app", () => {
    const root = mkdtempSync(join(tmpdir(), "aks-workflow-input-"));
    tempDirs.push(root);
    const projectDir = join(root, "aks-rp-e2e");
    const appDir = `${projectDir}.app`;
    const runtimeModuleDir = join(appDir, ".state", "runtime-modules");
    mkdirSync(runtimeModuleDir, { recursive: true });
    writeFileSync(join(appDir, "project.json"), "{}\n");

    expect(resolveAppDir(projectDir, runtimeModuleDir)).toBe(appDir);
  });
});
