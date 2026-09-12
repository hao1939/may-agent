import { describe, it, expect } from "bun:test";
import { checkCrossEditGuard } from "./cross-edit-guard.js";

const PROJECT_ROOT = "/app";

/** Helper: returns true if write is allowed */
function isAllowed(absolutePath: string, agentName: string): boolean {
  return !checkCrossEditGuard(absolutePath, agentName, PROJECT_ROOT).blocked;
}

/** Helper: returns the block message (or undefined if allowed) */
function blockMessage(absolutePath: string, agentName: string): string | undefined {
  return checkCrossEditGuard(absolutePath, agentName, PROJECT_ROOT).message;
}

describe("checkCrossEditGuard (P53/P70 cross-agent protection)", () => {
  it("allows writes to own agent AGENTS.md", () => {
    expect(isAllowed("/app/agents/bob/AGENTS.md", "bob")).toBe(true);
  });

  it("blocks writes to own agent agent.json (P70: immutable self-config)", () => {
    const result = checkCrossEditGuard("/app/agents/bob/agent.json", "bob", PROJECT_ROOT);
    expect(result.blocked).toBe(true);
    expect(result.message).toContain("P70");
    expect(result.message).toContain("agent.json");
  });

it("denies the old implicit exception: allows tech-lead to write own agent.json", () => {
    expect(isAllowed("/app/agents/tech-lead/agent.json", "tech-lead")).toBe(false);
  });

  it("allows writes to own agent LESSONS.md", () => {
    expect(isAllowed("/app/agents/bob/LESSONS.md", "bob")).toBe(true);
  });

  it("blocks writes to another agent's AGENTS.md", () => {
    const result = checkCrossEditGuard("/app/agents/coder/AGENTS.md", "bob", PROJECT_ROOT);
    expect(result.blocked).toBe(true);
    expect(result.message).toContain("WRITE BLOCKED");
    expect(result.message).toContain("AGENTS.md");
  });

  it("blocks writes to another agent's agent.json", () => {
    const result = checkCrossEditGuard("/app/agents/may/agent.json", "bob", PROJECT_ROOT);
    expect(result.blocked).toBe(true);
    expect(result.message).toContain("agent.json");
  });

  it("allows writes to another agent's LESSONS.md (not identity-critical)", () => {
    expect(isAllowed("/app/agents/tech-lead/LESSONS.md", "bob")).toBe(true);
  });

  it("allows writes to another agent's workspace files", () => {
    expect(isAllowed("/app/agents/coder/workspace/notes.md", "bob")).toBe(true);
  });

  it("allows writes to another agent's knowledge files", () => {
    expect(isAllowed("/app/agents/coder/knowledge/coaching.md", "bob")).toBe(true);
  });

  it("allows writes to canonical shared/ directory", () => {
    expect(isAllowed("/app/shared/bulletin.md", "bob")).toBe(true);
  });

  it("blocks non-May writes to canonical shared system guidance", () => {
    const result = checkCrossEditGuard("/app/shared/common-sense.md", "bob", PROJECT_ROOT);
    expect(result.blocked).toBe(true);
    expect(result.message).toContain("shared/common-sense.md");
  });

  it("allows writes outside agents/ entirely", () => {
    expect(isAllowed("/app/src/lib/manager.ts", "bob")).toBe(true);
  });

  it("blocks writes to nested protected files (AGENTS.md in subdirectory)", () => {
    // agents/coder/knowledge/AGENTS.md — the filename matches, so it blocks
    // This is conservative: better to block too aggressively than allow leaks
    const result = checkCrossEditGuard("/app/agents/coder/knowledge/AGENTS.md", "bob", PROJECT_ROOT);
    expect(result.blocked).toBe(true);
  });

  it("allows own agent's nested protected files", () => {
    expect(isAllowed("/app/agents/bob/knowledge/AGENTS.md", "bob")).toBe(true);
  });

  it("handles deeply nested agent workspace paths", () => {
    expect(
      isAllowed("/app/agents/coach/workspace/exercises/tech-lead-regression/session-cleanup.ts", "tech-lead"),
    ).toBe(true);
  });

  it("includes the blocked agent dir and caller name in the message", () => {
    const msg = blockMessage("/app/agents/coder/AGENTS.md", "optimizer");
    expect(msg).toContain("agents/coder/");
    expect(msg).toContain("optimizer");
  });

  it("allows writes to .lab/ fork LESSONS.md (growth system sandbox)", () => {
    expect(isAllowed("/app/agents/.lab/bob-growth-test/LESSONS.md", "coach")).toBe(true);
  });

  it("allows writes to .lab/ fork AGENTS.md", () => {
    expect(isAllowed("/app/agents/.lab/bob-growth-test/AGENTS.md", "coach")).toBe(true);
  });

  it("allows writes to .lab/ fork agent.json", () => {
    expect(isAllowed("/app/agents/.lab/bob-growth-test/agent.json", "coach")).toBe(true);
  });

  // May exemption — May can edit any agent's protected files
it("denies the old implicit exception: allows May to write to another agent's AGENTS.md", () => {
    expect(isAllowed("/app/agents/bob/AGENTS.md", "may")).toBe(false);
  });

it("denies the old implicit exception: allows May to write to another agent's agent.json", () => {
    expect(isAllowed("/app/agents/coder/agent.json", "may")).toBe(false);
  });

  it("allows May to write to another agent's LESSONS.md", () => {
    expect(isAllowed("/app/agents/tech-lead/LESSONS.md", "may")).toBe(true);
  });

it("denies the old implicit exception: allows tech-lead to write to another agent's agent.json (P70 config management)", () => {
    expect(isAllowed("/app/agents/coder/agent.json", "tech-lead")).toBe(false);
  });

  it("blocks tech-lead from writing to another agent's AGENTS.md", () => {
    const result = checkCrossEditGuard("/app/agents/coder/AGENTS.md", "tech-lead", PROJECT_ROOT);
    expect(result.blocked).toBe(true);
    expect(result.message).toContain("WRITE BLOCKED");
  });
});
