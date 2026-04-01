import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getDb,
  closeDb,
  trackRequest,
  updateRequest,
  getRequest,
  getActiveRequests,
  getRequestsByAgent,
  getRequestTree,
  getStaleRequests,
  isDuplicate,
  archiveOld,
  classifyError,
} from "../src/lib/requests";

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "requests-test-"));
});

afterEach(() => {
  closeDb(testDir);
  rmSync(testDir, { recursive: true, force: true });
});

describe("getDb", () => {
  test("creates database with schema", () => {
    const db = getDb(testDir);
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'").all();
    expect(tables).toHaveLength(1);
  });

  test("returns cached instance on second call", () => {
    const db1 = getDb(testDir);
    const db2 = getDb(testDir);
    expect(db1).toBe(db2);
  });

  test("creates indexes", () => {
    const db = getDb(testDir);
    const indexes = db.query("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='requests'").all() as {
      name: string;
    }[];
    const names = indexes.map((i) => i.name);
    expect(names).toContain("idx_status");
    expect(names).toContain("idx_to_agent");
    expect(names).toContain("idx_parent");
    expect(names).toContain("idx_created");
  });
});

describe("trackRequest", () => {
  test("creates a request and returns requestId", () => {
    const id = trackRequest(testDir, {
      fromEntity: "human",
      toAgent: "tech-lead",
      task: "Fix the bug",
      method: "chat",
    });
    expect(id).toBeTruthy();
    const record = getRequest(testDir, id);
    expect(record).not.toBeNull();
    expect(record!.fromEntity).toBe("human");
    expect(record!.toAgent).toBe("tech-lead");
    expect(record!.task).toBe("Fix the bug");
    expect(record!.method).toBe("chat");
    expect(record!.status).toBe("CREATED");
  });

  test("truncates task to 500 characters", () => {
    const id = trackRequest(testDir, {
      fromEntity: "bob",
      toAgent: "tech-lead",
      task: "x".repeat(1000),
      method: "send",
    });
    expect(getRequest(testDir, id)!.task).toHaveLength(500);
  });

  test("stores optional fields", () => {
    const id = trackRequest(testDir, {
      fromEntity: "bob",
      toAgent: "tech-lead",
      task: "Review design",
      method: "send",
      artifact: "agents/bob/workspace/brief.md",
      context: "Closes P70 gap",
      expectations: "Review and approve",
      notify: ["coach", "may"],
    });
    const r = getRequest(testDir, id)!;
    expect(r.artifact).toBe("agents/bob/workspace/brief.md");
    expect(r.context).toBe("Closes P70 gap");
    expect(r.expectations).toBe("Review and approve");
    expect(JSON.parse(r.notify!)).toEqual(["coach", "may"]);
  });

  test("stores parentRequestId", () => {
    const parentId = trackRequest(testDir, { fromEntity: "human", toAgent: "may", task: "Deploy", method: "chat" });
    const childId = trackRequest(testDir, {
      fromEntity: "may",
      toAgent: "tech-lead",
      task: "Implement",
      method: "call",
      parentRequestId: parentId,
    });
    expect(getRequest(testDir, childId)!.parentRequestId).toBe(parentId);
  });
});

describe("updateRequest", () => {
  test("updates status and sessionId", () => {
    const id = trackRequest(testDir, { fromEntity: "human", toAgent: "tech-lead", task: "Build", method: "chat" });
    updateRequest(testDir, id, { status: "IN_PROGRESS", sessionId: "s_123" });
    const r = getRequest(testDir, id)!;
    expect(r.status).toBe("IN_PROGRESS");
    expect(r.sessionId).toBe("s_123");
  });

  test("sets retryable=1 for infra errors", () => {
    const id = trackRequest(testDir, { fromEntity: "human", toAgent: "tech-lead", task: "Build", method: "chat" });
    updateRequest(testDir, id, { status: "FAILED", error: "timeout", errorClass: "infra" });
    expect(getRequest(testDir, id)!.retryable).toBe(1);
  });

  test("sets retryable=0 for logic errors", () => {
    const id = trackRequest(testDir, { fromEntity: "human", toAgent: "tech-lead", task: "Build", method: "chat" });
    updateRequest(testDir, id, { status: "FAILED", error: "Permission denied", errorClass: "logic" });
    expect(getRequest(testDir, id)!.retryable).toBe(0);
  });

  test("updates summary and completedAt", () => {
    const id = trackRequest(testDir, { fromEntity: "human", toAgent: "tech-lead", task: "Build", method: "chat" });
    const now = Date.now();
    updateRequest(testDir, id, { status: "COMPLETED", summary: "Done", completedAt: now, durationMs: 5000 });
    const r = getRequest(testDir, id)!;
    expect(r.summary).toBe("Done");
    expect(r.completedAt).toBe(now);
    expect(r.durationMs).toBe(5000);
  });
});

describe("getActiveRequests", () => {
  test("returns only CREATED and IN_PROGRESS", () => {
    trackRequest(testDir, { fromEntity: "a", toAgent: "b", task: "1", method: "send" });
    const id2 = trackRequest(testDir, { fromEntity: "a", toAgent: "c", task: "2", method: "send" });
    updateRequest(testDir, id2, { status: "IN_PROGRESS" });
    const id3 = trackRequest(testDir, { fromEntity: "a", toAgent: "d", task: "3", method: "send" });
    updateRequest(testDir, id3, { status: "COMPLETED" });

    const active = getActiveRequests(testDir);
    expect(active).toHaveLength(2);
    expect(active.map((r) => r.task)).toEqual(["1", "2"]);
  });

  test("returns empty when no active requests", () => {
    expect(getActiveRequests(testDir)).toEqual([]);
  });
});

