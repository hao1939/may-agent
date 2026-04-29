import { describe, it, expect } from "vitest";

// ── Replicate pure functions from master-worker.ts for testing ──

interface Decision {
  status: "continue" | "pivot" | "waiting" | "blocked" | "unknown";
  detail: string;
}

function extractDecision(text: string): Decision {
  const trimmed = text.trim();
  const firstLine = trimmed.split("\n")[0] || "";
  const upper = firstLine.toUpperCase();

  for (const s of ["CONTINUE", "PIVOT", "WAITING", "BLOCKED", "DONE"] as const) {
    if (upper.startsWith(s)) {
      return { status: s.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  const decisionPattern = /(?:\*{0,2}Decision\*{0,2}[:\s]+\*{0,2}|^|\n)\*{0,2}(CONTINUE|PIVOT|BLOCKED|WAITING|DONE)\*{0,2}/im;
  const patternMatch = trimmed.match(decisionPattern);
  if (patternMatch) {
    return { status: patternMatch[1].toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
  }

  if (/\b(proceed|move forward|start working|begin work|let'?s begin|let'?s start)\b/i.test(trimmed)) {
    return { status: "continue", detail: trimmed.slice(0, 500) };
  }

  for (const keyword of ["CONTINUE", "PIVOT", "BLOCKED", "WAITING"] as const) {
    if (new RegExp(`\\b${keyword}\\b`).test(trimmed)) {
      return { status: keyword.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  return { status: "unknown", detail: trimmed.slice(0, 500) };
}

function snapshotOutputs(entries: { path: string; mtime: number }[]): Map<string, number> {
  const snap = new Map<string, number>();
  for (const e of entries) snap.set(e.path, e.mtime);
  return snap;
}

function diffSnapshots(before: Map<string, number>, after: Map<string, number>): string[] {
  const changed: string[] = [];
  for (const [path, mtime] of after) {
    const prev = before.get(path);
    if (prev === undefined || mtime > prev) {
      changed.push(path);
    }
  }
  return changed;
}

// ── Tests ──

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

  it("parses DONE as first word (maps to lowercase)", () => {
    // DONE maps to "done" which becomes Decision["status"] — but type says "unknown"
    // Actually checking the code: "done" is not in the union, so it casts to Decision["status"]
    const result = extractDecision("DONE\n\nAll finished");
    expect(result.status).toBe("done");
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
    const result = extractDecision("I think we should proceed with the current plan.");
    expect(result.status).toBe("continue");
  });

  it("detects 'let's begin' as continue", () => {
    expect(extractDecision("Let's begin working on the tests.")).toMatchObject({ status: "continue" });
  });

  it("detects 'move forward' as continue", () => {
    expect(extractDecision("We should move forward with implementation.")).toMatchObject({ status: "continue" });
  });

  it("falls back to uppercase keyword scan", () => {
    const result = extractDecision("After reviewing, I think we are BLOCKED by the missing API key.");
    expect(result.status).toBe("blocked");
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

  it("is case-insensitive for first-line check", () => {
    expect(extractDecision("continue with the work")).toMatchObject({ status: "continue" });
  });
});

describe("diffSnapshots", () => {
  it("detects new files", () => {
    const before = snapshotOutputs([]);
    const after = snapshotOutputs([{ path: "/out/a.txt", mtime: 100 }]);
    expect(diffSnapshots(before, after)).toEqual(["/out/a.txt"]);
  });

  it("detects modified files", () => {
    const before = snapshotOutputs([{ path: "/out/a.txt", mtime: 100 }]);
    const after = snapshotOutputs([{ path: "/out/a.txt", mtime: 200 }]);
    expect(diffSnapshots(before, after)).toEqual(["/out/a.txt"]);
  });

  it("ignores unchanged files", () => {
    const before = snapshotOutputs([{ path: "/out/a.txt", mtime: 100 }]);
    const after = snapshotOutputs([{ path: "/out/a.txt", mtime: 100 }]);
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  it("detects deleted files are not flagged (only in after)", () => {
    const before = snapshotOutputs([{ path: "/out/a.txt", mtime: 100 }]);
    const after = snapshotOutputs([]);
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  it("handles mix of new, modified, unchanged", () => {
    const before = snapshotOutputs([
      { path: "/out/old.txt", mtime: 100 },
      { path: "/out/same.txt", mtime: 100 },
    ]);
    const after = snapshotOutputs([
      { path: "/out/old.txt", mtime: 200 },
      { path: "/out/same.txt", mtime: 100 },
      { path: "/out/new.txt", mtime: 300 },
    ]);
    const changed = diffSnapshots(before, after);
    expect(changed).toContain("/out/old.txt");
    expect(changed).toContain("/out/new.txt");
    expect(changed).not.toContain("/out/same.txt");
  });
});
