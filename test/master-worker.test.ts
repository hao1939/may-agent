import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  extractDecision,
  diffSnapshots,
  snapshotOutputs,
  orchestratorSystemPrompt,
  workerSystemPrompt,
  name,
  description,
} from "../shared/workflows/master-worker.ts";

// ── extractDecision ──

describe("extractDecision", () => {
  it("parses CONTINUE as first word", () => {
    expect(extractDecision("CONTINUE\n\nDo the next thing")).toEqual({
      status: "continue",
      detail: "CONTINUE\n\nDo the next thing",
    });
  });

  it("parses PIVOT as first word", () => {
    expect(extractDecision("PIVOT\n\nChange approach")).toMatchObject({ status: "pivot" });
  });

  it("parses BLOCKED as first word", () => {
    expect(extractDecision("BLOCKED\n\nCan't proceed")).toMatchObject({ status: "blocked" });
  });

  it("parses WAITING as first word", () => {
    expect(extractDecision("WAITING\n\nNeed input")).toMatchObject({ status: "waiting" });
  });

  it("detects 'Decision: CONTINUE' pattern", () => {
    const result = extractDecision("Here is my assessment.\n\nDecision: CONTINUE\n\nNext steps...");
    expect(result.status).toBe("continue");
  });

  it("detects **Decision**: **PIVOT** markdown pattern", () => {
    const result = extractDecision("Review complete.\n\n**Decision**: **PIVOT**\n\nNew approach");
    expect(result.status).toBe("pivot");
  });

  it("detects 'proceed' as continue", () => {
    expect(extractDecision("I think we should proceed with the current plan.")).toMatchObject({ status: "continue" });
  });

  it("detects 'let's begin' as continue", () => {
    expect(extractDecision("Let's begin working on the tests.")).toMatchObject({ status: "continue" });
  });

  it("detects 'move forward' as continue", () => {
    expect(extractDecision("We should move forward with implementation.")).toMatchObject({ status: "continue" });
  });

  it("detects 'start working' as continue", () => {
    expect(extractDecision("Time to start working on the feature.")).toMatchObject({ status: "continue" });
  });

  it("treats completed observation-only guidance as done", () => {
    expect(extractDecision("All plan items complete, all P1 metrics in range. Project remains active for observation — no new work needed.")).toMatchObject({ status: "done" });
  });

  it("treats no-new-work active-observation guidance as done", () => {
    expect(extractDecision("No new work needed this execution. Project stays active for ongoing observation.")).toMatchObject({ status: "done" });
  });

  it("treats explicit no immediate operation as done", () => {
    expect(extractDecision("DONE — this execution has no immediate next operation. The project remains active for future metric/event checks.")).toMatchObject({ status: "done" });
  });

  it("falls back to uppercase keyword scan", () => {
    expect(extractDecision("After reviewing, we are BLOCKED by the missing API key.")).toMatchObject({ status: "blocked" });
  });

  it("returns unknown when no keywords found", () => {
    expect(extractDecision("Everything looks good.")).toMatchObject({ status: "unknown" });
  });

  it("truncates detail to 500 chars", () => {
    const longText = "CONTINUE\n" + "x".repeat(600);
    expect(extractDecision(longText).detail.length).toBe(500);
  });

  it("handles empty string", () => {
    expect(extractDecision("")).toMatchObject({ status: "unknown", detail: "" });
  });

  it("handles whitespace-only string", () => {
    expect(extractDecision("   \n  \n  ")).toMatchObject({ status: "unknown", detail: "" });
  });

  it("handles WAITING keyword in body text", () => {
    expect(extractDecision("We are WAITING for approval")).toMatchObject({ status: "waiting" });
  });

  it("handles case-insensitive first line", () => {
    expect(extractDecision("continue with the work")).toMatchObject({ status: "continue" });
  });
});

// ── snapshotOutputs with real filesystem ──

