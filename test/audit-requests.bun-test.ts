import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getDb,
  closeDb,
  trackRequest,
  updateRequest,
  getRequest,
  getActiveRequests,
  getStaleRequests,
  archiveOld,
} from "../src/lib/requests";

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "audit-requests-test-"));
});

afterEach(() => {
  closeDb(testDir);
  rmSync(testDir, { recursive: true, force: true });
});

describe("audit-requests scenarios", () => {
  test("getStaleRequests finds CREATED requests older than threshold", () => {
    // Create a request with a timestamp 3 hours ago
    const reqId = trackRequest(testDir, {
      fromEntity: "human",
      toAgent: "tech-lead",
      method: "chat",
      task: "old task",
    });
    // Manually backdate the createdAt
    const db = getDb(testDir);
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    db.run("UPDATE requests SET createdAt = ?, updatedAt = ? WHERE requestId = ?", [
      threeHoursAgo,
      threeHoursAgo,
      reqId,
    ]);

    const stale = getStaleRequests(testDir, 2 * 60 * 60 * 1000);
    expect(stale).toHaveLength(1);
    expect(stale[0].requestId).toBe(reqId);
    expect(stale[0].status).toBe("CREATED");
  });

  test("getStaleRequests does not find recent CREATED requests", () => {
    trackRequest(testDir, {
      fromEntity: "human",
      toAgent: "tech-lead",
      method: "chat",
      task: "recent task",
    });

    const stale = getStaleRequests(testDir, 2 * 60 * 60 * 1000);
    expect(stale).toHaveLength(0);
  });

  test("getStaleRequests finds IN_PROGRESS requests older than threshold", () => {
    const reqId = trackRequest(testDir, {
      fromEntity: "may",
      toAgent: "tech-lead",
      method: "send",
      task: "stale in-progress task",
    });
    updateRequest(testDir, reqId, { status: "IN_PROGRESS", sessionId: "s_old_session" });

    // Backdate
    const db = getDb(testDir);
    const fiveHoursAgo = Date.now() - 5 * 60 * 60 * 1000;
    db.run("UPDATE requests SET createdAt = ?, updatedAt = ? WHERE requestId = ?", [fiveHoursAgo, fiveHoursAgo, reqId]);

    const stale = getStaleRequests(testDir, 4 * 60 * 60 * 1000);
    expect(stale).toHaveLength(1);
    expect(stale[0].status).toBe("IN_PROGRESS");
  });

  test("resetting orphaned IN_PROGRESS requests to CREATED", () => {
    const reqId = trackRequest(testDir, {
      fromEntity: "may",
      toAgent: "coder",
      method: "call",
      task: "orphaned task",
    });
    updateRequest(testDir, reqId, { status: "IN_PROGRESS", sessionId: "s_dead_session" });

    // Backdate
    const db = getDb(testDir);
    const fiveHoursAgo = Date.now() - 5 * 60 * 60 * 1000;
    db.run("UPDATE requests SET createdAt = ?, updatedAt = ? WHERE requestId = ?", [fiveHoursAgo, fiveHoursAgo, reqId]);

    // Simulate the audit reset
    const stale = getStaleRequests(testDir, 4 * 60 * 60 * 1000).filter((r) => r.status === "IN_PROGRESS");
    expect(stale).toHaveLength(1);

    updateRequest(testDir, reqId, { status: "CREATED" });
    const updated = getRequest(testDir, reqId);
    expect(updated?.status).toBe("CREATED");
  });

  test("archiveOld removes completed requests older than threshold", () => {
    const reqId = trackRequest(testDir, {
      fromEntity: "tech-lead",
      toAgent: "coder",
      method: "call",
      task: "completed old task",
    });
    updateRequest(testDir, reqId, {
      status: "COMPLETED",
      summary: "Done",
      completedAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
    });

    const archived = archiveOld(testDir, 7);
    expect(archived).toBe(1);

    // Verify it's gone
    const req = getRequest(testDir, reqId);
    expect(req).toBeNull();
  });

  test("archiveOld does not remove recent completed requests", () => {
    const reqId = trackRequest(testDir, {
      fromEntity: "tech-lead",
      toAgent: "coder",
      method: "call",
      task: "recently completed task",
    });
    updateRequest(testDir, reqId, {
      status: "COMPLETED",
      summary: "Done recently",
      completedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
    });

    const archived = archiveOld(testDir, 7);
    expect(archived).toBe(0);

    // Verify it's still there
    const req = getRequest(testDir, reqId);
    expect(req).not.toBeNull();
    expect(req?.status).toBe("COMPLETED");
  });

  test("archiveOld does not remove active requests", () => {
    const reqId = trackRequest(testDir, {
      fromEntity: "may",
      toAgent: "tech-lead",
      method: "send",
      task: "still active old task",
    });
    // Backdate but keep CREATED status
    const db = getDb(testDir);
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
    db.run("UPDATE requests SET createdAt = ?, updatedAt = ? WHERE requestId = ?", [tenDaysAgo, tenDaysAgo, reqId]);

    const archived = archiveOld(testDir, 7);
    expect(archived).toBe(0); // Still CREATED, not archived

    const req = getRequest(testDir, reqId);
    expect(req).not.toBeNull();
  });

  test("getActiveRequests returns only CREATED and IN_PROGRESS", () => {
    const req1 = trackRequest(testDir, {
      fromEntity: "human",
      toAgent: "tech-lead",
      method: "chat",
      task: "task 1",
    });
    const req2 = trackRequest(testDir, {
      fromEntity: "may",
      toAgent: "coder",
      method: "call",
      task: "task 2",
    });
    updateRequest(testDir, req2, { status: "IN_PROGRESS" });

    const req3 = trackRequest(testDir, {
      fromEntity: "tech-lead",
      toAgent: "qa",
      method: "call",
      task: "task 3",
    });
    updateRequest(testDir, req3, { status: "COMPLETED", completedAt: Date.now() });

    const active = getActiveRequests(testDir);
    expect(active).toHaveLength(2);
    const ids = active.map((r) => r.requestId);
    expect(ids).toContain(req1);
    expect(ids).toContain(req2);
    expect(ids).not.toContain(req3);
  });
});
