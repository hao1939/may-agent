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
  parsePauseConditions, classifyCondition, evaluatePauseConditions,
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
    pauseConditions: [],
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

  it("skips paused project with regular comments (no resume trigger)", () => {
    const project = makeProject({ status: "paused", content: "**Status**: paused\n\n## Comments\nPlease resume\n" });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("skip");
  });
});

// ── parsePauseConditions ───────────────────────────────────────────────

describe("parsePauseConditions", () => {
  it("parses time-based resume condition", () => {
    const content = "## Comments\n[2026-04-20 hao] Paused. Resume condition: after 2-3 days of heartbeat cycles\n";
    const conditions = parsePauseConditions(content);
    expect(conditions.length).toBeGreaterThanOrEqual(1);
    expect(conditions[0].type).toBe("time-elapsed");
    expect(conditions[0].evaluable).toBe(true);
    expect(conditions[0].waitMs).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it("parses evidence-needed condition", () => {
    const content = "## Comments\n[2026-04-20 hao] Paused. Resume condition: check actual heartbeat behavior and compare before/after\n";
    const conditions = parsePauseConditions(content);
    expect(conditions.length).toBeGreaterThanOrEqual(1);
    expect(conditions[0].type).toBe("evidence-needed");
    expect(conditions[0].evaluable).toBe(false);
  });

  it("returns empty for no conditions", () => {
    const content = "## Comments\nJust a regular comment\n";
    const conditions = parsePauseConditions(content);
    expect(conditions.length).toBe(0);
  });
});

// ── classifyCondition ──────────────────────────────────────────────────

describe("classifyCondition", () => {
  it("classifies time-based", () => {
    expect(classifyCondition("after 3 days").type).toBe("time-elapsed");
    expect(classifyCondition("wait 24h").type).toBe("time-elapsed");
  });

  it("classifies metric breach", () => {
    expect(classifyCondition("observe a REAL metric breach").type).toBe("metric-breach");
  });

  it("classifies dependency", () => {
    expect(classifyCondition("after foo-project completes").type).toBe("dependency");
  });

  it("classifies evidence-needed", () => {
    expect(classifyCondition("check if agents are more proactive").type).toBe("evidence-needed");
    expect(classifyCondition("measure HPR improvement").type).toBe("evidence-needed");
  });

  it("classifies unknown", () => {
    expect(classifyCondition("something vague happens").type).toBe("unknown");
  });
});

// ── evaluatePauseConditions ────────────────────────────────────────────

describe("evaluatePauseConditions", () => {
  it("marks time condition as met when enough time passed", () => {
    const cond = [{ type: "time-elapsed" as const, raw: "after 2 days", evaluable: true, waitMs: 2 * 24 * 3600000 }];
    const project = makeProject({ lastUpdatedAgo: 3 * 24 * 3600000 });
    const result = evaluatePauseConditions(cond, project, EMPTY_SET, [], NOW);
    expect(result.allMet).toBe(true);
    expect(result.metReasons.length).toBe(1);
  });

  it("marks time condition as pending when not enough time", () => {
    const cond = [{ type: "time-elapsed" as const, raw: "after 2 days", evaluable: true, waitMs: 2 * 24 * 3600000 }];
    const project = makeProject({ lastUpdatedAgo: 1 * 24 * 3600000 });
    const result = evaluatePauseConditions(cond, project, EMPTY_SET, [], NOW);
    expect(result.allMet).toBe(false);
    expect(result.pendingReasons.length).toBe(1);
  });

  it("marks dependency as met when dep project is done", () => {
    const cond = [{ type: "dependency" as const, raw: "after foo completes", evaluable: true, dependsOn: "foo" }];
    const project = makeProject();
    const depProject = makeProject({ relPath: "agents/bob/workspace/projects/foo", status: "done" });
    const result = evaluatePauseConditions(cond, project, EMPTY_SET, [depProject], NOW);
    expect(result.allMet).toBe(true);
  });

  it("reports unevaluable conditions", () => {
    const cond = [{ type: "evidence-needed" as const, raw: "check heartbeat behavior", evaluable: false }];
    const project = makeProject();
    const result = evaluatePauseConditions(cond, project, EMPTY_SET, [], NOW);
    expect(result.allMet).toBe(false);
    expect(result.unevaluable.length).toBe(1);
  });

  it("handles mixed evaluable and unevaluable", () => {
    const cond = [
      { type: "time-elapsed" as const, raw: "after 2 days", evaluable: true, waitMs: 2 * 24 * 3600000 },
      { type: "evidence-needed" as const, raw: "check behavior", evaluable: false },
    ];
    const project = makeProject({ lastUpdatedAgo: 3 * 24 * 3600000 });
    const result = evaluatePauseConditions(cond, project, EMPTY_SET, [], NOW);
    expect(result.allMet).toBe(false); // unevaluable blocks allMet
    expect(result.metReasons.length).toBe(1);
    expect(result.unevaluable.length).toBe(1);
  });
});

// ── diagnoseProject paused with conditions ─────────────────────────────

describe("diagnoseProject — paused health monitor", () => {
  it("reactivates when time-based condition is met", () => {
    const project = makeProject({
      status: "paused",
      lastUpdatedAgo: 3 * 24 * 3600000,
      pauseConditions: [{ type: "time-elapsed", raw: "after 2 days", evaluable: true, waitMs: 2 * 24 * 3600000 }],
    });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("reactivate");
  });

  it("skips when time condition not yet met", () => {
    const project = makeProject({
      status: "paused",
      lastUpdatedAgo: 1 * 24 * 3600000,
      pauseConditions: [{ type: "time-elapsed", raw: "after 2 days", evaluable: true, waitMs: 2 * 24 * 3600000 }],
    });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("skip");
    expect(action.reason).toContain("not yet met");
  });

  it("launches workflow when partial conditions met + evidence needed", () => {
    const project = makeProject({
      status: "paused",
      lastUpdatedAgo: 3 * 24 * 3600000,
      pauseConditions: [
        { type: "time-elapsed", raw: "after 2 days", evaluable: true, waitMs: 2 * 24 * 3600000 },
        { type: "evidence-needed", raw: "check heartbeat behavior", evaluable: false },
      ],
    });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("launch-workflow");
  });

  it("comments on stale pause with no conditions", () => {
    const project = makeProject({
      status: "paused",
      lastUpdatedAgo: 49 * 3600000, // 49h > 48h threshold
      pauseConditions: [],
    });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("add-comment");
    expect(action.reason).toContain("Stale pause");
  });

  it("escalates very stale pause after comment attempt", () => {
    const project = makeProject({
      status: "paused",
      lastUpdatedAgo: 8 * 24 * 3600000, // 8 days
      pauseConditions: [],
    });
    const state = makeHealthState({ [project.relPath]: { reactivationAttempts: 1, lastEscalation: 0 } });
    const action = diagnoseProject(project, state, EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW);
    expect(action.type).toBe("escalate");
  });

  it("reactivates on dependency completion", () => {
    const dep = makeProject({ relPath: "agents/bob/workspace/projects/dep-project", status: "done" });
    const project = makeProject({
      status: "paused",
      pauseConditions: [{ type: "dependency", raw: "after dep-project completes", evaluable: true, dependsOn: "dep-project" }],
    });
    const action = diagnoseProject(project, makeHealthState(), EMPTY_SET, EMPTY_SET, EMPTY_SET, NOW, [dep, project]);
    expect(action.type).toBe("reactivate");
  });
});
