import { afterEach, describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

  it.each([true, false])("supports an installation with only App-local agents (git: %s)", async (withGit) => {
    const { root, stateDir } = await fixture(withGit);
    const local = join(root, "projects", "sample.app", "agents");
    renameSync(join(root, "agents"), local);
    if (withGit) { await git(root, "add", "-A"); await git(root, "commit", "-qm", "App owns its agent"); }
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    const released = store.ensureCurrent();
    expect(existsSync(released.agentsRoot)).toBe(true);
    expect(readFileSync(join(released.projectsRoot, "sample.app", "agents", "worker", "agent.json"), "utf8")).toContain('"worker"');
    expect(new DefinitionSourceReleaseStore(root, stateDir).ensureCurrent().id).toBe(released.id);
  });

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

  it("matches an expected Git HEAD and denies drift before creating a staged release", async () => {
    const matching = await fixture();
    const matchingHead = String((await git(matching.root, "rev-parse", "HEAD")).stdout).trim();
    const matched = new DefinitionSourceReleaseStore(matching.root, matching.stateDir).stage(matchingHead);
    expect(matched.sourceCommit).toBe(matchingHead);

    const drifted = await fixture();
    const approvedHead = String((await git(drifted.root, "rev-parse", "HEAD")).stdout).trim();
    writeFileSync(
      drifted.appPath,
      `export default { id: "sample-v2", version: 1, owner: "worker", inputSchema: { type: "object" } };\n`,
    );
    await git(drifted.root, "add", "projects/sample.app/app.js");
    await git(drifted.root, "commit", "-qm", "drift after approval");
    const actualHead = String((await git(drifted.root, "rev-parse", "HEAD")).stdout).trim();
    const store = new DefinitionSourceReleaseStore(drifted.root, drifted.stateDir);

    expect(() => store.stage(approvedHead)).toThrow(
      `App source commit changed before reload: expected ${approvedHead}, found ${actualHead}`,
    );
    expect(existsSync(join(drifted.stateDir, "releases"))).toBeFalse();
  });

  it("stages an explicitly pinned commit without consulting mutable worktree source", async () => {
    const { root, stateDir, appPath } = await fixture();
    const pinnedHead = String((await git(root, "rev-parse", "HEAD")).stdout).trim();
    writeFileSync(
      appPath,
      `export default { id: "dirty", version: 1, owner: "worker", inputSchema: { type: "object" } };\n`,
    );
    const untrackedHandler = join(root, "projects", "sample.app", "new-handler.ts");
    writeFileSync(untrackedHandler, "export const handler = true;\n");

    const released = new DefinitionSourceReleaseStore(root, stateDir).stage(pinnedHead);

    expect(released.sourceCommit).toBe(pinnedHead);
    expect(readFileSync(join(released.projectsRoot, "sample.app", "app.js"), "utf8")).toContain("sample-v1");
    expect(existsSync(join(released.projectsRoot, "sample.app", "new-handler.ts"))).toBeFalse();
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

  it.each(["shared", "agent", "app-agent"])(
    "requires configured manual skills and references to be committed before reload (%s)",
    async (scope) => {
      const { root, stateDir } = await fixture();
      const skillRoot = scope === "shared" ? "shared/skills"
        : scope === "agent" ? "agents/worker/skills" : "projects/sample.app/agents/worker/skills";
      const manualRoot = "projects/sample.app/docs/manual";
      mkdirSync(join(root, skillRoot), { recursive: true });
      mkdirSync(join(root, manualRoot, "existing"), { recursive: true });
      writeFileSync(join(root, manualRoot, "existing/SKILL.md"), "---\nname: existing\ndescription: Existing manual\n---\nExisting guidance");
      writeFileSync(join(root, skillRoot, "paths.json"), JSON.stringify([
        scope === "shared" ? "../../projects/sample.app/docs/manual"
          : scope === "agent" ? "../../../projects/sample.app/docs/manual" : "../../../docs/manual",
      ]));
      await git(root, "add", skillRoot, manualRoot);
      await git(root, "commit", "-qm", "configure manual discovery");
      const store = new DefinitionSourceReleaseStore(root, stateDir);
      const active = store.ensureCurrent();

      for (const file of ["new-guide/SKILL.md", "existing/references/使用说明.txt", "contract.md"]) {
        const pinned = store.stage();
        const sourcePath = join(manualRoot, file);
        mkdirSync(join(root, sourcePath, ".."), { recursive: true });
        writeFileSync(join(root, sourcePath), "New manual source\n");
        expect(() => store.stage()).toThrow(sourcePath);
        expect(store.current()?.id).toBe(active.id);
        // An explicit pin still selects the committed tree, not local additions.
        expect(store.stage(pinned.sourceCommit).id).toBe(pinned.id);
        expect(existsSync(join(active.root, sourcePath))).toBeFalse();
        await git(root, "add", sourcePath);
        await git(root, "commit", "-qm", "include manual source");
        const next = store.stage();
        expect(readFileSync(join(next.root, sourcePath), "utf8")).toBe("New manual source\n");
      }
    },
  );

  it.each([true, false])("rejects skill roots omitted from the snapshot without replacing the active release (git: %s)", async (withGit) => {
    const { root, stateDir } = await fixture(withGit);
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    const active = store.ensureCurrent();
    const manual = join(root, "docs", "manual", "guide");
    mkdirSync(manual, { recursive: true });
    writeFileSync(join(manual, "SKILL.md"), "---\nname: guide\ndescription: Guide\n---\nGuidance");
    const pathsFile = join(root, "shared", "skills", "paths.json");
    writeFileSync(pathsFile, JSON.stringify(["../../docs/manual"]));
    let pin: string | undefined;
    if (withGit) {
      await git(root, "add", "docs", "shared/skills/paths.json");
      await git(root, "commit", "-qm", "configure uncaptured manuals");
      pin = String((await git(root, "rev-parse", "HEAD")).stdout).trim();
    }
    expect(() => store.stage()).toThrow("Invalid skill discovery paths in captured App source");
    if (pin) {
      // A valid local edit cannot repair the selected, invalid commit.
      writeFileSync(pathsFile, "[]");
      expect(() => store.stage(pin)).toThrow("Invalid skill discovery paths in captured App source");
    }
    expect(store.current()?.id).toBe(active.id);
  });

  it.each([true, false])("rejects configured roots pointing back into mutable source (git: %s)", async (withGit) => {
    const { root, stateDir } = await fixture(withGit);
    symlinkSync(join(root, "shared", "skills", "sample"), join(root, "projects", "sample.app", "manual"));
    writeFileSync(join(root, "shared", "skills", "paths.json"), JSON.stringify(["../../projects/sample.app/manual"]));
    if (withGit) {
      await git(root, "add", "projects/sample.app/manual", "shared/skills/paths.json");
      await git(root, "commit", "-qm", "link mutable manual source");
    }
    expect(() => new DefinitionSourceReleaseStore(root, stateDir).stage()).toThrow("escapes captured App source");
  });

  it.each([true, false])("keeps relative skill links inside the captured tree (git: %s)", async (withGit) => {
    const { root, stateDir } = await fixture(withGit);
    const appRoot = join(root, "projects", "sample.app");
    mkdirSync(join(appRoot, "docs", "manual", "guide"), { recursive: true });
    writeFileSync(join(appRoot, "docs", "manual", "guide", "SKILL.md"), "Captured guidance");
    writeFileSync(join(appRoot, "docs", "contract.md"), "Captured contract");
    symlinkSync("../../contract.md", join(appRoot, "docs", "manual", "guide", "contract.md"));
    symlinkSync("docs/manual", join(appRoot, "manual"));
    writeFileSync(join(root, "shared", "skills", "paths.json"), JSON.stringify(["../../projects/sample.app/manual"]));
    if (withGit) {
      await git(root, "add", "projects/sample.app", "shared/skills/paths.json");
      await git(root, "commit", "-qm", "link captured manual source");
    }
    const release = new DefinitionSourceReleaseStore(root, stateDir).stage();
    writeFileSync(join(appRoot, "docs", "manual", "guide", "SKILL.md"), "Changed live guidance");
    writeFileSync(join(appRoot, "docs", "contract.md"), "Changed live contract");
    expect(readFileSync(join(release.projectsRoot, "sample.app", "manual", "guide", "SKILL.md"), "utf8")).toBe("Captured guidance");
    expect(readFileSync(join(release.projectsRoot, "sample.app", "manual", "guide", "contract.md"), "utf8")).toBe("Captured contract");
  });

  it.each([true, false])("rejects manual references outside the captured tree without replacing the active release (git: %s)", async (withGit) => {
    const { root, stateDir } = await fixture(withGit);
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    const active = store.ensureCurrent();
    const manual = join(root, "projects", "sample.app", "docs", "manual");
    mkdirSync(manual, { recursive: true });
    writeFileSync(join(manual, "SKILL.md"), "Read [contract](contract.md)");
    const external = join(root, "contract.md");
    writeFileSync(external, "Mutable source");
    symlinkSync(external, join(manual, "contract.md"));
    writeFileSync(join(root, "shared", "skills", "paths.json"), JSON.stringify(["../../projects/sample.app/docs/manual"]));
    if (withGit) {
      await git(root, "add", "projects/sample.app/docs", "shared/skills/paths.json");
      await git(root, "commit", "-qm", "link mutable manual reference");
    }
    expect(() => store.stage()).toThrow("escapes captured App source");
    expect(store.current()?.id).toBe(active.id);
  });

  it.each([true, false])("rejects path configuration linked to mutable or missing source (git: %s)", async (withGit) => {
    const { root, stateDir } = await fixture(withGit);
    const config = join(root, "path-config.json");
    writeFileSync(config, "[]");
    symlinkSync(config, join(root, "shared", "skills", "paths.json"));
    if (withGit) {
      await git(root, "add", "path-config.json", "shared/skills/paths.json");
      await git(root, "commit", "-qm", "link mutable configuration");
    }
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    expect(() => store.stage()).toThrow("escapes captured App source");
    rmSync(config);
    const pin = withGit ? String((await git(root, "rev-parse", "HEAD")).stdout).trim() : undefined;
    // Snapshot validation must reject the entry even before its target exists.
    expect(() => store.stage(pin)).toThrow("Invalid skill discovery paths in captured App source");
    expect(store.current()).toBeNull();
  });

  it.each(["configuration", "reference"])("validates cached and activated snapshots independently of mutable %s", async (failure) => {
    const { root, stateDir } = await fixture();
    const store = new DefinitionSourceReleaseStore(root, stateDir);
    const active = store.ensureCurrent();
    const pathsFile = join(root, "shared", "skills", "paths.json");
    writeFileSync(pathsFile, "[]");
    await git(root, "add", "shared/skills/paths.json");
    await git(root, "commit", "-qm", "valid path configuration");
    const pin = String((await git(root, "rev-parse", "HEAD")).stdout).trim();
    writeFileSync(pathsFile, '["../../missing"]');
    const candidate = store.stage(pin);
    expect(readFileSync(join(candidate.sharedRoot, "skills", "paths.json"), "utf8")).toBe("[]");

    // Simulate a cached release made by an older Host which accepted bad paths.
    if (failure === "configuration") {
      writeFileSync(join(candidate.sharedRoot, "skills", "paths.json"), '["../../missing"]');
    } else {
      const external = join(root, "mutable-contract.md");
      writeFileSync(external, "Mutable contract");
      symlinkSync(external, join(candidate.sharedRoot, "skills", "sample", "contract.md"));
    }
    expect(() => store.stage(pin)).toThrow("Invalid skill discovery paths in captured App source");
    expect(() => store.activate(candidate)).toThrow("Invalid skill discovery paths in captured App source");
    expect(store.current()?.id).toBe(active.id);
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