describe("snapshotOutputs", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "mw-test-"));
  });

  it("returns empty map for non-existent dir", () => {
    expect(snapshotOutputs("/tmp/nonexistent-dir-xyz-12345").size).toBe(0);
  });

  it("returns empty map for empty dir", () => {
    expect(snapshotOutputs(tmpDir).size).toBe(0);
  });

  it("captures files in root dir", () => {
    writeFileSync(join(tmpDir, "a.txt"), "hello");
    const snap = snapshotOutputs(tmpDir);
    expect(snap.size).toBe(1);
    expect(snap.has(join(tmpDir, "a.txt"))).toBe(true);
  });

  it("captures files in subdirectories (1 level deep)", () => {
    const sub = join(tmpDir, "sub");
    mkdirSync(sub);
    writeFileSync(join(sub, "b.txt"), "world");
    const snap = snapshotOutputs(tmpDir);
    expect(snap.has(join(sub, "b.txt"))).toBe(true);
  });

  it("captures mix of root and sub files", () => {
    writeFileSync(join(tmpDir, "root.txt"), "r");
    const sub = join(tmpDir, "dir");
    mkdirSync(sub);
    writeFileSync(join(sub, "nested.txt"), "n");
    const snap = snapshotOutputs(tmpDir);
    expect(snap.size).toBe(2);
  });
});

// ── diffSnapshots ──

describe("diffSnapshots", () => {
  it("detects new files", () => {
    const before = new Map<string, number>();
    const after = new Map<string, number>([["/out/a.txt", 100]]);
    expect(diffSnapshots(before, after)).toEqual(["/out/a.txt"]);
  });

  it("detects modified files", () => {
    const before = new Map<string, number>([["/out/a.txt", 100]]);
    const after = new Map<string, number>([["/out/a.txt", 200]]);
    expect(diffSnapshots(before, after)).toEqual(["/out/a.txt"]);
  });

  it("ignores unchanged files", () => {
    const before = new Map<string, number>([["/out/a.txt", 100]]);
    const after = new Map<string, number>([["/out/a.txt", 100]]);
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  it("does not flag deleted files", () => {
    const before = new Map<string, number>([["/out/a.txt", 100]]);
    const after = new Map<string, number>();
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  it("handles both empty", () => {
    expect(diffSnapshots(new Map(), new Map())).toEqual([]);
  });

  it("handles mix of new, modified, unchanged", () => {
    const before = new Map<string, number>([
      ["/out/old.txt", 100],
      ["/out/same.txt", 100],
    ]);
    const after = new Map<string, number>([
      ["/out/old.txt", 200],
      ["/out/same.txt", 100],
      ["/out/new.txt", 300],
    ]);
    const changed = diffSnapshots(before, after);
    expect(changed).toContain("/out/old.txt");
    expect(changed).toContain("/out/new.txt");
    expect(changed).not.toContain("/out/same.txt");
  });
});

// ── System prompts ──

describe("orchestratorSystemPrompt", () => {
  it("includes project dir in prompt", () => {
    const prompt = orchestratorSystemPrompt("/my/project");
    expect(prompt).toContain("/my/project");
    expect(prompt).toContain("orchestrator");
  });

  it("includes decision keywords", () => {
    const prompt = orchestratorSystemPrompt("/p");
    expect(prompt).toContain("CONTINUE");
    expect(prompt).toContain("PIVOT");
    expect(prompt).toContain("BLOCKED");
    expect(prompt).toContain("WAITING");
  });
});

describe("workerSystemPrompt", () => {
  it("includes outputs directory", () => {
    const prompt = workerSystemPrompt("/my/project");
    expect(prompt).toContain("/my/project/outputs");
  });

  it("includes write-first constraint", () => {
    const prompt = workerSystemPrompt("/p");
    expect(prompt).toContain("WRITE-FIRST");
  });
});

// ── Module exports ──

describe("module exports", () => {
  it("exports name", () => {
    expect(name).toBe("master-worker");
  });

  it("exports description", () => {
    expect(typeof description).toBe("string");
    expect(description.length).toBeGreaterThan(0);
  });
});
