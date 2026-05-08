import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractDecision,
  orchestratorSystemPrompt,
  workerSystemPrompt,
  snapshotOutputs,
  diffSnapshots,
} from "../workflows/master-worker.ts";

// ── extractDecision ─────────────────────────────────────────────────────

describe("extractDecision", () => {
  it("extracts CONTINUE from first word", () => {
    const d = extractDecision("CONTINUE\n\nDo the next thing");
    expect(d.status).toBe("continue");
  });

  it("extracts PIVOT from first word", () => {
    const d = extractDecision("PIVOT\n\nTry a different approach");
    expect(d.status).toBe("pivot");
  });

  it("extracts BLOCKED from first word", () => {
    const d = extractDecision("BLOCKED\n\nNeed credentials");
    expect(d.status).toBe("blocked");
  });

  it("extracts WAITING from first word", () => {
    const d = extractDecision("WAITING\n\nNeed human approval");
    expect(d.status).toBe("waiting");
  });

  it("extracts from Decision: KEYWORD pattern", () => {
    const d = extractDecision("Some preamble\nDecision: CONTINUE\nMore text");
    expect(d.status).toBe("continue");
  });

  it("extracts from **Decision** pattern", () => {
    const d = extractDecision("Analysis done.\n**Decision**: **PIVOT**\nNew approach");
    expect(d.status).toBe("pivot");
  });

  it("extracts from bold keyword pattern", () => {
    const d = extractDecision("Here is my analysis\n**BLOCKED**\nCannot proceed");
    expect(d.status).toBe("blocked");
  });

  it("detects proceed/move forward as CONTINUE", () => {
    const d = extractDecision("Let's proceed with the implementation");
    expect(d.status).toBe("continue");
  });

  it("detects 'let's begin' as CONTINUE", () => {
    const d = extractDecision("Great, let's begin working on the tests");
    expect(d.status).toBe("continue");
  });

  it("detects 'start working' as CONTINUE", () => {
    const d = extractDecision("We should start working on this immediately");
    expect(d.status).toBe("continue");
  });

  it("detects 'move forward' as CONTINUE", () => {
    const d = extractDecision("I think we should move forward with plan B");
    expect(d.status).toBe("continue");
  });

  it("falls back to scanning for uppercase keywords", () => {
    const d = extractDecision("I think we should CONTINUE with the plan");
    expect(d.status).toBe("continue");
  });

  it("returns unknown when no keyword found", () => {
    const d = extractDecision("Here is my analysis of the situation");
    expect(d.status).toBe("unknown");
  });

  it("truncates detail to 500 chars", () => {
    const longText = "CONTINUE\n" + "x".repeat(600);
    const d = extractDecision(longText);
    expect(d.detail.length).toBe(500);
  });

  it("handles empty string", () => {
    const d = extractDecision("");
    expect(d.status).toBe("unknown");
  });

  it("handles whitespace-only string", () => {
    const d = extractDecision("   \n\n  ");
    expect(d.status).toBe("unknown");
  });

  it("is case-insensitive for first-word check", () => {
    const d = extractDecision("continue with the work");
    expect(d.status).toBe("continue");
  });

  it("extracts WAITING from body when not first word", () => {
    const d = extractDecision("I need to be WAITING for approval");
    expect(d.status).toBe("waiting");
  });
});

// ── orchestratorSystemPrompt ────────────────────────────────────────────

describe("orchestratorSystemPrompt", () => {
  it("includes the project directory", () => {
    const prompt = orchestratorSystemPrompt("/projects/test");
    expect(prompt).toContain("/projects/test");
  });

  it("mentions orchestrator role", () => {
    const prompt = orchestratorSystemPrompt("/projects/test");
    expect(prompt).toContain("orchestrator");
  });

  it("mentions decision keywords", () => {
    const prompt = orchestratorSystemPrompt("/p");
    expect(prompt).toContain("CONTINUE");
    expect(prompt).toContain("PIVOT");
    expect(prompt).toContain("BLOCKED");
    expect(prompt).toContain("WAITING");
  });

  it("allows observation-only DONE without project churn", () => {
    const prompt = orchestratorSystemPrompt("/p");
    expect(prompt).toContain("If all plan items are done and metrics are healthy, do not edit just to create activity.");
    expect(prompt).toContain("For observation-only DONE, do not modify project.md or commit generated runtime files.");
    expect(prompt).toContain("When you claim live runtime metrics are healthy, verify them from the runtime DB with query_db.");
    expect(prompt).toContain("The embedded project.md is context, not current metric evidence.");
    expect(prompt).not.toContain("When plan items are done, write new ones.");
  });
});

// ── workerSystemPrompt ──────────────────────────────────────────────────

describe("workerSystemPrompt", () => {
  it("includes the outputs directory", () => {
    const prompt = workerSystemPrompt("/projects/test");
    expect(prompt).toContain("/projects/test/outputs");
  });

  it("mentions write-first constraint", () => {
    const prompt = workerSystemPrompt("/p");
    expect(prompt).toContain("WRITE-FIRST");
  });

  it("allows context gathering before write when needed for substantive output", () => {
    const prompt = workerSystemPrompt("/p");
    expect(prompt).toContain("unless you must inspect code/data first");
    expect(prompt).toContain("gather the minimum context needed, then write/edit the deliverable");
  });
});

// ── snapshotOutputs & diffSnapshots ─────────────────────────────────────

describe("snapshotOutputs", () => {
  it("returns empty map for non-existent directory", () => {
    const snap = snapshotOutputs("/nonexistent/dir/xyz");
    expect(snap.size).toBe(0);
  });
});

describe("diffSnapshots", () => {
  it("detects new files", () => {
    const before = new Map<string, number>();
    const after = new Map<string, number>([["file1.txt", 1000]]);
    const diff = diffSnapshots(before, after);
    expect(diff).toEqual(["file1.txt"]);
  });

  it("detects modified files", () => {
    const before = new Map<string, number>([["file1.txt", 1000]]);
    const after = new Map<string, number>([["file1.txt", 2000]]);
    const diff = diffSnapshots(before, after);
    expect(diff).toEqual(["file1.txt"]);
  });

  it("ignores unchanged files", () => {
    const before = new Map<string, number>([["file1.txt", 1000]]);
    const after = new Map<string, number>([["file1.txt", 1000]]);
    const diff = diffSnapshots(before, after);
    expect(diff).toEqual([]);
  });

  it("ignores deleted files", () => {
    const before = new Map<string, number>([["file1.txt", 1000]]);
    const after = new Map<string, number>();
    const diff = diffSnapshots(before, after);
    expect(diff).toEqual([]);
  });

  it("handles mixed changes", () => {
    const before = new Map<string, number>([
      ["unchanged.txt", 1000],
      ["modified.txt", 1000],
      ["deleted.txt", 1000],
    ]);
    const after = new Map<string, number>([
      ["unchanged.txt", 1000],
      ["modified.txt", 2000],
      ["new.txt", 3000],
    ]);
    const diff = diffSnapshots(before, after);
    expect(diff).toContain("modified.txt");
    expect(diff).toContain("new.txt");
    expect(diff).not.toContain("unchanged.txt");
    expect(diff).not.toContain("deleted.txt");
  });
});
