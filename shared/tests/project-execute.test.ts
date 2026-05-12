/**
 * Tests for workflows/project.ts — imports the actual module to get coverage.
 * Tests the execute() function with mocked WorkflowContext.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

// Import the actual module
import { name, description, flushProjectCache, execute } from "../workflows/project.js";

const TEST_DIR = join("/tmp", "__test_project_tmp__");

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
    summarize: vi.fn((result: any, _opts?: any) => result.lastAssistantText ?? "worker output summary"),
    runAgent: vi.fn(async (_agent: string, _prompt: string) => ({
      status: "success",
      lastAssistantText: "CONTINUE\n\n(a) Next: write more tests\n(b) First attempt\n(c) Read the file",
    })),
  };
}

function setupProjectDir(status = "active", milestones = "- [ ] First milestone\n- [ ] Second milestone") {
  const projDir = join(TEST_DIR, "myproj");
  mkdirSync(join(projDir, "outputs"), { recursive: true });
  writeFileSync(join(projDir, "project.md"), `# Project: Test

**Status**: ${status}
**Owner**: test-agent
**Worker**: test-agent
**Priority**: P1
**Iteration**: 0

## Goal
Test goal

## Current State
Not started.

## Context

## Milestones
${milestones}

## Resources

## Artifacts

`, "utf-8");
  writeFileSync(join(projDir, "journal.md"), "# Journal\n\n", "utf-8");
  writeFileSync(join(projDir, "discussion.md"), "# Discussion\n\n", "utf-8");
  return projDir;
}

function setupFrontmatterProjectDir(status = "active", iteration = 0) {
  const projDir = join(TEST_DIR, "yamlproj");
  mkdirSync(join(projDir, "outputs"), { recursive: true });
  writeFileSync(join(projDir, "project.md"), `---
id: yamlproj
owner: test-agent
status: ${status}
type: milestone
priority: P1
workflow: project
iteration: ${iteration}
---

# Project: YAML Test

## Goal
Test goal

## Current State
Not started.

## Context

## Milestones
- [ ] First milestone

## Resources

## Artifacts

`, "utf-8");
  writeFileSync(join(projDir, "journal.md"), "# Journal\n\n", "utf-8");
  writeFileSync(join(projDir, "discussion.md"), "# Discussion\n\n", "utf-8");
  return projDir;
}

describe("project module exports", () => {
  it("exports name and description", () => {
    expect(name).toBe("project");
    expect(description).toContain("persistent loop");
  });

  it("flushProjectCache does not throw", () => {
    expect(() => flushProjectCache()).not.toThrow();
  });
});

describe("execute — project creation", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("creates project directory if it does not exist", async () => {
    const projDir = join(TEST_DIR, "newproj");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Build something\nowner: test-agent\nworker: test-agent\nmaxIterations: 1`);
    
    // Worker returns WAITING to stop after 1 iteration
    ctx.runAgent.mockResolvedValueOnce({
      status: "success",
      lastAssistantText: "Did the work",
    }).mockResolvedValueOnce({
      status: "success",
      lastAssistantText: "WAITING: All done\nResume when: human reviews",
    });

    await execute(ctx);
    
    expect(existsSync(join(projDir, "project.md"))).toBe(true);
    expect(existsSync(join(projDir, "journal.md"))).toBe(true);
  });
});

describe("execute — status handling", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("returns immediately for paused projects", async () => {
    const projDir = setupProjectDir("paused");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test\nowner: test-agent\nworker: test-agent`);
    
    const result = await execute(ctx);
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("paused"));
  });

  it("returns immediately for cancelled projects", async () => {
    const projDir = setupProjectDir("cancelled");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test\nowner: test-agent\nworker: test-agent`);
    
    await execute(ctx);
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("cancelled"));
  });

  it("returns immediately for done projects with no comments", async () => {
    const projDir = setupProjectDir("done");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test\nowner: test-agent\nworker: test-agent`);
    
    await execute(ctx);
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("done"));
  });

  it("returns immediately for blocked projects with no comments", async () => {
    const projDir = setupProjectDir("blocked");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test\nowner: test-agent\nworker: test-agent`);
    
    await execute(ctx);
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("blocked"));
  });

  it("returns immediately for waiting projects with no comments", async () => {
    const projDir = setupProjectDir("waiting");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test\nowner: test-agent\nworker: test-agent`);
    
    await execute(ctx);
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("waiting"));
  });
});

describe("execute — worker iteration", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("runs worker then reviewer, updates journal", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 1\nreviewEvery: 1`);
    
    // Worker response
    ctx.runAgent.mockResolvedValueOnce({
      status: "success",
      lastAssistantText: "I created the files",
    });
    // Reviewer says WAITING
    ctx.runAgent.mockResolvedValueOnce({
      status: "success",
      lastAssistantText: "WAITING: All milestones complete\nResume when: human review",
    });

    await execute(ctx);
    
    // Check journal was updated
    const journal = readFileSync(join(projDir, "journal.md"), "utf-8");
    expect(journal).toContain("### Iteration 1");
    
    // Check project status
    const project = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(project).toContain("waiting");
  });

  it("resumes from journal iteration when project frontmatter is stale", async () => {
    const projDir = setupFrontmatterProjectDir("active", 0);
    writeFileSync(join(projDir, "journal.md"), [
      "# Journal",
      "",
      "### Iteration 7 — 2026-05-11T00:00:00.000Z",
      "**Worker**: old run",
      "**Reviewer**: CONTINUE — keep going",
      "",
      "### Iteration 8 — 2026-05-11T00:10:00.000Z",
      "**Worker**: old run",
      "**Reviewer**: CONTINUE — keep going",
      "",
    ].join("\n"), "utf-8");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 9\nreviewEvery: 1`);

    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did work 9" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: Done\nResume when: review" });

    await execute(ctx);

    const journal = readFileSync(join(projDir, "journal.md"), "utf-8");
    expect(journal).toContain("### Iteration 9");
    expect(journal).not.toContain("### Iteration 1 —");
    const project = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(project).toContain("iteration: 9");
  });

  it("does not append discussion read markers during worker iterations without comments", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 1\nreviewEvery: 1`);

    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did work" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: Done\nResume when: review" });

    await execute(ctx);

    const discussion = readFileSync(join(projDir, "discussion.md"), "utf-8");
    expect(discussion).not.toContain("---read @iter");
  });

  it("preserves full WAITING detail in Current State", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 1\nreviewEvery: 1`);
    const longDetail = "All documentation milestones are complete and verified. The worker is now attempting to actually deploy and run e2e tests against localdeploy in tmux, which is outside the original documentation-only scope but is the current meaningful next validation step.";

    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Documented the workflow" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: `WAITING: ${longDetail}\nResume when: human reviews the expanded e2e scope` });

    await execute(ctx);

    const project = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(project).toContain(`Waiting: ${longDetail}`);
    expect(project).toContain("meaningful next validation step");
  });

  it("handles worker errors and escalates after 2 consecutive failures", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 5\nreviewEvery: 1`);
    
    ctx.runAgent.mockResolvedValue({ status: "error", lastAssistantText: "" });

    await execute(ctx);
    
    expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining("failed 2x"));
  });

  it("continues when reviewer says CONTINUE", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 2\nreviewEvery: 1`);
    
    // Iteration 1: worker + reviewer says CONTINUE
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did work 1" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "CONTINUE\n(a) Next file\n(b) First\n(c) Read" })
      // Iteration 2: worker + reviewer says WAITING
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did work 2" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: Done now\nResume when: review" });

    await execute(ctx);
    
    const journal = readFileSync(join(projDir, "journal.md"), "utf-8");
    expect(journal).toContain("### Iteration 1");
    expect(journal).toContain("### Iteration 2");
  });

  it("does not reuse prior WAITING guidance as worker instructions", async () => {
    const projDir = setupProjectDir("active");
    writeFileSync(join(projDir, "journal.md"), [
      "# Journal",
      "",
      "### Iteration 1 — 2026-05-12T00:00:00.000Z",
      "**Worker**: prior work",
      "**Reviewer**: WAITING — external deploy is not ready. Resume when: human provides build version",
      "",
    ].join("\n"), "utf-8");
    writeFileSync(
      join(projDir, "project.md"),
      readFileSync(join(projDir, "project.md"), "utf-8").replace("**Iteration**: 0", "**Iteration**: 1"),
      "utf-8",
    );
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 2\nreviewEvery: 1`);

    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Checked blocker" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: Still blocked\nResume when: human provides build version" });

    await execute(ctx);

    const workerPrompt = ctx.runAgent.mock.calls[0][1];
    expect(workerPrompt).not.toContain("## Your Instructions\nWAITING");
    expect(workerPrompt).toContain("finish(blocked/partial) with evidence instead of inventing files");
  });

  it("handles BLOCKED decision from reviewer", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 2\nreviewEvery: 1`);
    
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Tried but need API key" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "BLOCKED: Missing API key\nResume when: key is provided" });

    await execute(ctx);
    
    expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining("Blocked"));
    const project = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(project).toContain("blocked");
  });

  it("preserves full BLOCKED detail in Current State", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 1\nreviewEvery: 1`);
    const longDetail = "The deploy command cannot continue because the devbox tmux session shows localdeploy failed after resolving credentials, and the remaining error requires a human-owned cluster permission change before another run is useful.";

    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Tried deploy" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: `BLOCKED: ${longDetail}\nResume when: permission is fixed` });

    await execute(ctx);

    const project = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(project).toContain(`Blocked: ${longDetail}`);
    expect(project).toContain("another run is useful");
  });

  it("handles PIVOT decision as continue", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 2\nreviewEvery: 1`);
    
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Approach failed" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "PIVOT: Try a different approach\n(a) New strategy\n(b) Old failed\n(c) Start fresh" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "New approach worked" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: Pivot worked\nResume when: review" });

    await execute(ctx);
    
    const journal = readFileSync(join(projDir, "journal.md"), "utf-8");
    expect(journal).toContain("[PIVOT]");
  });

  it("reaches max iterations and pauses", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 1\nreviewEvery: 2`);
    
    // Worker succeeds but no review at iteration 1 (reviewEvery=2)
    ctx.runAgent.mockResolvedValueOnce({ status: "success", lastAssistantText: "Did work" });

    await execute(ctx);
    
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("cap"));
    const project = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(project).toContain("paused");
  });

  it("handles reviewer error gracefully (auto-continues)", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test goal\nowner: test-agent\nworker: test-agent\nmaxIterations: 2\nreviewEvery: 1`);
    
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did work" })
      .mockResolvedValueOnce({ status: "error", lastAssistantText: "" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did more work" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: Done\nResume when: review" });

    await execute(ctx);
    
    const journal = readFileSync(join(projDir, "journal.md"), "utf-8");
    expect(journal).toContain("auto-continuing");
  });
});

describe("execute — comment handling", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("processes [done] comment via JS fast-path", async () => {
    const projDir = setupProjectDir("waiting");
    // Add a comment to discussion.md
    writeFileSync(join(projDir, "discussion.md"), "# Discussion\n\n[done] Looks good, ship it!\n", "utf-8");
    
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test\nowner: test-agent\nworker: test-agent`);
    
    await execute(ctx);
    
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("done by human/May"));
    const project = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(project).toContain("done");
    // No LLM calls needed for [done] comment
    expect(ctx.runAgent).not.toHaveBeenCalled();
  });

  it("processes non-done comment through reviewer", async () => {
    const projDir = setupProjectDir("waiting");
    writeFileSync(join(projDir, "discussion.md"), "# Discussion\n\nPlease also add error handling\n", "utf-8");
    
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test\nowner: test-agent\nworker: test-agent\nmaxIterations: 2\nreviewEvery: 1`);
    
    // Comment reviewer says CONTINUE
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "CONTINUE: Address the feedback\n(a) Add error handling\n(b) New request\n(c) Read code" })
      // Worker
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Added error handling" })
      // Reviewer
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: Error handling added\nResume when: review" });

    await execute(ctx);
    
    const journal = readFileSync(join(projDir, "journal.md"), "utf-8");
    expect(journal).toContain("(comment)");
    const discussion = readFileSync(join(projDir, "discussion.md"), "utf-8");
    expect(discussion.match(/---read @iter\d+---/g)).toEqual(["---read @iter1---"]);
  });
});

describe("execute — DONE auto-conversion", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("converts DONE to WAITING automatically", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test\nowner: test-agent\nworker: test-agent\nmaxIterations: 1\nreviewEvery: 1`);
    
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Everything done" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "DONE: All milestones complete" });

    await execute(ctx);
    
    const project = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(project).toContain("waiting");
    const journal = readFileSync(join(projDir, "journal.md"), "utf-8");
    expect(journal).toContain("Auto-converted");
  });
});

describe("execute — stall detection", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("auto-escalates after 5 iterations without milestone progress", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test\nowner: test-agent\nworker: test-agent\nmaxIterations: 10\nreviewEvery: 1`);
    
    // 5 iterations of CONTINUE with no milestone progress
    for (let i = 0; i < 5; i++) {
      ctx.runAgent
        .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did something" })
        .mockResolvedValueOnce({ status: "success", lastAssistantText: "CONTINUE: Keep going\n(a) More work\n(b) Same\n(c) Do it" });
    }

    await execute(ctx);
    
    expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining("Stuck"));
    const project = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(project).toContain("blocked");
  });
});

describe("execute — legacy format", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("supports legacy single-file format", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const legacyPath = join(TEST_DIR, "legacy.md");
    writeFileSync(legacyPath, `# Project

**Status**: active
**Iteration**: 0

## Goal
Legacy test

## Current State
Not started.

## Milestones
- [ ] Do thing

## Progress Log

`, "utf-8");

    const ctx = makeCtx(`project: ${legacyPath}\ngoal: Legacy test\nowner: test-agent\nworker: test-agent\nmaxIterations: 1\nreviewEvery: 1`);
    
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Did the thing" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: Done\nResume when: review" });

    await execute(ctx);
    
    const content = readFileSync(legacyPath, "utf-8");
    expect(content).toContain("Iteration 1");
    expect(content).toContain("waiting");
  });
});

describe("execute — context updates", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("applies CONTEXT_UPDATE from reviewer", async () => {
    const projDir = setupProjectDir("active");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test\nowner: test-agent\nworker: test-agent\nmaxIterations: 1\nreviewEvery: 1`);
    
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Found important thing" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "WAITING: Done\nResume when: review\nCONTEXT_UPDATE: - Important discovery about X" });

    await execute(ctx);
    
    const project = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(project).toContain("Important discovery about X");
  });
});

describe("execute — milestone checkoff", () => {
  beforeEach(() => { cleanup(); flushProjectCache(); });

  it("checks off milestones mentioned in reviewer response", async () => {
    const projDir = setupProjectDir("active", "- [ ] First milestone\n- [ ] Second milestone");
    const ctx = makeCtx(`project: ${projDir}\ngoal: Test\nowner: test-agent\nworker: test-agent\nmaxIterations: 1\nreviewEvery: 1`);
    
    ctx.runAgent
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "Completed first milestone" })
      .mockResolvedValueOnce({ status: "success", lastAssistantText: "CONTINUE: First milestone is done. Now do second.\n(a) second\n(b) first\n(c) go" });

    // Will continue but hit maxIterations
    await execute(ctx);
    
    const project = readFileSync(join(projDir, "project.md"), "utf-8");
    expect(project).toContain("[x] First milestone");
  });
});

// Cleanup after all tests
afterAll(() => { cleanup(); });
