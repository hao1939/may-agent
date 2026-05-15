import { describe, it, expect } from "vitest";
import {
  updateField,
  appendComment,
  diagnoseProject,
  newProjectHealthEntry,
  readHealthState,
  simpleHash,
  generateRunId,
  MAX_LAUNCHES_PER_TICK,
  type ProjectInfo,
  type HealthState,
  type HealthAction,
} from "../shared/lib/project-health.js";

// ── updateField ──────────────────────────────────────────────────────

describe("updateField", () => {
  it("replaces an existing field value", () => {
    const md = "# Project\n**Status**: active\n**Owner**: bob";
    const result = updateField(md, "Status", "blocked");
    expect(result).toContain("status: blocked");
    expect(result).toContain("# Project");
  });

  it("adds field after first line if not present", () => {
    const md = "# Project\nSome text";
    const result = updateField(md, "Status", "active");
    const lines = result.split("\n");
    expect(lines[1]).toBe("status: active");
  });
});

// ── appendComment ────────────────────────────────────────────────────

describe("appendComment", () => {
  it("appends to existing Comments section", () => {
    const md = "# Proj\n## Comments\n- old comment\n";
    const result = appendComment(md, "new comment");
    expect(result).toMatch(/\[.*\] new comment/);
    expect(result).toContain("- old comment");
  });

  it("creates Comments section if missing", () => {
    const md = "# Proj\nBody text";
    const result = appendComment(md, "first comment");
    expect(result).toContain("## Comments");
    expect(result).toMatch(/\[.*\] first comment/);
  });
});

// ── simpleHash ───────────────────────────────────────────────────────

describe("simpleHash", () => {
  it("returns empty string for empty input", () => {
    expect(simpleHash("")).toBe("");
  });

  it("returns 8-char hex for non-empty input", () => {
    const h = simpleHash("hello");
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is deterministic", () => {
    expect(simpleHash("test")).toBe(simpleHash("test"));
  });

  it("differs for different inputs", () => {
    expect(simpleHash("a")).not.toBe(simpleHash("b"));
  });
});

// ── generateRunId ────────────────────────────────────────────────────

