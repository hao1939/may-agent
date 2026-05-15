import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  scanAllProjects,
  diagnoseProject,
  newProjectHealthEntry,
  readHealthState,
  writeHealthState,
  readInflight,
  writeInflight,
  generateRunId,
  saveWorkflowRunFile,
  simpleHash,
  updateField,
  appendComment,
  upsertProject,
  type ProjectInfo,
  type HealthState,
  type ProjectHealthEntry,
} from "../lib/project-health.ts";

// NOTE: These tests run under Bun's test runner (not Vitest runtime).
// `vi.importActual` is not available, and we don't need to mock `node:fs` here
// because tests use a real temporary directory.

describe("scanAllProjects - filesystem traversal", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join("/tmp", `test-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when agentsRoot does not exist", () => {
    const result = scanAllProjects("/nonexistent/path/xyz123");
    expect(result).toEqual([]);
  });

  it("returns empty when no projects directory exists", () => {
    fs.mkdirSync(path.join(tmpDir, "agent1"), { recursive: true });
    const result = scanAllProjects(tmpDir);
    expect(result).toEqual([]);
  });

  it("skips directories without project.md", () => {
    const projDir = path.join(tmpDir, "projects", "my-proj");
    fs.mkdirSync(projDir, { recursive: true });
    // No project.md file
    const result = scanAllProjects(tmpDir);
    expect(result).toEqual([]);
  });

  it("scans projects with project.md", () => {
    const projDir = path.join(tmpDir, "projects", "my-proj");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(
      path.join(projDir, "project.md"),
      "---\nid: my-proj\nowner: agent1\nstatus: active\nworkflow: project\n---\n\n# Project\n"
    );
    const result = scanAllProjects(tmpDir);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe("active");
    expect(result[0].owner).toBe("agent1");
    expect(result[0].workflow).toBe("project");
  });

  it("defaults projects without workflow metadata to the project workflow", () => {
    const projDir = path.join(tmpDir, "projects", "default-workflow");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(
      path.join(projDir, "project.md"),
      "---\nid: default-workflow\nowner: agent1\nstatus: active\n---\n\n# Project\n"
    );

    const result = scanAllProjects(tmpDir);
    expect(result.length).toBe(1);
    expect(result[0].workflow).toBe("project");
  });

  it("defaults status to active when missing", () => {
    const projDir = path.join(tmpDir, "projects", "proj2");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "project.md"), "# Project\nSome content\n");
    const result = scanAllProjects(tmpDir);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe("active");
  });

  it("skips _archive directory under projects", () => {
    const archDir = path.join(tmpDir, "projects", "_archive", "old");
    fs.mkdirSync(archDir, { recursive: true });
    fs.writeFileSync(path.join(archDir, "project.md"), "---\nid: old\nowner: may\nstatus: active\n---\n\n# Old\n");
    const result = scanAllProjects(tmpDir);
    expect(result).toEqual([]);
  });

  it("ignores legacy per-agent workspace/projects directories", () => {
    // Legacy location should no longer be scanned (KE-426 follow-up).
    const projDir = path.join(tmpDir, "alice", "workspace", "projects", "legacy");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "project.md"), "---\nid: legacy\nowner: alice\nstatus: active\n---\n\n# L\n");
    const result = scanAllProjects(tmpDir);
    expect(result).toEqual([]);
  });

  it("handles multiple projects", () => {
    for (const proj of ["proj1", "proj2", "proj3", "proj4"]) {
      const projDir = path.join(tmpDir, "projects", proj);
      fs.mkdirSync(projDir, { recursive: true });
      fs.writeFileSync(path.join(projDir, "project.md"), `---\nid: ${proj}\nowner: alice\nstatus: active\n---\n\n# ${proj}\n`);
    }
    const result = scanAllProjects(tmpDir);
    expect(result.length).toBe(4);
  });
});

