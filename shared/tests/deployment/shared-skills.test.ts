import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prepareAgentExecution } from "../../../projects/may-agent/src/lib/agent-execution.js";
import type { SubagentDefinition } from "../../../projects/may-agent/src/lib/types.js";

import { APP_ROOT } from "./installation.js";
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

  it("loads current owner guidance and the canonical manual from their migrated paths", () => {
    const may = readSkill("projects/may.app/agents/may/skills/may-agent-system/SKILL.md");
    expect(may).toContain("The agent core does not import EventBus, SQLite, metrics, tasks, scheduling, or");
    expect(may).toContain("projects/alex.app/docs/2a-design/system-model.md");
    for (const guide of ["design-authoring", "task-execution-guide"]) {
      expect(frontmatter(readSkill(`projects/alex.app/docs/2b-manual/${guide}/SKILL.md`))).toContain(`name: ${guide}`);
    }
    for (const [name, agentDir] of [["may", "projects/may.app/agents/may"], ["alex", "projects/alex.app/agents/alex"]]) {
      const identity = readSkill(`${agentDir}/AGENTS.md`);
      const prepared = prepareAgentExecution({
        sessionId: `role-context-${name}`, projectRoot: APP_ROOT, task: "Inspect the supplied facts",
        definition: { name, description: "No model call", agentDir: resolve(APP_ROOT, agentDir),
          sharedRoot: resolve(APP_ROOT, "shared"), tools: [], model: { id: "fixture", contextWindow: 128_000 } as SubagentDefinition["model"] },
      });
      expect(prepared.systemPrompt).toContain(identity.trim());
    }
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
