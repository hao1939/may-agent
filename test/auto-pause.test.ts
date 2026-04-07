/**
 * auto-pause.test.ts — Tests for DB-based auto-pause (R39).
 *
 * Tests that agents with 3+ consecutive error sessions are paused,
 * and that a successful session auto-unpauses them.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the requests module to provide a fake DB
const mockRows: { status: string }[] = [];
vi.mock("../src/lib/requests.js", () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      all: vi.fn((_agent: string, _limit: number) => mockRows),
    })),
  })),
}));

import { isAgentAutoPaused, AUTO_PAUSE_THRESHOLD } from "../src/lib/auto-pause.js";

describe("isAgentAutoPaused", () => {
  beforeEach(() => {
    mockRows.length = 0;
  });

  it("returns false when agent has no sessions", () => {
    // mockRows is empty
    expect(isAgentAutoPaused("/fake", "new-agent")).toBe(false);
  });

  it("returns false when agent has fewer than threshold sessions", () => {
    mockRows.push({ status: "error" }, { status: "error" });
    expect(isAgentAutoPaused("/fake", "some-agent")).toBe(false);
  });

  it("returns true when last 3 sessions are all errors", () => {
    mockRows.push({ status: "error" }, { status: "error" }, { status: "error" });
    expect(isAgentAutoPaused("/fake", "failing-agent")).toBe(true);
  });

  it("returns false when only 2 of last 3 are errors (most recent is done)", () => {
    // Ordered by startedAt DESC, so first element is most recent
    mockRows.push({ status: "done" }, { status: "error" }, { status: "error" });
    expect(isAgentAutoPaused("/fake", "recovering-agent")).toBe(false);
  });

  it("returns false when only 2 of last 3 are errors (oldest is done)", () => {
    mockRows.push({ status: "error" }, { status: "error" }, { status: "done" });
    expect(isAgentAutoPaused("/fake", "mixed-agent")).toBe(false);
  });

  it("self-healing: 3 errors then 1 success → not paused", () => {
    // After success, the last 3 are: [done, error, error] — not all errors
    mockRows.push({ status: "done" }, { status: "error" }, { status: "error" });
    expect(isAgentAutoPaused("/fake", "healed-agent")).toBe(false);
  });

  it("returns false when all sessions are done (healthy agent)", () => {
    mockRows.push({ status: "done" }, { status: "done" }, { status: "done" });
    expect(isAgentAutoPaused("/fake", "healthy-agent")).toBe(false);
  });

  it("returns false when sessions include interrupted but not all errors", () => {
    mockRows.push({ status: "error" }, { status: "interrupted" }, { status: "error" });
    expect(isAgentAutoPaused("/fake", "interrupted-agent")).toBe(false);
  });

  it("returns true with more than 3 errors (only checks last N)", () => {
    // The query limits to threshold, so even if there are more errors,
    // only the last 3 are checked
    mockRows.push({ status: "error" }, { status: "error" }, { status: "error" });
    expect(isAgentAutoPaused("/fake", "very-broken-agent")).toBe(true);
  });

  it("supports custom threshold", () => {
    // With threshold=2, only 2 errors needed
    mockRows.push({ status: "error" }, { status: "error" });
    expect(isAgentAutoPaused("/fake", "custom-agent", 2)).toBe(true);
  });

  it("custom threshold: not paused when below threshold", () => {
    mockRows.push({ status: "error" });
    expect(isAgentAutoPaused("/fake", "custom-agent", 2)).toBe(false);
  });

  it("exports AUTO_PAUSE_THRESHOLD as 3", () => {
    expect(AUTO_PAUSE_THRESHOLD).toBe(3);
  });

  it("returns false when DB throws (fail-open)", async () => {
    // Override mock to throw by using vi.mocked on the imported module
    const requestsMod = await import("../src/lib/requests.js");
    const mockedGetDb = vi.mocked(requestsMod.getDb);
    mockedGetDb.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    expect(isAgentAutoPaused("/fake", "any-agent")).toBe(false);
  });
});