describe("diagnoseProject - uncovered branches", () => {
  const now = Date.now();
  const emptyState: HealthState = { projects: {} };
  const emptyBreached = new Set<string>();
  const emptyRunning = new Set<string>();

  function makeProject(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
    return {
      relPath: "projects/test-proj",
      projectFile: "/tmp/nonexistent/project.md",
      content: "# Test\n**Status**: active\n",
      status: "active",
      owner: "agent1",
      blockerReason: "",
      workflow: "master-worker",
      ...overrides,
    };
  }

  it("returns skip for unknown status", () => {
    const proj = makeProject({ status: "unknown-status" });
    const result = diagnoseProject(proj, emptyState, emptyBreached, emptyRunning, now, []);
    expect(result.type).toBe("skip");
  });

  it("returns launch-workflow for active project not running", () => {
    const proj = makeProject({ status: "active" });
    const result = diagnoseProject(proj, emptyState, emptyBreached, emptyRunning, now, []);
    expect(result.type).toBe("launch-workflow");
    expect(result.reason).toContain("active project needs work");
  });

  it("returns skip for active project with live session", () => {
    const proj = makeProject({ status: "active" });
    const running = new Set(["agent1/test-proj"]);
    const result = diagnoseProject(proj, emptyState, emptyBreached, running, now, []);
    expect(result.type).toBe("skip");
    expect(result.reason).toContain("live session");
  });

  it("returns skip for active project in cooldown", () => {
    const proj = makeProject({ status: "active" });
    const state: HealthState = {
      projects: {
        "projects/test-proj": {
          ...newProjectHealthEntry(),
          lastLaunch: now - 30_000, // 30 sec ago, within 60s cooldown
        },
      },
    };
    const result = diagnoseProject(proj, state, emptyBreached, emptyRunning, now, []);
    expect(result.type).toBe("skip");
    expect(result.reason).toContain("cooldown");
  });

  it("returns skip for closed project without unread comments", () => {
    const proj = makeProject({ status: "closed" });
    const result = diagnoseProject(proj, emptyState, emptyBreached, emptyRunning, now, []);
    expect(result.type).toBe("skip");
    expect(result.reason).toContain("closed by human");
  });

  it("treats 'done' as terminal status", () => {
    const proj = makeProject({ status: "done" });
    const result = diagnoseProject(proj, emptyState, emptyBreached, emptyRunning, now, []);
    expect(result.type).toBe("skip");
    expect(result.reason).toContain("terminal status");
  });

  it("treats 'complete' as terminal status", () => {
    const proj = makeProject({ status: "complete" });
    const result = diagnoseProject(proj, emptyState, emptyBreached, emptyRunning, now, []);
    expect(result.type).toBe("skip");
  });

  it("treats 'completed' as terminal status", () => {
    const proj = makeProject({ status: "completed" });
    const result = diagnoseProject(proj, emptyState, emptyBreached, emptyRunning, now, []);
    expect(result.type).toBe("skip");
  });

  it("escalates blocked project after 2 hours", () => {
    const proj = makeProject({ status: "blocked" });
    const state: HealthState = {
      projects: {
        "projects/test-proj": {
          ...newProjectHealthEntry(),
          lastLaunch: now - 3 * 60 * 60 * 1000, // 3 hours ago
        },
      },
    };
    const result = diagnoseProject(proj, state, emptyBreached, emptyRunning, now, []);
    expect(result.type).toBe("escalate");
  });

  it("escalates waiting project after 24 hours", () => {
    const proj = makeProject({ status: "waiting" });
    const state: HealthState = {
      projects: {
        "projects/test-proj": {
          ...newProjectHealthEntry(),
          lastLaunch: now - 25 * 60 * 60 * 1000, // 25 hours ago
        },
      },
    };
    const result = diagnoseProject(proj, state, emptyBreached, emptyRunning, now, []);
    expect(result.type).toBe("escalate");
    expect(result.reason).toContain("25h");
  });

  it("launches for waiting project with pending comments in project.md", () => {
    const proj = makeProject({
      status: "waiting",
      content: "# Project\n**Status**: waiting\n\n## Comments\n\nHuman says: please fix this\n",
    });
    const result = diagnoseProject(proj, emptyState, emptyBreached, emptyRunning, now, []);
    expect(result.type).toBe("launch-workflow");
    expect(result.reason).toContain("unread comments");
  });

  it("launches for pending-review project with unread discussion.md", () => {
    const tmpDir = `/tmp/test-pending-review-${Date.now()}`;
    const projDir = path.join(tmpDir, "proj");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "project.md"), "---\nid: proj\nowner: scout\nstatus: pending-review\n---\n\n# Project\n");
    fs.writeFileSync(path.join(projDir, "discussion.md"), "# Discussion\n\n### hao - 2026-05-08\nPlease revise the plan.\n");

    const proj = makeProject({
      relPath: "projects/proj",
      projectFile: path.join(projDir, "project.md"),
      status: "pending-review",
      owner: "scout",
      content: fs.readFileSync(path.join(projDir, "project.md"), "utf-8"),
    });
    const result = diagnoseProject(proj, emptyState, emptyBreached, emptyRunning, now, []);
    expect(result.type).toBe("launch-workflow");
    expect(result.reason).toContain("pending-review");
    expect(result.reason).toContain("unread comments");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("bypasses cooldown for forced unread-comment launch", () => {
    const tmpDir = `/tmp/test-forced-comment-${Date.now()}`;
    const projDir = path.join(tmpDir, "proj");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "project.md"), "---\nid: proj\nowner: scout\nstatus: pending-review\n---\n\n# Project\n");
    fs.writeFileSync(path.join(projDir, "discussion.md"), "# Discussion\n\n### hao - 2026-05-08\nPlease revise the plan.\n");

    const proj = makeProject({
      relPath: "projects/proj",
      projectFile: path.join(projDir, "project.md"),
      status: "pending-review",
      owner: "scout",
      content: fs.readFileSync(path.join(projDir, "project.md"), "utf-8"),
    });
    const state: HealthState = {
      projects: {
        "projects/proj": {
          ...newProjectHealthEntry(),
          lastLaunch: now - 60_000,
        },
      },
    };

    const rateLimited = diagnoseProject(proj, state, emptyBreached, emptyRunning, now, []);
    expect(rateLimited.type).toBe("skip");
    expect(rateLimited.reason).toContain("cooldown");

    const forced = diagnoseProject(proj, state, emptyBreached, emptyRunning, now, [], true);
    expect(forced.type).toBe("launch-workflow");
    expect(forced.reason).toContain("unread comments");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("diagnoseProject - closed with unread discussion", () => {
  const now = Date.now();
  const emptyState: HealthState = { projects: {} };

  it("launches for closed project with unread discussion.md", () => {
    // Create a temp dir with discussion.md
    const tmpDir = `/tmp/test-diag-${Date.now()}`;
    const projDir = path.join(tmpDir, "proj");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "project.md"), "# P\n**Status**: closed\n");
    fs.writeFileSync(path.join(projDir, "discussion.md"), "# Discussion\n\nSome unread comment\n");

    const proj: ProjectInfo = {
      relPath: "projects/proj",
      projectFile: path.join(projDir, "project.md"),
      content: "# P\n**Status**: closed\n",
      status: "closed",
      owner: "agent1",
      blockerReason: "",
      workflow: "master-worker",
    };

    const result = diagnoseProject(proj, emptyState, new Set(), new Set(), now, []);
    expect(result.type).toBe("launch-workflow");
    expect(result.reason).toContain("reopening");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("utility functions", () => {
  it("generateRunId returns a hex string", () => {
    const id = generateRunId();
    expect(id).toMatch(/^[a-f0-9]+$/);
    expect(id.length).toBeGreaterThan(0);
  });

  it("simpleHash returns consistent hash", () => {
    expect(simpleHash("hello")).toBe(simpleHash("hello"));
    expect(simpleHash("hello")).not.toBe(simpleHash("world"));
  });

  it("saveWorkflowRunFile writes JSON", () => {
    const tmpDir = `/tmp/test-wfrun-${Date.now()}`;
    fs.mkdirSync(tmpDir, { recursive: true });
    saveWorkflowRunFile(tmpDir, { runId: "test-run", status: "ok" });
    // Should have created a .json file in .state/workflow-runs/
    const wfDir = path.join(tmpDir, ".state", "workflow-runs");
    const files = fs.readdirSync(wfDir).filter(f => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("readHealthState returns default for missing file", () => {
    const state = readHealthState("/nonexistent/file.json");
    expect(state.projects).toEqual({});
  });

  it("writeHealthState and readHealthState roundtrip", () => {
    const file = `/tmp/test-health-${Date.now()}.json`;
    const state: HealthState = { projects: { "test": newProjectHealthEntry() } };
    writeHealthState(file, state);
    const read = readHealthState(file);
    expect(read.projects["test"]).toBeDefined();
    fs.unlinkSync(file);
  });

  it("readInflight returns empty set for missing file", () => {
    const result = readInflight("/nonexistent/file.json");
    expect(result.size).toBe(0);
  });

  it("writeInflight and readInflight roundtrip", () => {
    const file = `/tmp/test-inflight-${Date.now()}.json`;
    writeInflight(file, new Set(["a", "b"]));
    const result = readInflight(file);
    expect(result.size).toBe(2);
    expect(result.has("a")).toBe(true);
    fs.unlinkSync(file);
  });
});
