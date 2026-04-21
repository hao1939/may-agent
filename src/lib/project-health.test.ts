/**
 * Tests for agents/src/lib/project-health.ts
 *
 * Run: bun test agents/src/lib/project-health.test.ts
 */
import { describe, it, expect, beforeEach } from "bun:test";
import {
  type ProjectInfo, type HealthState,
  diagnoseProject, newProjectHealthEntry,
  extractSection, extractMilestones, simpleHash,
  updateField, appendComment,
  LAUNCH_COOLDOWN_MS, ESCALATION_COOLDOWN_MS, STALE_BLOCKER_MS,
  MAX_REACTIVATION_ATTEMPTS,
} from "./project-health.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
  return {
    relPath: "agents/test/workspace/projects/test-project",
    projectFile: "/tmp/test-project/project.md",
    owner: "test-agent",
    status: "active",
    mtime: Date.now(),
    content: "**Status**: active\n**Owner**: test-agent\n\n## Goal\nTest goal\n\n## Milestones\n- [ ] M1\n\n## Current State\nWorking.\n\n## Comments\n",
    blockerReason: "",
    health: "",
    iteration: 1,
    milestonesDone: 0,
    milestonesTotal: 1,
    metrics: [],
    lastUpdatedAgo: 1000,
    ...overrides,
  };
}

function makeHealthState(projectOverrides: Record<string, Partial<ReturnType<typeof newProjectHealthEntry>>> = {}): HealthState {
  const state: HealthState = { projects: {}, lastFullScan: 0 };
  for (const [key, val] of Object.entries(projectOverrides)) {
    state.projects[key] = { ...newProjectHealthEntry(), ...val };
  }
  return state;
}

const NOW = Date.now();
const EMPTY_SET = new Set<string>();

// ── extractSection ─────────────────────────────────────────────────────

describe("extractSection", () => {
  it("extracts section content", () => {
    const content = "## Goal\nBuild something\n\n## Milestones\n- [ ] M1\n";
    expect(extractSection(content, "Goal")).toBe("Build something");
  });

  it("returns empty for missing section", () => {
    expect(extractSection("## Goal\nStuff\n", "Missing")).toBe("");
  });
});

// ── extractMilestones ──────────────────────────────────────────────────

describe("extractMilestones", () => {
  it("parses checked and unchecked milestones", () => {
    const content = "## Milestones\n- [x] Done one\n- [ ] Pending one\n- [x] Done two\n\n## Other\n";
    const ms = extractMilestones(content);
    expect(ms.total).toBe(3);
    expect(ms.done).toBe(2);
    expect(ms.pending).toEqual(["Pending one"]);
  });

  it("handles no milestones section", () => {
    const ms = extractMilestones("## Goal\nStuff\n");
    expect(ms.total).toBe(0);
    expect(ms.done).toBe(0);
  });
});

// ── updateField ────────────────────────────────────────────────────────

describe("updateField", () => {
  it("updates existing field", () => {
    const result = updateField("**Status**: active\n**Owner**: bob\n", "Status", "blocked");
    expect(result).toContain("**Status**: blocked");
    expect(result).toContain("**Owner**: bob");
  });

  it("inserts field before first section if missing", () => {
    const result = updateField("## Goal\nStuff\n", "Status", "active");
    expect(result).toContain("**Status**: active");
    expect(result.indexOf("**Status**")).toBeLessThan(result.indexOf("## Goal"));
  });
});

// ── appendComment ──────────────────────────────────────────────────────

describe("appendComment", () => {
  it("appends to existing Comments section", () => {
    const content = "## Comments\nOld comment\n";
    const result = appendComment(content, "New comment");
    expect(result).toContain("Old comment");
    expect(result).toContain("health-monitor] New comment");
  });

  it("creates Comments section if missing", () => {
    const result = appendComment("## Goal\nStuff\n", "First comment");
    expect(result).toContain("## Comments");
    expect(result).toContain("health-monitor] First comment");
  });
});

// ── simpleHash ─────────────────────────────────────────────────────────

describe("simpleHash", () => {
  it("returns consistent hash", () => {
    expect(simpleHash("test")).toBe(simpleHash("test"));
  });

  it("returns different hash for different input", () => {
    expect(simpleHash("test")).not.toBe(simpleHash("other"));
  });
});

// ── diagnoseProject ────────────────────────────────────────────────────

