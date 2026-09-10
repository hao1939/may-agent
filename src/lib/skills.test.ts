import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
