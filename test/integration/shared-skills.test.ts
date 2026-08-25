import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Production uses /app. An explicit root keeps this cross-repository contract
// test authoritative while either side is being reviewed in an isolated
// worktree.
const APP_ROOT = resolve(process.env.MAY_AGENT_APP_ROOT ?? "/app");
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
      expect(fm).not.toContain("owner:");
      expect(fm).not.toContain("tools:");
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
    expect(content).toContain("move to monitoring when the goal is currently satisfied");
    expect(content).toMatch(/Task persistence is host-private and\s+reconciler-owned/);
    expect(content).not.toContain("`.state/tasks/state.json`");
    expect(content).toContain("generated read");
    expect(content).toContain("projection");
    expect(content).toContain("project.comment.created receipt");
    expect(content).toContain("declared App subscription admits one correlated App inbox request");
    expect(content).toContain("dependency completion wakes the same request");
    expect(content).not.toContain("project.owner.reviewed");
    expect(content).not.toContain("`project.task.assigned`");
    expect(content).not.toContain("`project.task.completed`");
    expect(content).not.toContain("run_mode:");
  });

  it("control-plane-operation keeps agents on the event/app/workflow boundary", () => {
    const content = readSkill("shared/skills/control-plane-operation/SKILL.md");
    expect(content).toContain("project comment fact -> declared App subscription -> correlated App inbox request");
    expect(content).toContain("system fact -> task subscription, exact task wake, App subscription, or observation");
    expect(content).toContain("runtime fact -> internal handler -> bounded maintenance operation");
    expect(content).toContain("Discover a typed App action -> validate -> App input admission");
    expect(content).toContain("Do not add per-task handlers, assignment events, or another request queue");
    expect(content).toContain("docker exec may-agent may-agent --emit");
    expect(content).toContain("Do not add socket candidate scanning");
  });

  it("May's system skill encodes project intent, portable executors, and App ownership", () => {
    const content = readSkill("agents/may/skills/may-agent-system/SKILL.md");
    expect(content).toContain("project.comment.created event -> declared App route -> App Task -> accepted result");
    expect(content).toContain("The agent core does not import EventBus, SQLite, metrics, tasks, scheduling, or");
    expect(content).toContain("`app.dependency.completed` wakes the exact parent Task");
    expect(content).toMatch(/every\s+addressed request keeps its own identity and result/);
    expect(content).toContain("return one semantic event receipt without wrapper");
    expect(content).toMatch(/Task persistence is host-private and\s+reconciler-owned/);
    expect(content).not.toContain("`.state/tasks/state.json`");
  });

  it("investigation and dispatch guidance respect host-owned task resources", () => {
    const investigation = readSkill("shared/skills/system-investigation/SKILL.md");
    const dispatch = readSkill("shared/skills/dispatch-hygiene/SKILL.md");
    expect(investigation).toMatch(/Task persistence is host-private and\s+reconciler-owned/i);
    expect(investigation).not.toContain("`.state/tasks/state.json`");
    expect(investigation).toContain("exactly one correlated");
    expect(investigation).toContain("`app.dependency.completed` wake the exact");
    expect(investigation).not.toContain("project.owner.reviewed");
    expect(dispatch).toContain("completion");
    expect(dispatch).toContain("receipts, event trace, and durable App inbox");
    expect(dispatch).not.toContain("`project.task.assigned`");
  });

  it("always-loaded agent guidance does not recreate legacy project scheduling", () => {
    const mayAgents = readSkill("agents/may/AGENTS.md");
    const mayContext = readSkill("agents/may/context.md");
    expect(mayAgents).toContain("Apps own durable work");
    expect(mayContext).toContain("May request remembers who is owed an answer");
    expect(mayContext).toContain("responsible App Task(s)");
    expect(mayContext).not.toContain("May Task");
    expect(mayContext).not.toContain("project.feedback.created");
    expect(mayAgents).not.toContain("persistent-task");
    expect(mayAgents).not.toContain("project.task.assigned");
  });

  it("reading-metrics treats metrics as signals and avoids schema guessing", () => {
    const content = readSkill("shared/skills/reading-metrics/SKILL.md");
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
