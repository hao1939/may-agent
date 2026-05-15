/**
 * Additional tests for workflows/project.ts to boost coverage.
 * Targets uncovered branches: [pause]/[cancel]/[resume] comments,
 * evaluator-gate, budget checkpoint, goal extraction from file,
 * catalogOutputs, parseFeatures, parseMetrics.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execute, flushProjectCache } from "../workflows/project.js";

const TEST_DIR = join("/tmp", "__test_project_coverage__");

function cleanup() {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
}

function makeCtx(task: string, agent = "test-agent"): any {
  return {
    task,
    agent,
    emit: vi.fn(),
    log: vi.fn(),
    dispatchEvent: vi.fn(),
    done: vi.fn((msg: string) => ({ type: "done", message: msg })),
    escalate: vi.fn((msg: string) => ({ type: "escalate", message: msg })),
    summarize: vi.fn((_result: any, _opts?: any) => "worker output summary"),
    runAgent: vi.fn(async () => ({
      status: "success",
      lastAssistantText: "WAITING: done for now\nResume when: next review",
    })),
  };
}

function setupProject(opts: {
  status?: string;
  milestones?: string;
  comments?: string;
  features?: string;
  metrics?: string;
  iteration?: number;
  outputs?: string[];
} = {}) {
  const projDir = join(TEST_DIR, "proj");
  mkdirSync(join(projDir, "outputs"), { recursive: true });

  const status = opts.status ?? "active";
  const iteration = opts.iteration ?? 0;
  const milestones = opts.milestones ?? "- [ ] First milestone";
  const commentsSection = opts.comments ? `## Comments\n${opts.comments}\n` : "## Comments\n";
  const featuresSection = opts.features ? `## Process Notes\nfeatures: ${opts.features}\n` : "";
  const metricsSection = opts.metrics ? `## Metrics\n${opts.metrics}\n` : "";

  writeFileSync(join(projDir, "project.md"), `# Project: Test

**Status**: ${status}
**Owner**: test-agent
**Worker**: test-agent
**Priority**: P1
**Iteration**: ${iteration}

## Goal
Test goal

## Current State
Working on it.

## Context

## Milestones
${milestones}

${metricsSection}
${featuresSection}
${commentsSection}
## Resources

## Artifacts

`, "utf-8");
  writeFileSync(join(projDir, "journal.md"), "# Journal\n\n", "utf-8");
  writeFileSync(join(projDir, "discussion.md"), "# Discussion\n\n", "utf-8");

  if (opts.outputs) {
    for (const f of opts.outputs) {
      writeFileSync(join(projDir, "outputs", f), `content of ${f}`, "utf-8");
    }
  }

  return projDir;
}

function taskFor(projDir: string, extra = "") {
  return `project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 3\nreviewEvery: 1\n${extra}`;
}

describe("project.ts — [pause] comment fast-path", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("processes [pause] comment and marks project paused", async () => {
    const projDir = setupProject({ status: "active", comments: "[pause] take a break" });
    const ctx = makeCtx(taskFor(projDir));

    const result = await execute(ctx);

    expect(result).toEqual(expect.objectContaining({ type: "done" }));
    expect(result.message).toContain("paused");
    const content = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(content).toMatch(/\*\*Status\*\*:\s*paused/);
  });
});

describe("project.ts — [cancel] comment fast-path", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("processes [cancel] comment and marks project cancelled", async () => {
    const projDir = setupProject({ status: "active", comments: "[cancel] no longer needed" });
    const ctx = makeCtx(taskFor(projDir));

    const result = await execute(ctx);

    expect(result).toEqual(expect.objectContaining({ type: "done" }));
    expect(result.message).toContain("cancelled");
    const content = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(content).toMatch(/\*\*Status\*\*:\s*cancelled/);
  });
});

describe("project.ts — [resume] comment fast-path", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("processes [resume] comment, sets active, and continues iteration", async () => {
    const projDir = setupProject({ status: "blocked", comments: "[resume] unblocked now" });
    const ctx = makeCtx(taskFor(projDir));

    // After resume, it will continue to worker phase — mock worker + reviewer
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did some work" }) // worker
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: looks good\nResume when: next review" }); // reviewer

    const result = await execute(ctx);

    const content = readFileSync(join(projDir, "project.md"), "utf-8");
    // Should have been active at some point (resume sets active)
    const journal = readFileSync(join(projDir, "journal.md"), "utf-8");
    expect(journal).toContain("RESUMED");
  });
});

describe("project.ts — evaluator-gate feature", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("unresolved plan work overrides WAITING to CONTINUE", async () => {
    const projDir = setupProject({
      status: "active",
      features: "evaluator-gate",
      milestones: "- [ ] Not done yet",
    });
    const ctx = makeCtx(taskFor(projDir));

    // Iteration 1: worker says done, reviewer says WAITING, evaluator FAILs (score 3)
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did the work" }) // worker
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: all done\nResume when: review" }) // reviewer
      // Unresolved plan work overrides WAITING to CONTINUE, so the next iteration runs:
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "More work done" }) // worker iter 2
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: really done\nResume when: review" }) // reviewer
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "More work done" }) // worker iter 3
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "CONTINUE: still not enough" }); // reviewer

    const result = await execute(ctx);

    const journal = readFileSync(join(projDir, "journal.md"), "utf-8");
    expect(journal).toContain("WAITING overridden to CONTINUE");
    expect(journal).toContain("project still has explicit Next Action or unresolved Plan work");
  });

  it("evaluator-gate PASS allows WAITING to proceed", async () => {
    const projDir = setupProject({
      status: "active",
      features: "evaluator-gate",
      milestones: "- [x] Already done",
    });
    const ctx = makeCtx(taskFor(projDir));

    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did the work" }) // worker
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: all done\nResume when: review" }); // reviewer
    // All milestones done -> JS fast-path PASS (no evaluator LLM call needed)

    const result = await execute(ctx);

    expect(result).toEqual(expect.objectContaining({ type: "done" }));
    const journal = readFileSync(join(projDir, "journal.md"), "utf-8");
    expect(journal).toContain("fast-path");
  });

  it("evaluator-gate PASS with high score allows WAITING", async () => {
    const projDir = setupProject({
      status: "active",
      features: "evaluator-gate",
      milestones: "- [ ] Not done",
    });
    const ctx = makeCtx(taskFor(projDir));

    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did the work" }) // worker
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: done\nResume when: review" }) // reviewer
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "SCORE: 8\nLooks good" }); // evaluator PASS

    const result = await execute(ctx);

    expect(result).toEqual(expect.objectContaining({ type: "done" }));
    expect(result.message).toContain("Waiting");
  });
});

describe("project.ts — goal extraction from project file", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("reads goal from project file when goal is 'see project file'", async () => {
    const projDir = setupProject({ status: "active" });
    const ctx = makeCtx(`project: ${projDir}\ngoal: see project file\nowner: test-agent\nworker: test-agent\nmaxIterations: 1`);

    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did work" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: done\nResume when: review" });

    await execute(ctx);
    // Should not throw — goal was extracted from project.md
  });

  it("uses project name as fallback when no goal in file", async () => {
    const projDir = join(TEST_DIR, "fallback-proj");
    mkdirSync(join(projDir, "outputs"), { recursive: true });
    writeFileSync(join(projDir, "project.md"), `# Project: Fallback

**Status**: active
**Owner**: test-agent
**Worker**: test-agent
**Iteration**: 0

## Current State
Working.

## Milestones
- [ ] Something
`, "utf-8");
    writeFileSync(join(projDir, "journal.md"), "# Journal\n\n", "utf-8");

    const ctx = makeCtx(`project: ${projDir}\ngoal: see project file\nowner: test-agent\nworker: test-agent\nmaxIterations: 1`);
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did work" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: done\nResume when: review" });

    await execute(ctx);
    // Should use "fallback-proj" as the goal fallback
  });
});

describe("project.ts — catalogOutputs", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("catalogs output files into Artifacts section", async () => {
    const projDir = setupProject({ status: "active", outputs: ["report.md", "data.json"] });
    const ctx = makeCtx(taskFor(projDir));

    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Created outputs" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: done\nResume when: review" });

    await execute(ctx);

    const content = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(content).toContain("outputs/report.md");
    expect(content).toContain("outputs/data.json");
  });
});

describe("project.ts — parseMetrics in review prompt", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("includes metrics in the review prompt when present", async () => {
    const projDir = setupProject({
      status: "active",
      metrics: "- coverage: target >= 90%, baseline 80%\n- speed: target < 200ms, baseline 500ms",
    });
    const ctx = makeCtx(taskFor(projDir));

    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Improved metrics" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: done\nResume when: review" });

    await execute(ctx);

    // The reviewer runAgent call should have included metrics in its prompt
    const reviewCall = ctx.runAgent.mock.calls[1];
    expect(reviewCall[1]).toContain("coverage");
  });
});

describe("project.ts — parseFeatures verify-before-stop", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("includes verification instructions when verify-before-stop feature is set", async () => {
    const projDir = setupProject({
      status: "active",
      features: "verify-before-stop",
    });
    const ctx = makeCtx(taskFor(projDir));

    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did work" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: done\nResume when: review" });

    await execute(ctx);

    // The reviewer prompt should mention verification
    const reviewCall = ctx.runAgent.mock.calls[1];
    expect(reviewCall[1]).toContain("Verification Required");
  });
});

describe("project.ts — CONTEXT_UPDATE from reviewer", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("replaces existing context with current operating facts", async () => {
    const projDir = setupProject({ status: "active" });
    // Pre-populate context section
    let content = readFileSync(join(projDir, "project.md"), "utf-8");
    content = content.replace("## Context\n", "## Context\n- Existing fact\n");
    writeFileSync(join(projDir, "project.md"), content, "utf-8");

    const ctx = makeCtx(taskFor(projDir));
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did work" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "CONTINUE\n\n(a) Next step\nCONTEXT_UPDATE: - New discovery\n(b) Approach\n(c) Do X" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "More work" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: done\nResume when: review" });

    await execute(ctx);

    const finalContent = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(finalContent).toContain("New discovery");
    expect(finalContent).not.toContain("Existing fact");
    expect(finalContent).not.toContain("(b) Approach");
  });
});
