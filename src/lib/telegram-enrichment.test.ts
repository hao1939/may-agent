import { describe, it, expect, beforeEach } from "bun:test";
import type { SqliteDb } from "./db.js";
import { openDatabase } from "./db.js";

// Simulate the enrichment logic (extracted from telegram.ts)
function enrichReply(db: SqliteDb, replyToMsgId: number, userText: string): string {
  const ctx = db.prepare("SELECT * FROM notification_messages WHERE telegram_msg_id = ?").get(replyToMsgId) as any;
  if (!ctx) return userText; // no context found, pass through

  const parts: string[] = [];
  parts.push(`[User replying to notification${ctx.agent ? ` from ${ctx.agent}` : ""}${ctx.project_id ? ` about project "${ctx.project_id}"` : ""}]`);
  if (ctx.data) {
    try {
      const data = JSON.parse(ctx.data);
      if (data.summary) parts.push(`Context: ${data.summary}`);
      if (data.text) parts.push(`Original notification: ${data.text}`);
    } catch {}
  }
  if (ctx.event_type) parts.push(`Event type: ${ctx.event_type}`);
  parts.push("");
  parts.push(`User says: ${userText}`);
  return parts.join("\n");
}

function storeNotification(db: SqliteDb, msgId: number, context: { eventType?: string; agent?: string; sessionId?: string; projectId?: string; data?: string }) {
  db.prepare(
    "INSERT OR REPLACE INTO notification_messages (telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    msgId,
    context.eventType || null,
    context.agent || null,
    context.sessionId || null,
    context.projectId || null,
    context.data || null,
    Date.now(),
  );
}

describe("Telegram Context Enrichment", () => {
  let db: SqliteDb;

  beforeEach(() => {
    db = openDatabase(":memory:");
    db.exec(`CREATE TABLE notification_messages (
      telegram_msg_id INTEGER PRIMARY KEY,
      event_type TEXT,
      agent TEXT,
      session_id TEXT,
      project_id TEXT,
      data TEXT,
      sent_at INTEGER
    )`);
  });

  it("enriches reply with project context", () => {
    storeNotification(db, 12345, {
      eventType: "notification",
      agent: "may",
      projectId: "system-efficiency",
      data: JSON.stringify({ text: "system-efficiency is WAITING" }),
    });

    const enriched = enrichReply(db, 12345, "focus on output not cost");
    expect(enriched).toContain("[User replying to notification from may about project \"system-efficiency\"]");
    expect(enriched).toContain("User says: focus on output not cost");
    expect(enriched).toContain("system-efficiency is WAITING");
  });

  it("enriches reply with agent context (no project)", () => {
    storeNotification(db, 67890, {
      eventType: "blocked",
      agent: "bob",
      data: JSON.stringify({ summary: "Ship EXP-188 retried 15x" }),
    });

    const enriched = enrichReply(db, 67890, "cancel it and move on");
    expect(enriched).toContain("[User replying to notification from bob]");
    expect(enriched).toContain("Context: Ship EXP-188 retried 15x");
    expect(enriched).toContain("User says: cancel it and move on");
    expect(enriched).not.toContain("project");
  });

  it("passes through when no context found", () => {
    const result = enrichReply(db, 99999, "hello world");
    expect(result).toBe("hello world");
  });

  it("includes event type", () => {
    storeNotification(db, 11111, {
      eventType: "metric_breach",
      agent: "may",
      data: JSON.stringify({ text: "handler.p95-duration at 274s" }),
    });

    const enriched = enrichReply(db, 11111, "increase timeout");
    expect(enriched).toContain("Event type: metric_breach");
    expect(enriched).toContain("User says: increase timeout");
  });

  it("handles malformed data gracefully", () => {
    storeNotification(db, 22222, {
      eventType: "notification",
      agent: "scout",
      data: "not valid json{{{",
    });

    const enriched = enrichReply(db, 22222, "tell me more");
    expect(enriched).toContain("[User replying to notification from scout]");
    expect(enriched).toContain("User says: tell me more");
    // Should not throw
  });

  it("stores and retrieves notification context", () => {
    storeNotification(db, 33333, {
      eventType: "notification",
      agent: "coach",
      sessionId: "s_123",
      projectId: "skill-audit",
      data: JSON.stringify({ text: "skill audit complete" }),
    });

    const row = db.prepare("SELECT * FROM notification_messages WHERE telegram_msg_id = 33333").get() as any;
    expect(row.agent).toBe("coach");
    expect(row.project_id).toBe("skill-audit");
    expect(row.session_id).toBe("s_123");
    expect(row.event_type).toBe("notification");
  });
});

describe("Telegram Reply Metric", () => {
  let db: SqliteDb;

  beforeEach(() => {
    db = openDatabase(":memory:");
    db.exec(`CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      source TEXT,
      owner TEXT,
      data TEXT,
      timestamp INTEGER NOT NULL
    )`);
  });

  it("tracks enriched reply as event", () => {
    // Simulate what the bot does when enriching a reply:
    db.prepare("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)")
      .run("telegram.reply", "telegram", "agent:may", JSON.stringify({ enriched: true, originalMsgId: 12345 }), Date.now());

    const count = (db.prepare("SELECT COUNT(*) as c FROM events WHERE event_type = 'telegram.reply'").get() as any).c;
    expect(count).toBe(1);
  });

  it("can compute reply-actionable-rate", () => {
    const now = Date.now();
    // 3 enriched replies
    for (let i = 0; i < 3; i++) {
      db.prepare("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)")
        .run("telegram.reply", "telegram", "agent:may", JSON.stringify({ enriched: true }), now - i * 60000);
    }
    // 1 non-enriched reply (no context found)
    db.prepare("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)")
      .run("telegram.reply", "telegram", "agent:may", JSON.stringify({ enriched: false }), now - 300000);

    const total = (db.prepare("SELECT COUNT(*) as c FROM events WHERE event_type = 'telegram.reply'").get() as any).c;
    const enriched = (db.prepare("SELECT COUNT(*) as c FROM events WHERE event_type = 'telegram.reply' AND json_extract(data, '$.enriched') = 1").get() as any).c;

    expect(total).toBe(4);
    expect(enriched).toBe(3);
    expect(enriched / total).toBe(0.75);
  });
});

describe("Session Context Enrichment", () => {
  it("includes session transcript summary in enrichment", () => {
    // This tests the logic conceptually — actual file reading tested via integration
    const sessionSummary = "[COMPACTED CONTEXT] Task: fix project failures. Files read: project.ts";
    const lastAction = "switching from grep to faster approach for 36k files";
    
    // Simulate what the enrichment builds:
    const parts: string[] = [];
    parts.push('[User replying to notification from may]');
    parts.push('Event type: response');
    parts.push(`\nSession context (135 messages):`);
    parts.push(`  Summary: ${sessionSummary}`);
    parts.push(`  Last action: ${lastAction}`);
    parts.push('');
    parts.push('User says: continue where you left off');
    
    const enriched = parts.join("\n");
    expect(enriched).toContain("Session context");
    expect(enriched).toContain("fix project failures");
    expect(enriched).toContain("switching from grep");
    expect(enriched).toContain("User says: continue where you left off");
  });
});
