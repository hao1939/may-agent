import { describe, it, expect } from "vitest";
import {
  classifySession,
  planCleanup,
  generateReport,
  archiveSession,
  getCleanupStats,
  type SessionRecord,
  type CleanupConfig,
} from "./session-cleanup.js";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NOW = 1710000000000; // Fixed timestamp for tests
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const config: CleanupConfig = {
  maxAge: 7 * DAY,
  staleThreshold: 2 * HOUR,
  costCeiling: 5.00,
  archiveDir: ".state/archive",
};

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "s_test_1",
    agent: "coder",
    startedAt: NOW - 1 * DAY,
    lastActive: NOW - 30 * 60 * 1000, // 30 min ago
    status: "completed",
    turnCount: 10,
    costUsd: 0.50,
    ...overrides,
  };
}

describe("classifySession", () => {
  it("keeps active sessions regardless of age", () => {
    const session = makeSession({
      status: "active",
      startedAt: NOW - 30 * DAY, // very old
    });
    expect(classifySession(session, NOW, config)).toBe("keep");
  });

  it("flags high-cost sessions for review", () => {
    const session = makeSession({
      status: "completed",
      costUsd: 6.29,
      startedAt: NOW - 1 * DAY,
    });
    expect(classifySession(session, NOW, config)).toBe("flag");
  });

  it("archives old completed sessions", () => {
    const session = makeSession({
      status: "completed",
      startedAt: NOW - 8 * DAY, // older than 7 days
    });
    expect(classifySession(session, NOW, config)).toBe("archive");
  });

  it("purges old errored sessions", () => {
    const session = makeSession({
      status: "errored",
      startedAt: NOW - 8 * DAY,
    });
    expect(classifySession(session, NOW, config)).toBe("purge");
  });

  it("purges orphaned sessions past stale threshold", () => {
    const session = makeSession({
      status: "orphaned",
      lastActive: NOW - 3 * HOUR, // 3 hours idle > 2 hour threshold
    });
    expect(classifySession(session, NOW, config)).toBe("purge");
  });

  it("keeps recent completed sessions", () => {
    const session = makeSession({
      status: "completed",
      startedAt: NOW - 1 * DAY,
    });
    expect(classifySession(session, NOW, config)).toBe("keep");
  });

  it("keeps orphaned sessions within stale threshold", () => {
    const session = makeSession({
      status: "orphaned",
      lastActive: NOW - 1 * HOUR, // 1 hour < 2 hour threshold
    });
    expect(classifySession(session, NOW, config)).toBe("keep");
  });

  // Boundary test: sessions exactly at maxAge should be treated consistently
  it("handles boundary: completed session exactly at maxAge is archived", () => {
    const session = makeSession({
      status: "completed",
      startedAt: NOW - 7 * DAY, // exactly at maxAge boundary
    });
    expect(classifySession(session, NOW, config)).toBe("archive");
  });

  it("handles boundary: errored session exactly at maxAge is purged", () => {
    const session = makeSession({
      status: "errored",
      startedAt: NOW - 7 * DAY, // exactly at maxAge boundary
    });
    expect(classifySession(session, NOW, config)).toBe("purge");
  });

  it("handles boundary: orphaned session exactly at staleThreshold is purged", () => {
    const session = makeSession({
      status: "orphaned",
      lastActive: NOW - 2 * HOUR, // exactly at staleThreshold boundary
    });
    expect(classifySession(session, NOW, config)).toBe("purge");
  });

  it("cost flag takes priority over age-based archive", () => {
    const session = makeSession({
      status: "completed",
      startedAt: NOW - 30 * DAY,
      costUsd: 10.00,
    });
    expect(classifySession(session, NOW, config)).toBe("flag");
  });
});

describe("planCleanup", () => {
  it("groups sessions by action", () => {
    const sessions = [
      makeSession({ id: "s_1", status: "active" }),
      makeSession({ id: "s_2", status: "completed", startedAt: NOW - 8 * DAY }),
      makeSession({ id: "s_3", status: "errored", startedAt: NOW - 8 * DAY }),
      makeSession({ id: "s_4", status: "completed", costUsd: 6.00 }),
      makeSession({ id: "s_5", status: "orphaned", lastActive: NOW - 3 * HOUR }),
    ];
    const plan = planCleanup(sessions, NOW, config);
    expect(plan.keep).toContain("s_1");
    expect(plan.archive).toContain("s_2");
    expect(plan.purge).toContain("s_3");
    expect(plan.flag).toContain("s_4");
    expect(plan.purge).toContain("s_5");
  });

  it("returns empty arrays when no sessions match", () => {
    const plan = planCleanup([], NOW, config);
    expect(plan.keep).toEqual([]);
    expect(plan.archive).toEqual([]);
    expect(plan.flag).toEqual([]);
    expect(plan.purge).toEqual([]);
  });
});

describe("generateReport", () => {
  it("produces markdown with summary table", () => {
    const sessions = [
      makeSession({ id: "s_1", status: "completed", startedAt: NOW - 8 * DAY }),
    ];
    const plan = planCleanup(sessions, NOW, config);
    const report = generateReport(plan, sessions);
    expect(report).toContain("# Session Cleanup Report");
    expect(report).toContain("| archive |");
    expect(report).toContain("s_1");
  });

  it("includes cost analysis section", () => {
    const sessions = [
      makeSession({ id: "s_1", costUsd: 1.50 }),
      makeSession({ id: "s_2", costUsd: 2.50 }),
    ];
    const plan = planCleanup(sessions, NOW, config);
    const report = generateReport(plan, sessions);
    expect(report).toContain("## Cost Analysis");
    expect(report).toContain("$4.00");
  });
});

describe("archiveSession", () => {
  it("writes session JSON to archive directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "cleanup-test-"));
    const archiveDir = join(dir, "archive");
    const session = makeSession({ id: "s_archive_1" });
    const filePath = archiveSession(session, archiveDir);
    expect(existsSync(filePath)).toBe(true);
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(data.id).toBe("s_archive_1");
    expect(data.agent).toBe("coder");
  });
});

describe("getCleanupStats", () => {
  it("calculates aggregate statistics", () => {
    const sessions = [
      makeSession({ id: "s_1", agent: "coder", turnCount: 10, costUsd: 1.0 }),
      makeSession({ id: "s_2", agent: "coder", turnCount: 20, costUsd: 2.0 }),
      makeSession({ id: "s_3", agent: "qa", turnCount: 5, costUsd: 0.5 }),
    ];
    const stats = getCleanupStats(sessions);
    expect(stats.totalSessions).toBe(3);
    expect(stats.totalCost).toBeCloseTo(3.5);
    expect(stats.avgTurns).toBeCloseTo(11.67, 1);
    expect(stats.byAgent["coder"]).toBe(2);
    expect(stats.byAgent["qa"]).toBe(1);
  });

  it("handles empty session list", () => {
    const stats = getCleanupStats([]);
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalCost).toBe(0);
    expect(stats.avgTurns).toBe(0);
  });
});
