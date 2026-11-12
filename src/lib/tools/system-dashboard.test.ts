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

test("maintains a consistent MVCC snapshot and cleans up sidecars when a writer commits, checkpoints, and closes mid-scan", () => {
  const root = mkdtempSync(join(tmpdir(), "may-status-checkpoint-race-"));
  try {
    const now = Date.now();
    const seed = getDb(root);
    applyDbSchema(seed);
    seed.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["base-session", "scout", "initial", "done", now - 2000, now - 1000],
    );
    closeDb(root);
    expect(readdirSync(root)).toEqual(["may.db"]);

    let writerRanMidScan = false;
    const duringScan = printSystemStatus(root, {
      onSnapshotAcquired: () => {
        // Writer starts, commits new rows, checkpoints, and closes while reader holds its snapshot
        const live = getDb(root);
        writerRanMidScan = true;
        live.run(
          "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
          ["concurrent-session", "scout", "mid-scan-write", "error", now - 500, now],
        );
        live.exec("PRAGMA wal_checkpoint(PASSIVE)");
        closeDb(root);
      },
    });
    expect(writerRanMidScan).toBe(true);
    // In-flight scan sees its consistent pre-writer MVCC snapshot without torn/mixed state
    expect(duringScan).toMatch(/scout\s+1\s+1\s+0\s+100%/);
    // Last closing connection (status reader) leaves zero sidecars behind
    expect(readdirSync(root)).toEqual(["may.db"]);

    // Subsequent status read sees the committed concurrent write and also leaves zero sidecars
    const afterScan = printSystemStatus(root);
    expect(afterScan).toMatch(/scout\s+2\s+1\s+1\s+50%/);
    expect(readdirSync(root)).toEqual(["may.db"]);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("leaves zero WAL/SHM sidecars when the last writer closes immediately before reader attachment", () => {
  const root = mkdtempSync(join(tmpdir(), "may-status-writer-shutdown-race-"));
  try {
    const { createHash } = require("node:crypto");
    const { readFileSync } = require("node:fs");
    const now = Date.now();
    const live = getDb(root);
    applyDbSchema(live);
    live.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["shutdown-session", "may", "reply", "done", now - 500, now],
    );
    expect(readdirSync(root).sort()).toEqual(["may.db", "may.db-shm", "may.db-wal"]);

    let settledSha = "";
    const status = printSystemStatus(root, {
      onBeforeAttach: () => {
        // Last writer closes right before reader opens may.db
        closeDb(root);
        settledSha = createHash("sha256").update(readFileSync(join(root, "may.db"))).digest("hex");
      },
    });
    expect(status).toMatch(/may\s+1\s+1\s+0\s+100%/);
    expect(readdirSync(root)).toEqual(["may.db"]);
    const afterSha = createHash("sha256").update(readFileSync(join(root, "may.db"))).digest("hex");
    expect(afterSha).toBe(settledSha);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("read-only observer sees live committed WAL writes and reports unavailable rather than stale data when closed", () => {
  const root = mkdtempSync(join(tmpdir(), "may-status-ro-observer-"));
  const { chmodSync } = require("node:fs");
  const isRoot = process.getuid?.() === 0;
  try {
    const now = Date.now();
    const writer = getDb(root);
    applyDbSchema(writer);
    writer.exec("PRAGMA wal_autocheckpoint = 0");
    writer.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["wal-only-session", "alex", "live-wal-commit", "done", now - 500, now],
    );

    if (!isRoot) {
      chmodSync(join(root, "may.db"), 0o444);
      chmodSync(join(root, "may.db-wal"), 0o444);
      chmodSync(join(root, "may.db-shm"), 0o444);
      chmodSync(root, 0o555);
    }

    // 1. Live writer + read-only observer reads committed WAL data accurately (never ignores WAL via immutable=1)
    const liveStatus = printSystemStatus(root, isRoot ? { simulateReadOnlyObserver: true } : undefined);
    expect(liveStatus).toMatch(/alex\s+1\s+1\s+0\s+100%/);

    if (!isRoot) {
      chmodSync(root, 0o755);
      chmodSync(join(root, "may.db"), 0o644);
      chmodSync(join(root, "may.db-wal"), 0o644);
      chmodSync(join(root, "may.db-shm"), 0o644);
    }
    closeDb(root);
    expect(readdirSync(root)).toEqual(["may.db"]);

    // 2. Closed DB + read-only observer without write lock reports unavailable without creating sidecars
    if (!isRoot) {
      chmodSync(join(root, "may.db"), 0o444);
      chmodSync(root, 0o555);
    }
    const closedRoStatus = printSystemStatus(root, isRoot ? { simulateReadOnlyObserver: true } : undefined);
    expect(closedRoStatus).toContain("Runtime status unavailable");
    expect(readdirSync(root)).toEqual(["may.db"]);
  } finally {
    try {
      chmodSync(root, 0o755);
      chmodSync(join(root, "may.db"), 0o644);
    } catch {
      // Best-effort permission cleanup
    }
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
