import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const APP_ROOT = "/app";
const SHARED_SKILLS = resolve(APP_ROOT, "shared/skills");

function readSkill(path: string): string {
  const full = resolve(APP_ROOT, path);
  expect(existsSync(full), `${path} must exist`).toBe(true);
  return readFileSync(full, "utf-8");
}

function frontmatter(content: string): string {
  expect(content.startsWith("---")).toBe(true);
  const end = content.indexOf("---", 3);
  expect(end).toBeGreaterThan(3);
  return content.slice(3, end);
}

describe("shared system skills", () => {
  it("new system skills are valid SKILL.md files", () => {
    for (const path of [
      "shared/skills/project-loop-driver/SKILL.md",
      "shared/skills/control-plane-operation/SKILL.md",
    ]) {
      const content = readSkill(path);
      const fm = frontmatter(content);
      expect(fm).toContain("name:");
      expect(fm).toContain("description:");
      expect(fm).toContain("owner:");
      expect(fm).toContain("tools:");
      expect(content).toContain("## When to Apply");
      expect(content).toContain("## Core Rule");
      expect(content).toContain("## Anti-Patterns");
    }
  });

  it("project-loop-driver encodes the unified project mental model", () => {
    const content = readSkill("shared/skills/project-loop-driver/SKILL.md");
    expect(content).toContain("Intensive work");
    expect(content).toContain("Monitoring");
    expect(content).toContain("A project is not a ritual");
    expect(content).toContain("goal currently satisfied; monitoring continues");
    expect(content).not.toContain("run_mode:");
  });

  it("control-plane-operation keeps agents on the event/workflow boundary", () => {
    const content = readSkill("shared/skills/control-plane-operation/SKILL.md");
    expect(content).toContain("external input -> socket/control event -> daemon event -> handler -> workflow");
    expect(content).toContain("handler bridge -> workflow");
    expect(content).toContain("docker exec may-agent may-agent --emit");
    expect(content).toContain("Do not add socket candidate scanning");
  });

  it("reading-metrics treats metrics as signals and avoids schema guessing", () => {
    const content = readSkill("shared/skills/reading-metrics/skill.md");
    expect(content).toContain("A metric is a signal, not a judge");
    expect(content).toContain("Prefer injected/live context");
    expect(content).toContain("Do not guess DB");
    expect(content).not.toContain("metric is a judge");
    expect(content).not.toContain("metrics are the judge");
  });

  it("README current system skill paths exist", () => {
    const readme = readFileSync(resolve(SHARED_SKILLS, "README.md"), "utf-8");
    const matches = [...readme.matchAll(/`([^`]+\/(?:SKILL|skill)\.md)`/g)]
      .map((m) => m[1])
      .filter((p) => !p.includes("<name>"));
    expect(matches.length).toBeGreaterThanOrEqual(4);
    for (const relativePath of matches) {
      expect(existsSync(resolve(SHARED_SKILLS, relativePath)), `${relativePath} must exist`).toBe(true);
    }
  });
});
