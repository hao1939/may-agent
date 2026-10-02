import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  discoverAgentSkills,
  formatBoundedSkillCatalog,
  invokeCatalogSkill,
  parseExplicitSkill,
  type SkillCatalog,
} from "./skills.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "may-skills-"));
  roots.push(root);
  return root;
}

function writeSkill(root: string, name: string, description: string, body: string): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "SKILL.md");
  writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`);
  return file;
}

describe("May skill catalog", () => {
  it("discovers immediate packages, applies scope precedence, and excludes archive", async () => {
    const root = tempRoot();
    const appAgent = join(root, "project.app", "agents", "may");
    const globalAgent = join(root, "agents", "may");
    const shared = join(root, "shared");
    writeSkill(join(appAgent, "skills"), "review-change", "App review", "APP BODY");
    writeSkill(join(globalAgent, "skills"), "review-change", "Global review", "GLOBAL BODY");
    writeSkill(join(shared, "skills"), "review-change", "Shared review", "SHARED BODY");
    writeSkill(join(shared, "skills"), "shared-only", "Shared only", "SHARED ONLY BODY");
    writeSkill(join(shared, "skills", "archive"), "archived", "Archived", "ARCHIVED BODY");

    const catalog = await discoverAgentSkills({
      agentDir: appAgent,
      appLocal: true,
      globalAgentDir: globalAgent,
      sharedRoot: shared,
    });

    expect(catalog.skills.get("review-change")?.scope).toBe("app-agent");
    expect(catalog.skills.get("review-change")?.content).toContain("APP BODY");
    expect(catalog.skills.get("shared-only")?.scope).toBe("shared");
    expect(catalog.skills.has("archived")).toBe(false);
    expect(catalog.diagnostics).toEqual([]);
  });

  it("rejects invalid metadata and symlinks escaping trusted roots", async () => {
    const root = tempRoot();
    const agentDir = join(root, "agents", "may");
    const skillsRoot = join(agentDir, "skills");
    mkdirSync(skillsRoot, { recursive: true });
    const invalidDir = join(skillsRoot, "invalid-name");
    mkdirSync(invalidDir, { recursive: true });
    writeFileSync(join(invalidDir, "SKILL.md"), "---\nname: Different\ndescription: bad\n---\nbody\n");

    const outside = join(root, "outside", "escaped");
    writeSkill(join(root, "outside"), "escaped", "Escaped", "outside body");
    symlinkSync(outside, join(skillsRoot, "escaped"), "dir");

    const catalog = await discoverAgentSkills({ agentDir });
    expect(catalog.skills.has("invalid-name")).toBe(false);
    expect(catalog.skills.has("escaped")).toBe(false);
    expect(catalog.diagnostics.join("\n")).toContain("invalid characters");
    expect(catalog.diagnostics.join("\n")).toContain("escapes trusted skill roots");
  });

  it("keeps bodies out of the bounded catalog and inserts one body on invocation", async () => {
    const root = tempRoot();
    const agentDir = join(root, "agents", "may");
    writeSkill(join(agentDir, "skills"), "verify-change", "Verify a change", "SECRET METHOD");
    const catalog = await discoverAgentSkills({ agentDir });

    const promptCatalog = formatBoundedSkillCatalog(catalog);
    expect(promptCatalog.text).toContain("verify-change");
    expect(promptCatalog.text).not.toContain("SECRET METHOD");

    const invocation = invokeCatalogSkill(catalog, "verify-change", "review the patch");
    expect(invocation.prompt).toContain("SECRET METHOD");
    expect(invocation.prompt).toContain("review the patch");
  });

  it("discovers manuals through optional relative paths and preserves canonical references", async () => {
    const root = tempRoot();
    const shared = join(root, "shared");
    const sharedSkills = join(shared, "skills");
    const agentDir = join(root, "agents", "may");
    const manuals = join(root, "docs", "manual");
    const file = writeSkill(manuals, "task-guide", "Work on a task", "Read [the contract](../contract.md).");
    writeFileSync(join(manuals, "contract.md"), "Current contract");
    writeSkill(sharedSkills, "shared-only", "Shared method", "Shared instructions");
    writeFileSync(join(sharedSkills, "paths.json"), JSON.stringify(["../../docs/manual", "../../docs/manual", "."]));
    // A link and a configured root can expose the same source without duplicating it.
    symlinkSync(join(manuals, "task-guide"), join(sharedSkills, "task-guide"), "dir");
    const catalog = await discoverAgentSkills({ agentDir, sharedRoot: shared });

    expect(catalog.diagnostics).toEqual([]);
    expect(catalog.skills.size).toBe(2);
    const skill = catalog.skills.get("task-guide")!;
    expect(skill.scope).toBe("shared");
    expect(skill.filePath).toBe(file);
    expect(skill.canonicalPath).toBe(file);
    const invocation = invokeCatalogSkill(catalog, "task-guide", "Continue the task");
    expect(invocation.prompt).toContain(`References are relative to ${join(manuals, "task-guide")}.`);
    expect(readFileSync(resolve(dirname(skill.filePath), "../contract.md"), "utf8")).toBe("Current contract");
    expect(formatBoundedSkillCatalog(catalog).text).toContain(file);

    writeSkill(manuals, "task-guide", "Work on a task", "Revised instructions");
    const refreshed = await discoverAgentSkills({ agentDir, sharedRoot: shared });
    expect(invokeCatalogSkill(catalog, "task-guide", "Continue").prompt).not.toContain("Revised instructions");
    expect(invokeCatalogSkill(refreshed, "task-guide", "Continue").prompt).toContain("Revised instructions");
  });

  it("keeps scope precedence and rejects distinct same-scope duplicates in configured paths", async () => {
    const root = tempRoot();
    const agentDir = join(root, "agents", "may");
    const shared = join(root, "shared");
    const manuals = join(root, "docs", "manual");
    writeSkill(join(agentDir, "skills"), "review-change", "Local review", "Local instructions");
    writeSkill(join(shared, "skills"), "ambiguous", "First method", "First instructions");
    writeSkill(manuals, "review-change", "Shared review", "Shared instructions");
    writeSkill(manuals, "ambiguous", "Second method", "Second instructions");
    writeFileSync(join(shared, "skills", "paths.json"), JSON.stringify(["../../docs/manual"]));

    const catalog = await discoverAgentSkills({ agentDir, sharedRoot: shared });
    expect(catalog.skills.get("review-change")?.scope).toBe("agent");
    expect(catalog.skills.has("ambiguous")).toBe(false);
    expect(catalog.diagnostics.join("\n")).toContain('Ambiguous shared skill name "ambiguous"');
  });

  it("reports invalid or unavailable optional paths without dropping ordinary skills", async () => {
    const root = tempRoot();
    const agentDir = join(root, "agents", "may");
    const skills = join(agentDir, "skills");
    writeSkill(skills, "verify-change", "Verify a change", "Existing method");
    for (const value of [
      "{",
      "{}",
      "[42]",
      '[""]',
      JSON.stringify([root]),
      '["missing"]',
      '["verify-change/SKILL.md"]',
    ]) {
      writeFileSync(join(skills, "paths.json"), value);
      const catalog = await discoverAgentSkills({ agentDir });
      expect(catalog.skills.has("verify-change")).toBe(true);
      expect(catalog.diagnostics.join("\n")).toContain("paths.json");
    }
  });

  it("reports a dangling path configuration instead of treating it as absent", async () => {
    const root = tempRoot();
    const agentDir = join(root, "agents", "may");
    const skills = join(agentDir, "skills");
    writeSkill(skills, "verify-change", "Verify a change", "Existing method");
    symlinkSync(join(root, "missing.json"), join(skills, "paths.json"));

    const catalog = await discoverAgentSkills({ agentDir });
    expect(catalog.skills.has("verify-change")).toBe(true);
    expect(catalog.diagnostics.join("\n")).toContain("paths.json");
    expect(catalog.diagnostics.join("\n")).toContain("ENOENT");
  });

  it("rejects symlinks escaping configured roots and does not follow nested path files", async () => {
    const root = tempRoot();
    const agentDir = join(root, "agents", "may");
    const manuals = join(root, "docs", "manual");
    writeSkill(manuals, "task-guide", "Task guide", "Current guidance");
    writeSkill(join(root, "outside"), "escaped", "Outside method", "Outside instructions");
    writeSkill(join(agentDir, "skills"), "local", "Local method", "Local instructions");
    writeFileSync(join(agentDir, "skills", "paths.json"), JSON.stringify(["../../../docs/manual"]));
    writeFileSync(join(manuals, "paths.json"), JSON.stringify(["../../outside"]));
    symlinkSync(join(root, "outside", "escaped"), join(manuals, "escaped"), "dir");

    const catalog = await discoverAgentSkills({ agentDir });
    expect(catalog.skills.has("task-guide")).toBe(true);
    expect(catalog.skills.has("escaped")).toBe(false);
    expect(catalog.diagnostics.join("\n")).toContain("escapes trusted skill roots");
  });

  it("omits lower-priority entries when the prompt budget is exhausted", () => {
    const skill = (name: string, scope: "agent" | "shared") => ({
      name,
      description: "x".repeat(200),
      content: "body",
      filePath: `/skills/${name}/SKILL.md`,
      canonicalPath: `/skills/${name}/SKILL.md`,
      contentHash: name,
      scope,
    });
    const catalog: SkillCatalog = {
      skills: new Map([
        ["closer", skill("closer", "agent")],
        ["shared", skill("shared", "shared")],
      ]),
      diagnostics: [],
      omittedFromPrompt: [],
    };
    const result = formatBoundedSkillCatalog(catalog, 700);
    expect(result.text).toContain("closer");
    expect(result.omitted).toContain("shared");
  });

  it("normalizes explicit $skill syntax without creating another work type", () => {
    expect(parseExplicitSkill("$verify-change review this")).toEqual({
      skill: "verify-change",
      task: "review this",
    });
    expect(parseExplicitSkill("ordinary task")).toEqual({ task: "ordinary task" });
  });
});