describe("diagnoseProject", () => {
  it("launches workflow for active projects", () => {
    const project = makeProject({ status: "active" });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("launch-workflow");
  });

  it("skips done projects without comments", () => {
    const project = makeProject({ status: "done", content: "**Status**: done\n\n## Comments\n" });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("skip");
  });

  it("launches workflow for done projects WITH comments", () => {
    const project = makeProject({ status: "done", content: "**Status**: done\n\n## Comments\nPlease review\n" });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("launch-workflow");
  });

  it("skips inflight projects", () => {
    const project = makeProject({ status: "active" });
    const inflight = new Set([project.relPath]);
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, inflight, NOW);
    expect(action.type).toBe("skip");
    expect(action.reason).toContain("in-flight");
  });

  it("skips during launch cooldown", () => {
    const project = makeProject({ status: "active" });
    const state = makeHealthState({ [project.relPath]: { lastLaunch: NOW - 1000 } });
    const action = diagnoseProject(project, state, EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("skip");
    expect(action.reason).toContain("cooldown");
  });

  it("skips if owner is busy", () => {
    const project = makeProject({ status: "active", owner: "bob" });
    const running = new Set(["bob"]);
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, running, EMPTY_SET, NOW);
    expect(action.type).toBe("skip");
    expect(action.reason).toContain("busy");
  });

  // Blocked project strategies
  it("reactivates blocked project when metric breached", () => {
    const project = makeProject({ status: "blocked", metrics: ["system.health"] });
    const breached = new Set(["system.health"]);
    const action = diagnoseProject(project, makeHealthState(), breached, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("reactivate");
  });

  it("adds comment for false-done loop", () => {
    const project = makeProject({ status: "blocked", blockerReason: "false-done loop detected" });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("add-comment");
    expect(action.reason).toContain("False-done");
  });

  it("escalates false-done after max attempts", () => {
    const project = makeProject({ status: "blocked", blockerReason: "false-done loop detected" });
    const state = makeHealthState({ [project.relPath]: { reactivationAttempts: MAX_REACTIVATION_ATTEMPTS } });
    const action = diagnoseProject(project, state, EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("escalate");
  });

  it("adds comment for stuck iterations", () => {
    const project = makeProject({ status: "blocked", blockerReason: "5 iterations without milestone progress" });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("add-comment");
    expect(action.reason).toContain("Stall");
  });

  it("retries worker failure after stale period", () => {
    const project = makeProject({ status: "blocked", blockerReason: "Worker failed 2 times", lastUpdatedAgo: STALE_BLOCKER_MS + 1000 });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("add-comment");
    expect(action.reason).toContain("Worker failure");
  });

  it("skips recent worker failure", () => {
    const project = makeProject({ status: "blocked", blockerReason: "Worker failed", lastUpdatedAgo: 1000 });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("skip");
  });

  it("re-evaluates stale blockers", () => {
    const project = makeProject({ status: "blocked", blockerReason: "Some blocker", lastUpdatedAgo: STALE_BLOCKER_MS + 1000 });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("add-comment");
    expect(action.reason).toContain("Stale blocker");
  });

  it("escalates persistent blockers after max attempts", () => {
    const project = makeProject({ status: "blocked", blockerReason: "Some unique blocker" });
    const state = makeHealthState({ [project.relPath]: { reactivationAttempts: MAX_REACTIVATION_ATTEMPTS, lastEscalation: 0 } });
    const action = diagnoseProject(project, state, EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("escalate");
  });

  it("respects escalation cooldown", () => {
    const project = makeProject({ status: "blocked", blockerReason: "Some unique blocker" });
    const state = makeHealthState({ [project.relPath]: { reactivationAttempts: MAX_REACTIVATION_ATTEMPTS, lastEscalation: NOW - 1000 } });
    const action = diagnoseProject(project, state, EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("skip");
  });

  // Paused projects
  it("skips paused projects without triggers", () => {
    const project = makeProject({ status: "paused" });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("skip");
  });

  it("reactivates paused project on metric breach", () => {
    const project = makeProject({ status: "paused", metrics: ["system.health"] });
    const breached = new Set(["system.health"]);
    const action = diagnoseProject(project, makeHealthState(), breached, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("reactivate");
  });

  it("launches workflow for paused project with comments", () => {
    const project = makeProject({ status: "paused", content: "**Status**: paused\n\n## Comments\nPlease resume\n" });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("launch-workflow");
  });
});
