import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { createWorkflowTool } from "../src/lib/workflow-tool.js";
import { SubagentManager } from "../src/lib/manager.js";
import type { WorkflowToolResult } from "../src/lib/workflow.js";

const AGENTS_ROOT = resolve(import.meta.dirname, "..", "agents");
const COACH_DIR = resolve(AGENTS_ROOT, "coach");

describe("coach: workflow discovery", () => {
  it("workflows directory exists and contains .ts files", () => {
    const wfDir = resolve(COACH_DIR, "workflows");
    expect(existsSync(wfDir), "agents/coach/workflows/ must exist").toBe(true);
    const files = readdirSync(wfDir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it("workflow tool can list all coach workflows without load errors", async () => {
    const wfDir = resolve(COACH_DIR, "workflows");
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "coach-test-")) });
    const tool = createWorkflowTool({ manager, workflowDir: wfDir });

    const result = await tool.execute("tc1", { action: "list" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("list");
    if (parsed.type === "list") {
      expect(parsed.workflows.length).toBeGreaterThanOrEqual(3);
      // No load errors
      for (const wf of parsed.workflows) {
        expect(wf.description, `workflow "${wf.name}" has load error`).not.toContain("load error");
      }
      // All have names and descriptions
      for (const wf of parsed.workflows) {
        expect(wf.name.length).toBeGreaterThan(0);
        expect(wf.description.length).toBeGreaterThan(0);
        expect(wf.description).not.toBe("(no description)");
      }
    }
  });

  it("each workflow exports name, description, and execute", async () => {
    const wfDir = resolve(COACH_DIR, "workflows");
    const files = readdirSync(wfDir).filter((f) => f.endsWith(".ts"));

    for (const file of files) {
      const mod = await import(resolve(wfDir, file));
      expect(typeof mod.name, `${file} must export name`).toBe("string");
      expect(typeof mod.description, `${file} must export description`).toBe("string");
      expect(typeof mod.execute, `${file} must export execute`).toBe("function");
    }
  });
});

describe("coach: skill discovery", () => {
  it("skills directory exists with subdirectories", () => {
    const skillsDir = resolve(COACH_DIR, "skills");
    expect(existsSync(skillsDir), "agents/coach/skills/ must exist").toBe(true);
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    expect(dirs.length).toBeGreaterThanOrEqual(1);
  });

  it("each skill directory has a SKILL.md with valid frontmatter", () => {
    const skillsDir = resolve(COACH_DIR, "skills");
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    for (const dir of dirs) {
      const skillFile = resolve(skillsDir, dir.name, "SKILL.md");
      expect(existsSync(skillFile), `${dir.name}/SKILL.md must exist`).toBe(true);

      const content = readFileSync(skillFile, "utf-8");
      // Check YAML frontmatter
      expect(content.startsWith("---"), `${dir.name}/SKILL.md must start with ---`).toBe(true);
      const endIdx = content.indexOf("---", 3);
      expect(endIdx).toBeGreaterThan(3);

      const frontmatter = content.slice(3, endIdx);
      expect(frontmatter).toContain("name:");
      expect(frontmatter).toContain("description:");
    }
  });
});

describe("coach: knowledge files", () => {
  it("SOUL.md exists and is concise", () => {
    const file = resolve(COACH_DIR, "SOUL.md");
    expect(existsSync(file)).toBe(true);
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n").length;
    expect(lines).toBeLessThan(100);
    expect(content).toContain("coach");
  });

  it("DOMAIN.md exists and indexes workflows", () => {
    const file = resolve(COACH_DIR, "DOMAIN.md");
    expect(existsSync(file)).toBe(true);
    const content = readFileSync(file, "utf-8");
    expect(content).toContain("workflow");
    expect(content).toContain("knowledge/");
    expect(content).toContain("workspace/");
  });

  it("DOMAIN.md references only files that exist", () => {
    const content = readFileSync(resolve(COACH_DIR, "DOMAIN.md"), "utf-8");
    // Extract paths like knowledge/foo.md and workspace/bar.md
    const pathPattern = /(?:knowledge|workspace)\/[\w-]+(?:\.md)?/g;
    const matches = content.match(pathPattern) || [];

    for (const p of matches) {
      const full = resolve(COACH_DIR, p);
      // workspace paths may reference directories (sessions/, exercises/)
      if (p.endsWith("/") || !p.includes(".")) {
        expect(existsSync(full), `${p} referenced in DOMAIN.md must exist`).toBe(true);
      } else {
        expect(existsSync(full), `${p} referenced in DOMAIN.md must exist`).toBe(true);
      }
    }
  });

  it("LESSONS.md exists", () => {
    expect(existsSync(resolve(COACH_DIR, "LESSONS.md"))).toBe(true);
  });

  it("coaching-methodology.md references agents tool", () => {
    const file = resolve(COACH_DIR, "knowledge", "library", "coaching-methodology.md");
    expect(existsSync(file)).toBe(true);
    const content = readFileSync(file, "utf-8");
    expect(content).toContain("agents");
  });
});

describe("coach: agent.json", () => {
  it("has required tools", () => {
    const config = JSON.parse(readFileSync(resolve(COACH_DIR, "agent.json"), "utf-8"));
    const tools: string[] = config.tools;
    expect(tools).toContain("agents");
    expect(tools).toContain("socket-watch");
    expect(tools).toContain("workflow");
    expect(tools).toContain("coding");
  });

  it("does not have background-exec", () => {
    const config = JSON.parse(readFileSync(resolve(COACH_DIR, "agent.json"), "utf-8"));
    expect(config.tools).not.toContain("background-exec");
  });

  it("has knowledge/INDEX.md with team context", () => {
    const indexPath = resolve(COACH_DIR, "knowledge", "INDEX.md");
    expect(existsSync(indexPath)).toBe(true);
    const content = readFileSync(indexPath, "utf-8");
    expect(content).toContain("Team");
  });
});