describe("generateRunId", () => {
  it("returns a hex string", () => {
    expect(generateRunId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it("generates unique IDs", () => {
    expect(generateRunId()).not.toBe(generateRunId());
  });
});

// ── newProjectHealthEntry ────────────────────────────────────────────

describe("newProjectHealthEntry", () => {
  it("returns zeroed entry", () => {
    const e = newProjectHealthEntry();
    expect(e.blockerHash).toBe("");
    expect(e.consecutiveSkips).toBe(0);
    expect(e.reactivationAttempts).toBe(0);
  });
});

// ── readHealthState ──────────────────────────────────────────────────

describe("readHealthState", () => {
  it("returns default state for nonexistent file", () => {
    const state = readHealthState("/nonexistent/path.json");
    expect(state.lastFullScan).toBe(0);
    expect(state.projects).toEqual({});
  });
});

// ── readInflight / writeInflight ─────────────────────────────────────

import { readInflight, writeInflight, writeHealthState } from "../shared/lib/project-health.js";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";

describe("readInflight", () => {
  it("returns empty set for nonexistent file", () => {
    const s = readInflight("/nonexistent/inflight.txt");
    expect(s.size).toBe(0);
  });

  it("reads lines from file", () => {
    const tmp = "/tmp/test-inflight-" + Date.now() + ".txt";
    writeFileSync(tmp, "proj-a\nproj-b\n");
    const s = readInflight(tmp);
    expect(s.has("proj-a")).toBe(true);
    expect(s.has("proj-b")).toBe(true);
    expect(s.size).toBe(2);
    rmSync(tmp);
  });
});

describe("writeInflight", () => {
  it("writes set to file", () => {
    const tmp = "/tmp/test-inflight-w-" + Date.now() + ".txt";
    writeInflight(tmp, new Set(["a", "b"]));
    const content = readFileSync(tmp, "utf-8");
    expect(content).toContain("a");
    expect(content).toContain("b");
    rmSync(tmp);
  });
});

describe("writeHealthState", () => {
  it("writes state as JSON", () => {
    const dir = "/tmp/test-health-" + Date.now();
    const file = join(dir, "state.json");
    writeHealthState(file, { lastFullScan: 123, projects: {} });
    const raw = readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.lastFullScan).toBe(123);
    rmSync(dir, { recursive: true });
  });
});

// ── MAX_LAUNCHES_PER_TICK ────────────────────────────────────────────

describe("MAX_LAUNCHES_PER_TICK", () => {
  it("is a positive number", () => {
    expect(MAX_LAUNCHES_PER_TICK).toBeGreaterThan(0);
  });
});

// ── diagnoseProject ──────────────────────────────────────────────────

function makeProject(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
  return {
    relPath: "projects/test-proj",
    projectFile: "/tmp/fake/project.md",
    content: "# Test\n**Status**: active",
    status: "active",
    owner: "worker",
    blockerReason: "",
    workflow: "master-worker",
    ...overrides,
  };
}

function makeHealthState(overrides: Partial<HealthState> = {}): HealthState {
  return { lastFullScan: 0, projects: {}, ...overrides };
}

describe("diagnoseProject", () => {
  const now = Date.now();

  it("returns skip for closed projects", () => {
    const p = makeProject({ status: "closed" });
    const action = diagnoseProject(p, makeHealthState(), new Set(), new Set(), now, []);
    expect(action.type).toBe("skip");
    expect(action.reason).toContain("closed");
  });

  it("returns launch-workflow for active project with no running session", () => {
    const p = makeProject({ status: "active" });
    const action = diagnoseProject(p, makeHealthState(), new Set(), new Set(), now, []);
    expect(action.type).toBe("launch-workflow");
  });

  it("returns skip for active project in cooldown", () => {
    const p = makeProject({ status: "active" });
    const state = makeHealthState({
      projects: {
        "projects/test-proj": {
          ...newProjectHealthEntry(),
          lastLaunch: now - 30_000, // 30s ago, within 60s cooldown
        },
      },
    });
    const action = diagnoseProject(p, state, new Set(), new Set(), now, []);
    expect(action.type).toBe("skip");
    expect(action.reason).toContain("cooldown");
  });

  it("escalates waiting projects after 2+ hours", () => {
    const p = makeProject({ status: "waiting" });
    const state = makeHealthState({
      projects: {
        "projects/test-proj": {
          ...newProjectHealthEntry(),
          lastStatusChange: now - 3 * 60 * 60 * 1000, // 3 hours ago
        },
      },
    });
    const action = diagnoseProject(p, state, new Set(), new Set(), now, []);
    expect(action.type).toBe("escalate");
  });

  it("skips waiting projects under 2 hours", () => {
    const p = makeProject({ status: "waiting" });
    const state = makeHealthState({
      projects: {
        "projects/test-proj": {
          ...newProjectHealthEntry(),
          lastStatusChange: now - 30 * 60 * 1000, // 30 min ago
        },
      },
    });
    const action = diagnoseProject(p, state, new Set(), new Set(), now, []);
    expect(action.type).toBe("skip");
  });

  it("treats 'done' status as waiting", () => {
    const p = makeProject({ status: "done" });
    const state = makeHealthState({
      projects: {
        "projects/test-proj": {
          ...newProjectHealthEntry(),
          lastStatusChange: now - 5 * 60 * 1000,
        },
      },
    });
    const action = diagnoseProject(p, state, new Set(), new Set(), now, []);
    // "done" → "waiting", within 2h → skip
    expect(action.type).toBe("skip");
  });

  it("escalates after 24+ hours", () => {
    const p = makeProject({ status: "blocked" });
    const state = makeHealthState({
      projects: {
        "projects/test-proj": {
          ...newProjectHealthEntry(),
          lastStatusChange: now - 25 * 60 * 60 * 1000,
        },
      },
    });
    const action = diagnoseProject(p, state, new Set(), new Set(), now, []);
    expect(action.type).toBe("escalate");
    expect(action.reason).toContain("needs human attention");
  });
});
