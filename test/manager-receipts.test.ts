import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkErrorLogReviewed,
  enforceReplayCheck,
  markErrorLogReviewed,
  CRITICAL_ACTIONS,
} from "../src/lib/manager-receipts.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let TMP_BASE: string;

beforeEach(() => {
  TMP_BASE = mkdtempSync(join(tmpdir(), "manager-receipts-test-"));
});

afterEach(() => {
  vi.useRealTimers();
  if (existsSync(TMP_BASE)) {
    rmSync(TMP_BASE, { recursive: true, force: true });
  }
});

describe("checkErrorLogReviewed", () => {
  it("returns false when no receipts exist", () => {
    expect(checkErrorLogReviewed(TMP_BASE)).toBe(false);
  });

  it("returns true after markErrorLogReviewed is called", () => {
    markErrorLogReviewed("may", TMP_BASE);
    expect(checkErrorLogReviewed(TMP_BASE)).toBe(true);
  });

  it("returns false for old receipts (>2 hours)", () => {
    // Pin clock to a known time so the receipt timestamp is controlled
    const baseTime = new Date("2026-01-15T10:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    // Mark review at the pinned time (receipt gets timestamp 2026-01-15T10:00:00.000Z)
    markErrorLogReviewed("may", TMP_BASE);

    // Advance clock by 2 hours + 1 minute past the review
    vi.setSystemTime(baseTime + 2 * 60 * 60 * 1000 + 60_000);

    expect(checkErrorLogReviewed(TMP_BASE)).toBe(false);
  });
});

describe("enforceReplayCheck", () => {
  it("blocks critical action without review", () => {
    const result = enforceReplayCheck("deploy", TMP_BASE);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Must review error logs");
    expect(result.reason).toContain("deploy");
  });

  it("allows critical action after review", () => {
    markErrorLogReviewed("may", TMP_BASE);
    const result = enforceReplayCheck("deploy", TMP_BASE);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("Error log reviewed");
  });

  it("allows non-critical action without review", () => {
    const result = enforceReplayCheck("list-files", TMP_BASE);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("Non-critical action, no review required");
  });
});

describe("CRITICAL_ACTIONS", () => {
  it("contains expected entries", () => {
    expect(CRITICAL_ACTIONS).toContain("deploy");
    expect(CRITICAL_ACTIONS).toContain("rollback");
    expect(CRITICAL_ACTIONS).toContain("delete");
    expect(CRITICAL_ACTIONS).toContain("promote");
    expect(CRITICAL_ACTIONS).toContain("discard");
    expect(CRITICAL_ACTIONS).toContain("git-push");
    expect(CRITICAL_ACTIONS).toContain("schema-migrate");
    expect(CRITICAL_ACTIONS).toHaveLength(7);
  });
});
