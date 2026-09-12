import { afterEach, describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { discoverAppDefinitions } from "./adapters/discovery/app-definitions.js";
import { AppRegistry } from "./core/apps/registry.js";
import { DefinitionSourceReleaseStore } from "./app-source-release.js";
import { loadAgentLocalTools } from "./loader/agent-local-tools.js";

const git = (cwd: string, ...args: string[]) => promisify(execFile)("git", args, { cwd, timeout: 10_000 });

function loadAppDefinitions(projectsRoot: string, canonicalProjectsRoot = projectsRoot) {
  return new AppRegistry(discoverAppDefinitions(projectsRoot, canonicalProjectsRoot)).reload();
}

describe("App source releases", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  async function fixture(withGit = true): Promise<{ root: string; stateDir: string; appPath: string }> {
    const root = join(tmpdir(), `app-source-release-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const appDir = join(root, "projects", "sample.app");
    const appPath = join(appDir, "app.js");
    const agentDir = join(root, "agents", "worker");
    const sharedSkillsDir = join(root, "shared", "skills", "sample");
    const stateDir = join(root, ".state");
    roots.push(root);
    mkdirSync(appDir, { recursive: true });
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(sharedSkillsDir, { recursive: true });
    writeFileSync(
      appPath,
      `export default { id: "sample-v1", version: 1, owner: "worker", inputSchema: { type: "object" } };\n`,
    );
    writeFileSync(
      join(agentDir, "agent.json"),
      `${JSON.stringify({ name: "worker", description: "worker", domain: "test", model: "test", tools: [] })}\n`,
    );
    writeFileSync(join(root, "shared", "common-sense.md"), "shared guidance v1\n");
    writeFileSync(join(sharedSkillsDir, "SKILL.md"), "---\nname: sample\ndescription: sample\n---\n\n# Sample\n");
    if (withGit) {
      await git(root, "init", "-q");
      await git(root, "config", "user.email", "test@example.com");
      await git(root, "config", "user.name", "Test");
      await git(
        root,
        "add",
        "agents/worker/agent.json",
        "projects/sample.app/app.js",
        "shared/common-sense.md",
        "shared/skills/sample/SKILL.md",
      );
      await git(root, "commit", "-qm", "initial");
    }
    return { root, stateDir, appPath };
  }

  it("restores the activated committed source until a later release is explicitly activated", async () => {
    const { root, stateDir, appPath } = await fixture();
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    const first = store.ensureCurrent();
    const canonicalProjectsRoot = join(root, "projects");

    expect(first.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(readFileSync(join(first.agentsRoot, "worker", "agent.json"), "utf8")).toContain('"worker"');
    expect(readFileSync(join(first.sharedRoot, "common-sense.md"), "utf8")).toBe("shared guidance v1\n");
    expect((await loadAppDefinitions(first.projectsRoot, canonicalProjectsRoot))[0]).toMatchObject({
      appDir: join(canonicalProjectsRoot, "sample.app"),
      definition: { id: "sample-v1" },
    });

    writeFileSync(
      appPath,
      `export default { id: "dirty", version: 1, owner: "worker", inputSchema: { type: "object" } };\n`,
    );
    expect((await loadAppDefinitions(store.ensureCurrent().projectsRoot))[0]?.definition.id).toBe("sample-v1");

    await git(root, "add", "projects/sample.app/app.js");
    await git(root, "commit", "-qm", "second");
    const second = store.stage();
    expect(second.id).not.toBe(first.id);
    expect((await loadAppDefinitions(second.projectsRoot))[0]?.definition.id).toBe("dirty");
    expect(store.current()?.id).toBe(first.id);

    store.activate(second);
    expect(store.current()?.id).toBe(second.id);
  });

  it("snapshots small non-git fixture Apps without copying runtime state", async () => {
    const { root, stateDir } = await fixture(false);
    for (const directory of [".state", "evidence", "facts"]) {
      const runtimeState = join(root, "projects", "sample.app", directory, "runtime.json");
      mkdirSync(join(runtimeState, ".."), { recursive: true });
      writeFileSync(runtimeState, "{}\n");
    }
    writeFileSync(join(root, "projects", "sample.app", ".disabled"), "");

    const release = new DefinitionSourceReleaseStore(root, stateDir).ensureCurrent();
    expect(readFileSync(join(release.projectsRoot, "sample.app", "app.js"), "utf8")).toContain("sample-v1");
    for (const directory of [".state", "evidence", "facts"]) {
      expect(existsSync(join(release.projectsRoot, "sample.app", directory))).toBeFalse();
    }
    expect(existsSync(join(release.projectsRoot, "sample.app", ".disabled"))).toBeFalse();
  });

  it("keeps an untracked disable marker outside committed definition releases", async () => {
    const { root, stateDir } = await fixture();
    const projectsRoot = join(root, "projects");
    const marker = join(projectsRoot, "sample.app", ".disabled");
    writeFileSync(marker, "");
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    const release = store.ensureCurrent();
    expect(existsSync(join(release.projectsRoot, "sample.app", ".disabled"))).toBeFalse();
    expect(await loadAppDefinitions(release.projectsRoot, projectsRoot)).toEqual([]);
    rmSync(marker);
    expect((await loadAppDefinitions(store.ensureCurrent().projectsRoot, projectsRoot))[0]?.definition.id).toBe(
      "sample-v1",
    );
  });

  it.each([true, false])("pins shared tool imports with the agent source (git: %s)", async (withGit) => {
    const { root, stateDir } = await fixture(withGit);
    const sharedTools = join(root, "shared", "tools");
    const localTools = join(root, "agents", "worker", "tools");
    mkdirSync(sharedTools, { recursive: true });
    mkdirSync(localTools, { recursive: true });
    const helper = join(sharedTools, "sample.js");
    writeFileSync(helper, 'export const createTool = () => ({ name: "sample-v1" });\n');
    writeFileSync(
      join(localTools, "sample.js"),
      'import { createTool } from "../../../shared/tools/sample.js"; export default createTool;\n',
    );
    if (withGit) {
      await git(root, "add", "shared/tools", "agents/worker/tools");
      await git(root, "commit", "-qm", "shared tool");
    }
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    const first = store.ensureCurrent();
    writeFileSync(helper, 'export const createTool = () => ({ name: "sample-v2" });\n');
    const notices: string[] = [];
    const load = async (release: typeof first) =>
      (
        await loadAgentLocalTools("worker", join(release.agentsRoot, "worker"), {
          projectRoot: root,
          persistDir: stateDir,
          onNotice: (notice) => notices.push(notice),
        })
      ).map((tool) => tool.name);
    expect(await load(first)).toEqual(["sample-v1"]);
    expect(first.id).toEndWith("-definitions-v4");
    // Content cache identity changes; the manifest schema does not. Previous
    // Hosts must still be able to read the active source after binary rollback.
    expect(JSON.parse(readFileSync(join(first.root, "release.json"), "utf8")).version).toBe(3);
    expect(notices).toEqual([]);
    if (withGit) {
      expect(() => store.stage()).toThrow("commit them before reload");
      await git(root, "add", "shared/tools");
      await git(root, "commit", "-qm", "update shared tool");
    }
    const second = store.stage();
    expect(second.id).not.toBe(first.id);
    expect(await load(second)).toEqual(["sample-v2"]);
    expect(await load(first)).toEqual(["sample-v1"]);
    expect(store.current()?.id).toBe(first.id);
    expect(notices).toEqual([]);
  });

  it("rejects an untracked shared tool before publishing a release", async () => {
    const { root, stateDir } = await fixture();
    mkdirSync(join(root, "shared", "tools"), { recursive: true });
    writeFileSync(join(root, "shared", "tools", "untracked.ts"), "export const value = 1;\n");
    expect(() => new DefinitionSourceReleaseStore(root, stateDir).stage()).toThrow("untracked executable/config files");
  });

  it("keeps minimal non-git sandboxes valid without inventing shared guidance", async () => {
    const { root, stateDir } = await fixture(false);
    rmSync(join(root, "shared"), { recursive: true, force: true });

    const release = new DefinitionSourceReleaseStore(root, stateDir).ensureCurrent();
    expect(readFileSync(join(release.sharedRoot, "common-sense.md"), "utf8")).toBe("");
    expect(existsSync(join(release.sharedRoot, "skills"))).toBeTrue();
  });

  it("rejects implicit activation of uncommitted App code", async () => {
    const { root, stateDir, appPath } = await fixture();
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    store.ensureCurrent();
    writeFileSync(
      appPath,
      `export default { id: "dirty", version: 1, owner: "worker", inputSchema: { type: "object" } };\n`,
    );

    expect(() => store.stage()).toThrow("commit them before reload");
    expect(store.current()?.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("rejects implicit activation of uncommitted agent definitions", async () => {
    const { root, stateDir } = await fixture();
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    const active = store.ensureCurrent();
    const agentPath = join(root, "agents", "worker", "agent.json");
    writeFileSync(
      agentPath,
      `${JSON.stringify({ name: "worker", description: "dirty", domain: "test", model: "test", tools: [] })}\n`,
    );

    expect(() => store.stage()).toThrow("commit them before reload");
    expect(readFileSync(join(active.agentsRoot, "worker", "agent.json"), "utf8")).not.toContain("dirty");
    expect(store.current()?.id).toBe(active.id);
  });

  it("rejects implicit activation of uncommitted shared prompt definitions", async () => {
    const { root, stateDir } = await fixture();
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    const active = store.ensureCurrent();
    writeFileSync(join(root, "shared", "common-sense.md"), "dirty guidance\n");

    expect(() => store.stage()).toThrow("commit them before reload");
    expect(readFileSync(join(active.sharedRoot, "common-sense.md"), "utf8")).toBe("shared guidance v1\n");
    expect(store.current()?.id).toBe(active.id);
  });

  it("ignores runtime facts but rejects an untracked executable source file", async () => {
    const { root, stateDir } = await fixture();
    for (const directory of ["evidence", "facts"]) {
      const factsDir = join(root, "projects", "sample.app", directory);
      mkdirSync(factsDir, { recursive: true });
      writeFileSync(join(factsDir, "receipt.json"), "{}\n");
    }
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    const release = store.ensureCurrent();
    expect(release.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
    for (const directory of ["evidence", "facts"]) {
      expect(existsSync(join(release.projectsRoot, "sample.app", directory))).toBeFalse();
    }

    writeFileSync(join(root, "projects", "sample.app", "new-handler.ts"), "export const handler = true;\n");
    expect(() => store.stage()).toThrow("untracked executable/config files");
  });
});