describe("getRequestsByAgent", () => {
  test("returns requests for specific agent", () => {
    trackRequest(testDir, { fromEntity: "a", toAgent: "tech-lead", task: "1", method: "send" });
    trackRequest(testDir, { fromEntity: "a", toAgent: "coder", task: "2", method: "send" });
    trackRequest(testDir, { fromEntity: "b", toAgent: "tech-lead", task: "3", method: "call" });
    const r = getRequestsByAgent(testDir, "tech-lead");
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.toAgent === "tech-lead")).toBe(true);
  });
});

describe("getRequestTree", () => {
  test("returns full hierarchy", () => {
    const rootId = trackRequest(testDir, { fromEntity: "human", toAgent: "may", task: "Deploy", method: "chat" });
    const childId = trackRequest(testDir, {
      fromEntity: "may",
      toAgent: "tech-lead",
      task: "Implement",
      method: "call",
      parentRequestId: rootId,
    });
    trackRequest(testDir, {
      fromEntity: "tech-lead",
      toAgent: "coder",
      task: "Code",
      method: "call",
      parentRequestId: childId,
    });
    trackRequest(testDir, { fromEntity: "human", toAgent: "bob", task: "Unrelated", method: "chat" });

    const tree = getRequestTree(testDir, rootId);
    expect(tree).toHaveLength(3);
    expect(tree[0].task).toBe("Deploy");
    expect(tree[1].task).toBe("Implement");
    expect(tree[2].task).toBe("Code");
  });

  test("returns single node when no children", () => {
    const id = trackRequest(testDir, { fromEntity: "human", toAgent: "may", task: "Solo", method: "chat" });
    expect(getRequestTree(testDir, id)).toHaveLength(1);
  });
});

describe("getStaleRequests", () => {
  test("returns requests older than maxAgeMs", () => {
    const id = trackRequest(testDir, { fromEntity: "a", toAgent: "b", task: "old", method: "send" });
    const db = getDb(testDir);
    db.run("UPDATE requests SET createdAt = ? WHERE requestId = ?", [Date.now() - 2 * 60 * 60 * 1000, id]);
    trackRequest(testDir, { fromEntity: "a", toAgent: "c", task: "new", method: "send" });

    const stale = getStaleRequests(testDir, 1 * 60 * 60 * 1000);
    expect(stale).toHaveLength(1);
    expect(stale[0].task).toBe("old");
  });
});

describe("isDuplicate", () => {
  test("returns requestId for active duplicate", () => {
    const id = trackRequest(testDir, { fromEntity: "bob", toAgent: "tech-lead", task: "Review", method: "send" });
    expect(isDuplicate(testDir, "bob", "tech-lead", "Review")).toBe(id);
  });

  test("returns null for completed duplicate", () => {
    const id = trackRequest(testDir, { fromEntity: "bob", toAgent: "tech-lead", task: "Review", method: "send" });
    updateRequest(testDir, id, { status: "COMPLETED" });
    expect(isDuplicate(testDir, "bob", "tech-lead", "Review")).toBeNull();
  });

  test("returns null when no match", () => {
    expect(isDuplicate(testDir, "bob", "tech-lead", "Something")).toBeNull();
  });
});

describe("archiveOld", () => {
  test("deletes old completed requests", () => {
    const id = trackRequest(testDir, { fromEntity: "a", toAgent: "b", task: "old", method: "send" });
    updateRequest(testDir, id, { status: "COMPLETED", completedAt: Date.now() - 8 * 86400000 });
    const id2 = trackRequest(testDir, { fromEntity: "a", toAgent: "b", task: "recent", method: "send" });
    updateRequest(testDir, id2, { status: "COMPLETED", completedAt: Date.now() });

    expect(archiveOld(testDir, 7)).toBe(1);
    expect(getRequest(testDir, id)).toBeNull();
    expect(getRequest(testDir, id2)).not.toBeNull();
  });

  test("does not delete active requests", () => {
    const id = trackRequest(testDir, { fromEntity: "a", toAgent: "b", task: "active", method: "send" });
    const db = getDb(testDir);
    db.run("UPDATE requests SET createdAt = 0 WHERE requestId = ?", [id]);
    expect(archiveOld(testDir, 0)).toBe(0);
    expect(getRequest(testDir, id)).not.toBeNull();
  });
});

describe("classifyError", () => {
  test("classifies infra errors", () => {
    expect(classifyError("empty response")).toBe("infra");
    expect(classifyError("0 output tokens")).toBe("infra");
    expect(classifyError("HTTP 502")).toBe("infra");
    expect(classifyError("rate limit")).toBe("infra");
    expect(classifyError("timeout")).toBe("infra");
  });

  test("classifies overflow errors", () => {
    expect(classifyError("context window exceeded")).toBe("overflow");
    expect(classifyError("context_length_exceeded")).toBe("overflow");
    expect(classifyError("too many tokens")).toBe("overflow");
  });

  test("classifies abort errors", () => {
    expect(classifyError("abort")).toBe("abort");
    expect(classifyError("cancelled")).toBe("abort");
  });

  test("classifies logic errors", () => {
    expect(classifyError("tool not found")).toBe("logic");
    expect(classifyError("Permission denied")).toBe("logic");
  });

  test("defaults to logic for unknown", () => {
    expect(classifyError("weird error")).toBe("logic");
    expect(classifyError(null)).toBe("logic");
    expect(classifyError(undefined)).toBe("logic");
  });
});

describe("closeDb", () => {
  test("closes and removes cached database", () => {
    const db1 = getDb(testDir);
    expect(db1).toBeTruthy();
    closeDb(testDir);
    const db2 = getDb(testDir);
    expect(db2).not.toBe(db1);
  });
});
