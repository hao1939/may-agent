import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "./connection.js";
import { readSessionLastActivityAt, upsertSession, updateSessionProgress } from "./sessions.js";

describe("session DB progress", () => {
  it("persists live op count and last activity without ending the session", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-session-db-"));
    try {
      upsertSession(persistDir, {
        sessionId: "s_live",
        agent: "dev",
        task: "do work",
        status: "running",
        startedAt: 1000,
      });

      updateSessionProgress(persistDir, "s_live", {
        opCount: 2,
        lastActivityAt: 2000,
      });
      updateSessionProgress(persistDir, "s_live", {
        opCount: 1,
        lastActivityAt: 1500,
      });

      const row = getDb(persistDir)
        .prepare("select status, endedAt, opCount, lastActivityAt from sessions where sessionId = ?")
        .get("s_live") as { status: string; endedAt: number | null; opCount: number; lastActivityAt: number };
      const foreignKeys = getDb(persistDir).prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };

      expect(row.status).toBe("running");
      expect(row.endedAt).toBeNull();
      expect(row.opCount).toBe(2);
      expect(row.lastActivityAt).toBe(2000);
      expect(readSessionLastActivityAt(persistDir, "s_live")).toBe(2000);
      expect(readSessionLastActivityAt(persistDir, "missing")).toBeNull();
      expect(foreignKeys.foreign_keys).toBe(1);
    } finally {
      closeDb(persistDir);
    }
  });
});
