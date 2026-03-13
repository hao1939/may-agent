import { describe, it, expect } from "vitest";
import { checkProtectedPath } from "../src/app/agent-loader.js";

const AGENTS_ROOT = "/app/agents";

describe("checkProtectedPath (P53 cross-agent protection)", () => {
  it("allows writes to own agent SOUL.md", () => {
    const result = checkProtectedPath("/app/agents/bob/SOUL.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("allows writes to own agent agent.json", () => {
    const result = checkProtectedPath("/app/agents/bob/agent.json", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("allows writes to own agent LESSONS.md", () => {
    const result = checkProtectedPath("/app/agents/bob/LESSONS.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("blocks writes to another agent's SOUL.md", () => {
    const result = checkProtectedPath("/app/agents/coder/SOUL.md", "bob", AGENTS_ROOT);
    expect(result).not.toBeNull();
    expect(result).toContain("WRITE BLOCKED");
    expect(result).toContain("P53");
    expect(result).toContain("SOUL.md");
  });

  it("blocks writes to another agent's agent.json", () => {
    const result = checkProtectedPath("/app/agents/may/agent.json", "bob", AGENTS_ROOT);
    expect(result).not.toBeNull();
    expect(result).toContain("agent.json");
  });

  it("blocks writes to another agent's LESSONS.md", () => {
    const result = checkProtectedPath("/app/agents/tech-lead/LESSONS.md", "bob", AGENTS_ROOT);
    expect(result).not.toBeNull();
    expect(result).toContain("LESSONS.md");
  });

  it("allows writes to another agent's workspace files", () => {
    const result = checkProtectedPath("/app/agents/coder/workspace/notes.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("allows writes to another agent's knowledge files", () => {
    const result = checkProtectedPath("/app/agents/coder/knowledge/coaching.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("allows writes to shared/ directory", () => {
    const result = checkProtectedPath("/app/agents/shared/bulletin.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("allows writes outside agents/ entirely", () => {
    const result = checkProtectedPath("/app/src/lib/manager.ts", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("blocks writes to nested protected files (SOUL.md in subdirectory)", () => {
    // agents/coder/knowledge/SOUL.md — the filename matches, so it blocks
    // This is conservative: better to block too aggressively than allow leaks
    const result = checkProtectedPath("/app/agents/coder/knowledge/SOUL.md", "bob", AGENTS_ROOT);
    expect(result).not.toBeNull();
  });

  it("allows own agent's nested protected files", () => {
    const result = checkProtectedPath("/app/agents/bob/knowledge/SOUL.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("handles deeply nested agent workspace paths", () => {
    const result = checkProtectedPath(
      "/app/agents/coach/workspace/exercises/tech-lead-regression/session-cleanup.ts",
      "tech-lead",
      AGENTS_ROOT,
    );
    expect(result).toBeNull();
  });

  it("includes the blocked agent name and caller name in the message", () => {
    const result = checkProtectedPath("/app/agents/coder/SOUL.md", "optimizer", AGENTS_ROOT);
    expect(result).toContain("agents/coder/");
    expect(result).toContain('"optimizer"');
    expect(result).toContain("agents/optimizer/");
  });

  it("allows writes to .lab/ fork LESSONS.md (growth system sandbox)", () => {
    const result = checkProtectedPath(
      "/app/agents/.lab/bob-growth-test/LESSONS.md",
      "coach",
      AGENTS_ROOT,
    );
    expect(result).toBeNull();
  });

  it("allows writes to .lab/ fork SOUL.md", () => {
    const result = checkProtectedPath(
      "/app/agents/.lab/bob-growth-test/SOUL.md",
      "coach",
      AGENTS_ROOT,
    );
    expect(result).toBeNull();
  });

  it("allows writes to .lab/ fork agent.json", () => {
    const result = checkProtectedPath(
      "/app/agents/.lab/bob-growth-test/agent.json",
      "coach",
      AGENTS_ROOT,
    );
    expect(result).toBeNull();
  });
});
