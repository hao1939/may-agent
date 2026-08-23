import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAppDefinitions } from "./loader/app-loader.js";
import { AppSourceReleaseStore } from "./app-source-release.js";

describe("App source releases", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function fixture(withGit = true): { root: string; stateDir: string; appPath: string } {
    const root = join(tmpdir(), `app-source-release-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const appDir = join(root, "projects", "sample.app");
    const appPath = join(appDir, "app.js");
    const stateDir = join(root, ".state");
    roots.push(root);
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      appPath,
      `export default { id: "sample-v1", version: 1, owner: "worker", inputSchema: { type: "object" } };\n`,
    );
    if (withGit) {
      execFileSync("git", ["init", "-q"], { cwd: root });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
      execFileSync("git", ["add", "projects/sample.app/app.js"], { cwd: root });
      execFileSync("git", ["commit", "-qm", "initial"], { cwd: root });
    }
    return { root, stateDir, appPath };
  }

  it("restores the activated committed source until a later release is explicitly activated", async () => {
    const { root, stateDir, appPath } = fixture();
    const store = new AppSourceReleaseStore(root, stateDir);
    const first = store.ensureCurrent();
    const canonicalProjectsRoot = join(root, "projects");

    expect(first.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
    expect((await loadAppDefinitions(first.projectsRoot, {}, canonicalProjectsRoot))[0]).toMatchObject({
      appDir: join(canonicalProjectsRoot, "sample.app"),
      definition: { id: "sample-v1" },
    });

    writeFileSync(
      appPath,
      `export default { id: "dirty", version: 1, owner: "worker", inputSchema: { type: "object" } };\n`,
    );
    expect((await loadAppDefinitions(store.ensureCurrent().projectsRoot))[0]?.definition.id).toBe("sample-v1");

    execFileSync("git", ["add", "projects/sample.app/app.js"], { cwd: root });
    execFileSync("git", ["commit", "-qm", "second"], { cwd: root });
    const second = store.stage();
    expect(second.id).not.toBe(first.id);
    expect((await loadAppDefinitions(second.projectsRoot))[0]?.definition.id).toBe("dirty");
    expect(store.current()?.id).toBe(first.id);

    store.activate(second);
    expect(store.current()?.id).toBe(second.id);
  });

  it("snapshots small non-git fixture Apps without copying runtime state", () => {
    const { root, stateDir } = fixture(false);
    const runtimeState = join(root, "projects", "sample.app", ".state", "runtime.json");
    mkdirSync(join(runtimeState, ".."), { recursive: true });
    writeFileSync(runtimeState, "{}\n");

    const release = new AppSourceReleaseStore(root, stateDir).ensureCurrent();
    expect(readFileSync(join(release.projectsRoot, "sample.app", "app.js"), "utf8")).toContain("sample-v1");
    expect(existsSync(join(release.projectsRoot, "sample.app", ".state"))).toBeFalse();
  });

  it("rejects implicit activation of uncommitted App code", () => {
    const { root, stateDir, appPath } = fixture();
    const store = new AppSourceReleaseStore(root, stateDir);
    store.ensureCurrent();
    writeFileSync(
      appPath,
      `export default { id: "dirty", version: 1, owner: "worker", inputSchema: { type: "object" } };\n`,
    );

    expect(() => store.stage()).toThrow("commit them before reload");
    expect(store.current()?.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("ignores runtime evidence but rejects an untracked executable source file", () => {
    const { root, stateDir } = fixture();
    const evidenceDir = join(root, "projects", "sample.app", "evidence");
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, "receipt.json"), "{}\n");
    const store = new AppSourceReleaseStore(root, stateDir);
    expect(store.ensureCurrent().sourceCommit).toMatch(/^[0-9a-f]{40}$/);

    writeFileSync(join(root, "projects", "sample.app", "new-handler.ts"), "export const handler = true;\n");
    expect(() => store.stage()).toThrow("untracked executable/config files");
  });
});
