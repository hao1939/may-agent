import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * verify-parallel — QA SOUL.md policy tests
 *
 * The verify-parallel workflow files were removed, but the QA SOUL.md
 * still has the Parallel Auditor Protocol that guides adversarial review.
 * These tests ensure that protocol remains in place.
 */

// ── QA SOUL.md Auditor Protocol ────────────────────────────────────────

describe("verify-parallel: QA SOUL.md policy", () => {
  it("QA SOUL.md contains Parallel Auditor Protocol section", () => {
    const soul = readFileSync(join(process.cwd(), "agents/qa/SOUL.md"), "utf-8");
    expect(soul).toContain("Parallel Auditor");
    expect(soul).toContain("CONFIRMED");
  });

  it("QA SOUL.md requires addressing auditor findings", () => {
    const soul = readFileSync(join(process.cwd(), "agents/qa/SOUL.md"), "utf-8");
    expect(soul).toContain("CONFIRMED");
    expect(soul).toContain("FALSE POSITIVE");
    expect(soul).toContain("ALREADY ADDRESSED");
    expect(soul).toContain("Cannot PASS if any CONFIRMED finding is unaddressed");
  });

  it("QA SOUL.md has constraint against dismissing auditor findings without evidence", () => {
    const soul = readFileSync(join(process.cwd(), "agents/qa/SOUL.md"), "utf-8");
    // The constraint is expressed as requiring independent verification of each finding
    expect(soul).toContain("verify each independently");
  });
});
