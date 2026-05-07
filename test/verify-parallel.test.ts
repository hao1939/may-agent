import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * verify-parallel — QA identity policy tests
 *
 * The verify-parallel workflow files were removed, but the QA identity file
 * still has the Parallel Auditor Protocol that guides adversarial review.
 * These tests ensure that protocol remains in place.
 */

// ── QA Identity Auditor Protocol ─────────────────────────────────────────

function readQaIdentity(): string {
  return readFileSync(join(process.cwd(), "agents/qa/SOUL.md"), "utf-8");
}

describe("verify-parallel: QA AGENTS.md policy", () => {
  it("QA identity contains Parallel Auditor Protocol section", () => {
    const identity = readQaIdentity();
    expect(identity).toContain("Parallel Auditor");
    expect(identity).toContain("CONFIRMED");
  });

  it("QA identity requires addressing auditor findings", () => {
    const identity = readQaIdentity();
    expect(identity).toContain("CONFIRMED");
    expect(identity).toContain("FALSE POSITIVE");
    expect(identity).toContain("ALREADY ADDRESSED");
    expect(identity).toContain("Cannot PASS if any CONFIRMED finding is unaddressed");
  });

  it("QA identity has constraint against dismissing auditor findings without evidence", () => {
    const identity = readQaIdentity();
    expect(identity).toContain("Never Dismiss Auditor Findings Without Evidence");
    expect(identity).toContain("specific evidence");
  });
});
