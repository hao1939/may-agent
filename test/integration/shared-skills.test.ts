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
    expect(content).toContain(".state/tasks/state.json");
    expect(content).toContain("generated read");
    expect(content).toContain("projection");
    expect(content).toContain("project.comment.created receipt");
    expect(content).toContain("infrastructure emits one correlated project.owner.reviewed");
    expect(content).not.toContain("`project.task.assigned`");
    expect(content).not.toContain("`project.task.completed`");
    expect(content).not.toContain("run_mode:");
  });

  it("control-plane-operation keeps agents on the event/app/workflow boundary", () => {
    const content = readSkill("shared/skills/control-plane-operation/SKILL.md");
    expect(content).toContain("project intent -> project.comment.created receipt -> owner result");
    expect(content).toContain("semantic event -> tasks.resolve -> stable task key");
    expect(content).toContain("event/timer -> handler -> workflow");
    expect(content).toContain("Discover a typed action -> validate -> direct semantic event receipt");
    expect(content).toContain("Do not add per-task handlers, assignment events, or a parallel");
    expect(content).toContain("docker exec may-agent may-agent --emit");
    expect(content).toContain("Do not add socket candidate scanning");
  });

  it("May's system skill encodes project intent, portable agents, and reconciler ownership", () => {
    const content = readSkill("agents/may/skills/may-agent-system/SKILL.md");
    expect(content).toContain(
      "project.comment.created receipt -> app owner judgment -> project.owner.reviewed -> optional durable task",
    );
    expect(content).toContain("The agent core does not import EventBus, SQLite, metrics, tasks, scheduling, or");
    expect(content).toContain("It does not edit task storage or emit `project.owner.reviewed`");
    expect(content).toContain("retain every unresolved input event reference");
    expect(content).toContain("return one semantic event receipt without wrapper");
    expect(content).toContain(".state/tasks/state.json");
  });

  it("investigation and dispatch guidance use canonical task resources", () => {
    const investigation = readSkill("shared/skills/system-investigation/SKILL.md");
    const dispatch = readSkill("shared/skills/dispatch-hygiene/SKILL.md");
    expect(investigation).toContain("canonical `.state/tasks/state.json`");
    expect(investigation).toContain("exactly one correlated `project.owner.reviewed`");
    expect(dispatch).toContain("completion");
    expect(dispatch).toContain("receipts, event trace, and queryable owner inbox");
    expect(dispatch).not.toContain("`project.task.assigned`");
  });

  it("always-loaded agent guidance does not recreate legacy project scheduling", () => {
    const mayAgents = readSkill("agents/may/AGENTS.md");
    const mayContext = readSkill("agents/may/context.md");
    const bobAgents = readSkill("projects/may-agent.app/agents/bob/AGENTS.md");
    expect(mayAgents).toContain("Repetition is not automatic permission to");
    expect(mayContext).toContain("project.comment.created receipt");
    expect(mayContext).toContain(".state/tasks/state.json");
    expect(mayContext).not.toContain("project.feedback.created");
    expect(bobAgents).not.toContain("persistent-task");
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
