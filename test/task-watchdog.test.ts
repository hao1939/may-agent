import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import {
  loadLog,
  appendLog,
  pruneLog,
  getActiveSessionIds,
  determineAction,
  create,
  type LogEntry,
  type RequestRow,
} from "../may/handlers/task-watchdog.js";

const TEST_DIR = resolve("/tmp/task-watchdog-test-" + process.pid);
const LOG_PATH = resolve(TEST_DIR, "task-watchdog-log.jsonl");

function makeRequest(overrides: Partial<RequestRow> = {}): RequestRow {
  return {
    id: "req_" + Math.random().toString(36).slice(2, 8),
    status: "CREATED",
    method: "send",
    toAgent: "bob",
    fromEntity: "coach",
    sessionId: undefined,
    task: "Do something important",
    createdAt: Date.now() - 3 * 60 * 60 * 1000, // 3h old by default
    ...overrides,
  };
}

function makeLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    requestId: "req_test",
    toAgent: "bob",
    fromEntity: "coach",
    action: "nudge",
    requestAgeH: 2.5,
    task: "test task",
    ...overrides,
  };
}

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

describe("loadLog", () => {
  it("returns empty array for missing file", () => {
    expect(loadLog("/tmp/nonexistent-file.jsonl")).toEqual([]);
  });

  it("parses JSONL entries", () => {
    const entries = [makeLogEntry(), makeLogEntry({ action: "escalate" })];
    writeFileSync(LOG_PATH, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
    const loaded = loadLog(LOG_PATH);
    expect(loaded).toHaveLength(2);
    expect(loaded[1].action).toBe("escalate");
  });
});

describe("appendLog", () => {
  it("creates file and appends entry", () => {
    const entry = makeLogEntry();
    appendLog(LOG_PATH, entry);
    const content = readFileSync(LOG_PATH, "utf-8");
    expect(content.trim()).toBe(JSON.stringify(entry));
  });

  it("appends to existing file", () => {
    appendLog(LOG_PATH, makeLogEntry({ action: "nudge" }));
    appendLog(LOG_PATH, makeLogEntry({ action: "escalate" }));
    const entries = loadLog(LOG_PATH);
    expect(entries).toHaveLength(2);
  });
});

describe("pruneLog", () => {
  it("removes entries older than 7 days", () => {
    const now = Date.now();
    const old = makeLogEntry({ timestamp: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString() });
    const recent = makeLogEntry({ timestamp: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString() });
    writeFileSync(LOG_PATH, [old, recent].map((e) => JSON.stringify(e)).join("\n") + "\n");
    pruneLog(LOG_PATH, now);
    const after = loadLog(LOG_PATH);
    expect(after).toHaveLength(1);
    expect(after[0].timestamp).toBe(recent.timestamp);
  });
});

describe("getActiveSessionIds", () => {
  it("returns empty set for missing directory", () => {
    expect(getActiveSessionIds("/tmp/nonexistent")).toEqual(new Set());
  });

  it("reads session files from active directory", () => {
    const activeDir = resolve(TEST_DIR, "sessions/active");
    mkdirSync(activeDir, { recursive: true });
    writeFileSync(resolve(activeDir, "sess_abc.json"), "{}");
    writeFileSync(resolve(activeDir, "sess_def.json"), "{}");
    const ids = getActiveSessionIds(TEST_DIR);
    expect(ids.has("sess_abc")).toBe(true);
    expect(ids.has("sess_def")).toBe(true);
    expect(ids.size).toBe(2);
  });
});

describe("determineAction", () => {
  const activeSessionIds = new Set(["active_session_1"]);
  const now = Date.now();

  it("skips fresh requests (< 2h)", () => {
    const req = makeRequest({ createdAt: now - 1 * 60 * 60 * 1000 }); // 1h
    expect(determineAction(req, [], activeSessionIds, now)).toBe("skip");
  });

  it("nudges stale CREATED request (> 2h)", () => {
    const req = makeRequest({ createdAt: now - 3 * 60 * 60 * 1000 });
    expect(determineAction(req, [], activeSessionIds, now)).toBe("nudge");
  });

  it("skips IN_PROGRESS with active session", () => {
    const req = makeRequest({
      status: "IN_PROGRESS",
      sessionId: "active_session_1",
      createdAt: now - 3 * 60 * 60 * 1000,
    });
    expect(determineAction(req, [], activeSessionIds, now)).toBe("skip");
  });

  it("nudges IN_PROGRESS without active session (orphan)", () => {
    const req = makeRequest({
      status: "IN_PROGRESS",
      sessionId: "dead_session",
      createdAt: now - 30 * 60 * 1000, // only 30min old but orphaned
    });
    expect(determineAction(req, [], activeSessionIds, now)).toBe("nudge");
  });

  it("escalates previously nudged request at >= 6h", () => {
    const req = makeRequest({ createdAt: now - 7 * 60 * 60 * 1000 });
    const prior = [makeLogEntry({ requestId: req.id, action: "nudge" })];
    expect(determineAction(req, prior, activeSessionIds, now)).toBe("escalate");
  });

  it("alerts previously escalated request at >= 12h", () => {
    const req = makeRequest({ createdAt: now - 13 * 60 * 60 * 1000 });
    const prior = [
      makeLogEntry({ requestId: req.id, action: "nudge" }),
      makeLogEntry({ requestId: req.id, action: "escalate" }),
    ];
    expect(determineAction(req, prior, activeSessionIds, now)).toBe("alert");
  });

  it("skips already alerted request (no spam)", () => {
    const req = makeRequest({ createdAt: now - 20 * 60 * 60 * 1000 });
    const prior = [
      makeLogEntry({ requestId: req.id, action: "nudge" }),
      makeLogEntry({ requestId: req.id, action: "escalate" }),
      makeLogEntry({ requestId: req.id, action: "alert" }),
    ];
    expect(determineAction(req, prior, activeSessionIds, now)).toBe("skip");
  });

  it("tracks all methods (not just send)", () => {
    for (const method of ["send", "call", "fork", "run", "chat", "workflow"]) {
      const req = makeRequest({ method, createdAt: now - 3 * 60 * 60 * 1000 });
      expect(determineAction(req, [], activeSessionIds, now)).toBe("nudge");
    }
  });

  it("does not nudge at 6h without prior nudge", () => {
    // Should still nudge (first time)
    const req = makeRequest({ createdAt: now - 7 * 60 * 60 * 1000 });
    expect(determineAction(req, [], activeSessionIds, now)).toBe("nudge");
  });

  it("does not escalate without prior nudge", () => {
    const req = makeRequest({ createdAt: now - 7 * 60 * 60 * 1000 });
    // No prior actions → nudge not escalate
    expect(determineAction(req, [], activeSessionIds, now)).not.toBe("escalate");
  });

  it("orphan: CREATED with no sessionId is NOT orphaned", () => {
    const req = makeRequest({
      status: "CREATED",
      sessionId: undefined,
      createdAt: now - 30 * 60 * 1000, // 30min, not stale
    });
    expect(determineAction(req, [], activeSessionIds, now)).toBe("skip");
  });

  it("orphan: IN_PROGRESS with active session is NOT orphaned", () => {
    const req = makeRequest({
      status: "IN_PROGRESS",
      sessionId: "active_session_1",
      createdAt: now - 30 * 60 * 1000,
    });
    expect(determineAction(req, [], activeSessionIds, now)).toBe("skip");
  });
});

describe("create (integration)", () => {
  function makeCtx(requests: RequestRow[] = [], activeSessions: string[] = []) {
    const persistDir = TEST_DIR;
    const projectRoot = TEST_DIR;
    const activeDir = resolve(TEST_DIR, ".state/sessions/active");
    mkdirSync(activeDir, { recursive: true });
    for (const sid of activeSessions) {
      writeFileSync(resolve(activeDir, sid + ".json"), "{}");
    }

    const logs: string[] = [];
    const notifications: string[] = [];
    const sends: { agent: string; msg: string }[] = [];

    const db = {
      prepare: (sql: string) => ({
        all: (...args: any[]) => {
          if (sql.includes("createdAt < ?")) {
            const cutoff = args[0];
            return requests.filter((r) => r.createdAt < cutoff && ["CREATED", "IN_PROGRESS"].includes(r.status));
          }
          return requests.filter((r) => ["CREATED", "IN_PROGRESS"].includes(r.status));
        },
        get: (...args: any[]) => null,
      }),
    };

    const ctx = {
      getDb: () => db,
      log: (msg: string) => logs.push(msg),
      notify: (msg: string) => notifications.push(msg),
      persistDir,
      projectRoot,
      manager: {
        send: (agent: string, msg: string) => sends.push({ agent, msg }),
      },
    };

    return { ctx, logs, notifications, sends, persistDir };
  }

  it("does nothing for fresh requests", async () => {
    const now = Date.now();
    const req = makeRequest({ createdAt: now - 30 * 60 * 1000 }); // 30min
    const { ctx, sends, logs } = makeCtx([req]);
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends).toHaveLength(0);
  });

  it("sends nudge for stale request", async () => {
    const req = makeRequest({ createdAt: Date.now() - 3 * 60 * 60 * 1000, toAgent: "bob" });
    const { ctx, sends } = makeCtx([req]);
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends).toHaveLength(1);
    expect(sends[0].agent).toBe("bob");
    expect(sends[0].msg).toContain("[task-watchdog]");
    expect(sends[0].msg).toContain("send");
  });

  it("skips IN_PROGRESS with active session", async () => {
    const req = makeRequest({
      status: "IN_PROGRESS",
      sessionId: "sess_active",
      createdAt: Date.now() - 3 * 60 * 60 * 1000,
    });
    const { ctx, sends } = makeCtx([req], ["sess_active"]);
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends).toHaveLength(0);
  });

  it("nudges orphaned request (dead session)", async () => {
    const req = makeRequest({
      status: "IN_PROGRESS",
      sessionId: "dead_sess",
      createdAt: Date.now() - 30 * 60 * 1000, // only 30min
      toAgent: "bob",
    });
    const { ctx, sends } = makeCtx([req]);
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends).toHaveLength(1);
    expect(sends[0].msg).toContain("orphaned");
  });

  it("self-nudge: toAgent=may skips send but still logs", async () => {
    const req = makeRequest({ createdAt: Date.now() - 3 * 60 * 60 * 1000, toAgent: "may" });
    const { ctx, sends, persistDir } = makeCtx([req]);
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends).toHaveLength(0);
    // But log entry should be written
    const entries = loadLog(resolve(persistDir, "task-watchdog-log.jsonl"));
    expect(entries.some((e) => e.requestId === req.id && e.action === "nudge")).toBe(true);
  });

  it("escalates at 6h with prior nudge", async () => {
    const req = makeRequest({ createdAt: Date.now() - 7 * 60 * 60 * 1000, toAgent: "bob", id: "req_esc" });
    const { ctx, sends, logs, persistDir } = makeCtx([req]);
    // Pre-write a nudge log entry
    appendLog(resolve(persistDir, "task-watchdog-log.jsonl"), makeLogEntry({ requestId: "req_esc", action: "nudge" }));
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends).toHaveLength(0); // No send for escalation
    expect(logs.some((l) => l.includes("ESCALATION") && l.includes("req_esc"))).toBe(true);
  });

  it("alerts at 12h with prior escalation", async () => {
    const req = makeRequest({ createdAt: Date.now() - 13 * 60 * 60 * 1000, toAgent: "bob", id: "req_alert" });
    const { ctx, notifications, persistDir } = makeCtx([req]);
    const logPath = resolve(persistDir, "task-watchdog-log.jsonl");
    appendLog(logPath, makeLogEntry({ requestId: "req_alert", action: "nudge" }));
    appendLog(logPath, makeLogEntry({ requestId: "req_alert", action: "escalate" }));
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain("🚨");
    expect(notifications[0]).toContain("req_alert");
  });

  it("caps nudges at 10 per run", async () => {
    const requests = Array.from({ length: 15 }, (_, i) =>
      makeRequest({ id: `req_${i}`, createdAt: Date.now() - 3 * 60 * 60 * 1000, toAgent: "bob" })
    );
    const { ctx, sends } = makeCtx(requests);
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends.length).toBeLessThanOrEqual(10);
  });

  it("writes JSONL log entries after actions", async () => {
    const req = makeRequest({ createdAt: Date.now() - 3 * 60 * 60 * 1000, toAgent: "bob" });
    const { ctx, persistDir } = makeCtx([req]);
    const handler = create(ctx as any, {} as any);
    await handler();
    const entries = loadLog(resolve(persistDir, "task-watchdog-log.jsonl"));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].action).toBe("nudge");
    expect(entries[0].toAgent).toBe("bob");
    expect(entries[0].requestId).toBe(req.id);
  });

  it("prunes old log entries at end of run", async () => {
    const req = makeRequest({ createdAt: Date.now() - 3 * 60 * 60 * 1000 });
    const { ctx, persistDir } = makeCtx([req]);
    const logPath = resolve(persistDir, "task-watchdog-log.jsonl");
    // Add an old entry
    const oldEntry = makeLogEntry({ timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), requestId: "old_req" });
    appendLog(logPath, oldEntry);
    const handler = create(ctx as any, {} as any);
    await handler();
    const entries = loadLog(logPath);
    expect(entries.every((e) => e.requestId !== "old_req")).toBe(true);
  });

  it("nudge message includes method type", async () => {
    const req = makeRequest({ method: "fork", createdAt: Date.now() - 3 * 60 * 60 * 1000, toAgent: "bob" });
    const { ctx, sends } = makeCtx([req]);
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends[0].msg).toContain("fork");
  });

  it("escalate for toAgent=may still works (self-nudge only skips send)", async () => {
    const req = makeRequest({ createdAt: Date.now() - 7 * 60 * 60 * 1000, toAgent: "may", id: "req_may_esc" });
    const { ctx, sends, logs, persistDir } = makeCtx([req]);
    const logPath = resolve(persistDir, "task-watchdog-log.jsonl");
    appendLog(logPath, makeLogEntry({ requestId: "req_may_esc", action: "nudge" }));
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends).toHaveLength(0);
    expect(logs.some((l) => l.includes("ESCALATION") && l.includes("req_may_esc"))).toBe(true);
  });

  it("alert for toAgent=may still works", async () => {
    const req = makeRequest({ createdAt: Date.now() - 13 * 60 * 60 * 1000, toAgent: "may", id: "req_may_alert" });
    const { ctx, notifications, persistDir } = makeCtx([req]);
    const logPath = resolve(persistDir, "task-watchdog-log.jsonl");
    appendLog(logPath, makeLogEntry({ requestId: "req_may_alert", action: "nudge" }));
    appendLog(logPath, makeLogEntry({ requestId: "req_may_alert", action: "escalate" }));
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain("may");
  });

  it("orphan nudge includes orphaned label", async () => {
    const req = makeRequest({
      status: "IN_PROGRESS",
      sessionId: "dead_sess_2",
      createdAt: Date.now() - 30 * 60 * 1000,
      toAgent: "bob",
      method: "call",
    });
    const { ctx, sends } = makeCtx([req]);
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends[0].msg).toContain("orphaned");
    expect(sends[0].msg).toContain("call");
  });

  it("multiple requests: processes mix of actions correctly", async () => {
    const now = Date.now();
    const fresh = makeRequest({ id: "fresh", createdAt: now - 30 * 60 * 1000 });
    const stale = makeRequest({ id: "stale", createdAt: now - 3 * 60 * 60 * 1000, toAgent: "bob" });
    const { ctx, sends } = makeCtx([fresh, stale]);
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends).toHaveLength(1);
    expect(sends[0].agent).toBe("bob");
  });

  it("log entry task field truncated to 150 chars", async () => {
    const longTask = "x".repeat(300);
    const req = makeRequest({ createdAt: Date.now() - 3 * 60 * 60 * 1000, task: longTask });
    const { ctx, persistDir } = makeCtx([req]);
    const handler = create(ctx as any, {} as any);
    await handler();
    const entries = loadLog(resolve(persistDir, "task-watchdog-log.jsonl"));
    expect(entries[0].task.length).toBeLessThanOrEqual(150);
  });

  it("handles DB error gracefully", async () => {
    const ctx = {
      getDb: () => { throw new Error("DB unavailable"); },
      log: vi.fn(),
      notify: vi.fn(),
      persistDir: TEST_DIR,
      projectRoot: TEST_DIR,
      manager: { send: vi.fn() },
    };
    const handler = create(ctx as any, {} as any);
    await handler(); // Should not throw
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("Failed to get DB"));
  });

  it("does not escalate/alert without going through prior steps", async () => {
    // 13h old but no prior actions → should nudge, not alert
    const req = makeRequest({ createdAt: Date.now() - 13 * 60 * 60 * 1000, toAgent: "bob" });
    const { ctx, sends, notifications } = makeCtx([req]);
    const handler = create(ctx as any, {} as any);
    await handler();
    expect(sends).toHaveLength(1); // nudge
    expect(notifications).toHaveLength(0); // no alert
  });
});
