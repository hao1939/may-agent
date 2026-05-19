import { describe, it, expect } from "bun:test";
import { formatDigestContext, type DigestRow } from "./session-digest.js";

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

  it("accepts cross-agent digests parameter", () => {
    const own = [makeDigest({ what_happened: "Fixed auth bug" })];
    const cross = [
      makeDigest({
        id: 10,
        agent: "coach",
        what_happened: "Updated H-085 hypothesis",
        files_modified: JSON.stringify(["knowledge/hypotheses/H-085.md"]),
        created_at: 1775400060000,
      }),
    ];
    const result = formatDigestContext(own, cross);
    expect(result).toContain("### Cross-Agent Activity");
    expect(result).toContain("coach");
    expect(result).toContain("Updated H-085 hypothesis");
  });

  it("accepts unresolved digests parameter", () => {
    const own = [makeDigest({ what_happened: "Fixed auth bug" })];
    const unresolved = [
      makeDigest({
        id: 20,
        sessionId: "s_old",
        outcome: "partial",
        what_happened: "Started refactoring",
        still_open: "Need to update 3 more files",
        created_at: 1775380000000,
      }),
    ];
    const result = formatDigestContext(own, [], unresolved);
    expect(result).toContain("### Unresolved Items");
    expect(result).toContain("Need to update 3 more files");
  });

  it("deduplicates unresolved items that are also in main digests", () => {
    const own = [makeDigest({ sessionId: "s_123", still_open: "Some work" })];
    const unresolved = [makeDigest({ sessionId: "s_123", still_open: "Some work" })];
    const result = formatDigestContext(own, [], unresolved);
    expect(result).not.toContain("### Unresolved Items");
  });

  it("uses cleanTaskText fallback when what_happened is null", () => {
    const result = formatDigestContext([
      makeDigest({
        what_happened: null,
        task: "[heartbeat] Read agents/tech-lead/heartbeat.md and work through each section...\n---\nInjected content here",
      }),
    ]);
    // Should clean the task text: strip [heartbeat] prefix, strip after ---
    expect(result).toContain("Heartbeat");
    expect(result).not.toContain("[heartbeat]");
    expect(result).not.toContain("Injected content");
  });

  it("cleans [WORK SESSION] prefix", () => {
    const result = formatDigestContext([
      makeDigest({
        what_happened: null,
        task: "[WORK SESSION] Process EXP-046 results",
      }),
    ]);
    expect(result).toContain("Process EXP-046 results");
    expect(result).not.toContain("[WORK SESSION]");
  });

  it("applies overflow protection for large context", () => {
    // Generate 25 digests with long content — need total > 10,000 chars
    const digests = Array.from({ length: 25 }, (_, i) =>
      makeDigest({
        id: i,
        sessionId: `s_${i}`,
        what_happened: "A".repeat(600),
        files_modified: JSON.stringify(["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"]),
        still_open: "B".repeat(100),
        task: "Long task description that adds to the total character count of each entry item",
        created_at: 1775400000000 + i * 60000,
      }),
    );
    const cross = [
      makeDigest({
        id: 100, agent: "coach", what_happened: "C".repeat(200),
        files_modified: JSON.stringify(["x.ts"]),
      }),
    ];
    const result = formatDigestContext(digests, cross);
    // After overflow protection, should trim to 5 entries and drop cross-agent
    // Cross-agent should be dropped in overflow
    expect(result).not.toContain("### Cross-Agent Activity");
    // Should only have 5 entries (the most recent 5)
    expect(result!.length).toBeLessThan(12000);
  });

  it("shows cross-agent entry with compact format", () => {
    const cross = [
      makeDigest({
        id: 10,
        agent: "tech-lead",
        what_happened: "Deployed new evaluator",
        files_modified: JSON.stringify(["src/lib/evaluator.ts"]),
        created_at: 1775400000000, // 2026-04-05 14:40 UTC
      }),
    ];
    const result = formatDigestContext([makeDigest({})], cross);
    // Cross-agent should show "agent HH:MM: what"
    expect(result).toContain("tech-lead 14:40:");
    expect(result).toContain("Deployed new evaluator");
  });

  it("returns content when only cross-agent digests provided", () => {
    const cross = [
      makeDigest({
        agent: "coach",
        what_happened: "Updated hypothesis",
      }),
    ];
    const result = formatDigestContext([], cross, []);
    expect(result).toContain("### Cross-Agent Activity");
    expect(result).toContain("Updated hypothesis");
  });
});
