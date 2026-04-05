import { describe, it, expect } from "vitest";
import { formatDigestContext, type DigestRow } from "../src/lib/session-digest.js";

function makeDigest(overrides: Partial<DigestRow>): DigestRow {
  return {
    id: 1,
    sessionId: "s_test",
    agent: "tech-lead",
    trigger: "end",
    step: 2,
    task: "Fix the auth module bug",
    what_happened: "Found and fixed null pointer in auth.ts line 42",
    outcome: "success",
    still_open: null,
    files_modified: null,
    details: JSON.stringify({ duration: "3m12s", turnCount: 15, opCount: 10 }),
    action: null,
    action_reason: null,
    created_at: 1775400000000, // 2026-04-05T14:40:00Z
    ...overrides,
  };
}

describe("formatDigestContext", () => {
  it("returns null for empty digests", () => {
    expect(formatDigestContext([])).toBeNull();
  });

  it("formats a single digest", () => {
    const result = formatDigestContext([makeDigest({})]);
    expect(result).toContain("Fix the auth module bug");
    expect(result).toContain("success");
    expect(result).toContain("3m12s");
    expect(result).toContain("Found and fixed null pointer in auth.ts line 42");
  });

  it("reverses DESC order to chronological", () => {
    const digests = [
      makeDigest({ id: 2, created_at: 1775400060000, task: "Second task" }),
      makeDigest({ id: 1, created_at: 1775400000000, task: "First task" }),
    ];
    const result = formatDigestContext(digests)!;
    const firstIdx = result.indexOf("First task");
    const secondIdx = result.indexOf("Second task");
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it("includes files_modified", () => {
    const result = formatDigestContext([
      makeDigest({ files_modified: JSON.stringify(["src/auth.ts", "test/auth.test.ts"]) }),
    ]);
    expect(result).toContain("files: src/auth.ts, test/auth.test.ts");
  });

  it("truncates files_modified to 5", () => {
    const files = ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts", "g.ts"];
    const result = formatDigestContext([
      makeDigest({ files_modified: JSON.stringify(files) }),
    ]);
    expect(result).toContain("e.ts...");
    expect(result).not.toContain("f.ts");
  });

  it("includes still_open", () => {
    const result = formatDigestContext([
      makeDigest({ still_open: "Need to add retry logic" }),
    ]);
    expect(result).toContain("open: Need to add retry logic");
  });

  it("handles null what_happened", () => {
    const result = formatDigestContext([
      makeDigest({ what_happened: null }),
    ]);
    expect(result).toBeTruthy();
    expect(result).toContain("success");
    expect(result).toContain("3m12s");
  });

  it("handles null details", () => {
    const result = formatDigestContext([
      makeDigest({ details: null }),
    ]);
    expect(result).toBeTruthy();
    expect(result).toContain("success");
    // No duration string
    expect(result).not.toContain("3m12s");
  });

  it("uses trigger as outcome fallback", () => {
    const result = formatDigestContext([
      makeDigest({ outcome: null, trigger: "checkpoint" }),
    ]);
    expect(result).toContain("checkpoint");
  });

  it("truncates long task text", () => {
    const longTask = "A".repeat(200);
    const result = formatDigestContext([makeDigest({ task: longTask })]);
    // Should be truncated to 120 chars with ellipsis
    expect(result!.length).toBeLessThan(500);
    expect(result).toContain("…");
  });

  it("handles malformed files_modified JSON", () => {
    const result = formatDigestContext([
      makeDigest({ files_modified: "not-json" }),
    ]);
    // Should not throw, just skip the files line
    expect(result).toBeTruthy();
    expect(result).not.toContain("files:");
  });
});
