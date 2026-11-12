import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyDbSchema } from "../db/schema.js";
import { closeDb, getDb } from "../db/connection.js";
import { chunkStatusMessage, notifyStatus, printSystemStatus } from "./system-dashboard.js";

test("status keeps ordinary agent evidence without promoting a named learning process", () => {
  const root = mkdtempSync(join(tmpdir(), "may-status-policy-"));
  try {
    const db = getDb(root);
    applyDbSchema(db);
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["fixture-session", "coach", "growth-cycle fixture", "done", Date.now() - 1000, Date.now()],
    );
    const status = printSystemStatus(root, { includeProcessHealth: false });
    expect(status).toContain("AGENTS (last 24h)");
    expect(status).toMatch(/coach\s+1\s+1\s+0\s+100%/);
    expect(status).not.toContain("Coach growth cycles");
    expect(db.prepare("SELECT task FROM sessions WHERE sessionId = ?").get("fixture-session"))
      .toEqual({ task: "growth-cycle fixture" });
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("retries against live WAL when a writer starts and commits during an immutable status check", () => {
  const root = mkdtempSync(join(tmpdir(), "may-status-wal-race-"));
  try {
    const seed = getDb(root);
    applyDbSchema(seed);
    closeDb(root);
    expect(readdirSync(root)).toEqual(["may.db"]);

    let liveWriterOpened = false;
    const now = Date.now();
    const status = printSystemStatus(root, {
      onImmutableRead: () => {
        // Simulate daemon startup attaching WAL and committing after immutable open
        const live = getDb(root);
        liveWriterOpened = true;
        live.exec("PRAGMA wal_autocheckpoint = 0");
        live.run(
          "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
          ["live-wal-session", "scout", "explore-xhs", "done", now - 500, now],
        );
      },
    });
    expect(liveWriterOpened).toBe(true);
    expect(status).toMatch(/scout\s+1\s+1\s+0\s+100%/);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("isolates uncheckpointed crash WAL without -shm so persistDir is never mutated", () => {
  const root = mkdtempSync(join(tmpdir(), "may-status-crash-wal-test-"));
  try {
    const { Database } = require("bun:sqlite");
    const dbPath = join(root, "may.db");
    const writer = new Database(dbPath);
    writer.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0;");
    applyDbSchema(writer);
    const now = Date.now();
    writer.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["crash-wal-session", "alex", "recover", "done", now - 500, now],
    );
    // Copy may.db + uncheckpointed may.db-wal without -shm into an isolated dir
    const crashedDir = mkdtempSync(join(tmpdir(), "may-status-crashed-only-"));
    try {
      const { copyFileSync } = require("node:fs");
      copyFileSync(dbPath, join(crashedDir, "may.db"));
      copyFileSync(`${dbPath}-wal`, join(crashedDir, "may.db-wal"));
      expect(readdirSync(crashedDir).sort()).toEqual(["may.db", "may.db-wal"]);

      const status = printSystemStatus(crashedDir);
      expect(status).toMatch(/alex\s+1\s+1\s+0\s+100%/);
      expect(readdirSync(crashedDir).sort()).toEqual(["may.db", "may.db-wal"]);
    } finally {
      rmSync(crashedDir, { recursive: true, force: true });
      writer.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("notifyStatus delivers every row across bounded 4000-char Telegram chunks without dropping tail content", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-status-notify-"));
  const prevToken = process.env.TELEGRAM_BOT_TOKEN;
  const prevChat = process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN = "fixture-token";
  process.env.TELEGRAM_CHAT_ID = "1001,1002";
  try {
    const db = getDb(root);
    applyDbSchema(db);
    const now = Date.now();
    for (let i = 0; i < 120; i++) {
      const agent = `agent-${String(i).padStart(3, "0")}`;
      db.run(
        "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [`sess-${i}`, agent, "bounded work", "done", now - 1000, now],
      );
    }
    closeDb(root);

    const sent: Array<{ chat_id: string; text: string }> = [];
    await notifyStatus(root, (async (_url, init) => {
      sent.push(JSON.parse(String(init?.body)));
      return new Response('{"ok":true}', { status: 200 });
    }) as typeof fetch);

    const perChat1001 = sent.filter((m) => m.chat_id === "1001");
    const perChat1002 = sent.filter((m) => m.chat_id === "1002");
    expect(perChat1001.length).toBeGreaterThan(1);
    expect(perChat1002.length).toBe(perChat1001.length);
    for (const msg of sent) {
      expect(msg.text.length).toBeLessThanOrEqual(4000);
    }
    const reassembled = perChat1001.map((m) => m.text).join("\n");
    expect(reassembled).toContain("agent-000");
    expect(reassembled).toContain("agent-119");
    expect(chunkStatusMessage("x".repeat(8500), 4000).map((c) => c.length)).toEqual([4000, 4000, 500]);
  } finally {
    if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = prevToken;
    if (prevChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = prevChat;
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
