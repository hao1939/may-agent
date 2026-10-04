import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db.js";
import { afterStateCommit, inStateTransaction, stateTransaction } from "./transaction.js";

describe("state transaction delivery", () => {
  it("waits for a competing writer before running the body once", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-state-contention-"));
    const path = join(root, "test.db");
    const db = openDatabase(path);
    db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 0; CREATE TABLE evidence (value TEXT)");
    const writer = Bun.spawn([process.execPath, "-e", `
      import { Database } from "bun:sqlite";
      const db = new Database(process.argv[1]);
      db.exec("BEGIN IMMEDIATE");
      console.log("locked");
      await Bun.stdin.text();
      db.run("INSERT INTO evidence VALUES ('other writer')");
      db.exec("COMMIT");
      db.close();
    `, path], { stdin: "pipe", stdout: "pipe", stderr: "pipe", timeout: 5_000 });
    let bodyCalls = 0;
    let contended = false;
    const guarded = {
      ...db,
      exec(sql: string) {
        try { db.exec(sql); }
        catch (error) {
          if (sql === "BEGIN IMMEDIATE") {
            contended = true;
            // Release only after SQLite actually rejected our acquisition.
            writer.stdin.end();
          }
          throw error;
        }
      },
    };
    try {
      const ready = writer.stdout.getReader();
      expect(new TextDecoder().decode((await ready.read()).value)).toContain("locked");
      ready.releaseLock();
      stateTransaction(guarded, () => {
        bodyCalls++;
        db.run("INSERT INTO evidence VALUES ('our writer')");
      });
      expect(contended).toBe(true);
      expect(bodyCalls).toBe(1);
      expect(await writer.exited).toBe(0);
      expect(db.prepare("SELECT value FROM evidence ORDER BY rowid").all()).toEqual([
        { value: "other writer" }, { value: "our writer" },
      ]);
    } finally {
      writer.kill();
      await writer.exited;
      db.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not replay the transaction body or committed delivery on a busy error", () => {
    const db = openDatabase(":memory:");
    db.exec("CREATE TABLE evidence (value TEXT)");
    let bodyCalls = 0;
    let deliveries = 0;
    try {
      expect(() => stateTransaction(db, () => {
        bodyCalls++;
        db.run("INSERT INTO evidence VALUES ('rolled back')");
        throw new Error("database is locked");
      })).toThrow("database is locked");
      expect(bodyCalls).toBe(1);
      expect(db.prepare("SELECT * FROM evidence").all()).toEqual([]);
      expect(() => stateTransaction(db, () => {
        bodyCalls++;
        db.run("INSERT INTO evidence VALUES ('committed')");
        afterStateCommit(db, () => {
          deliveries++;
          throw new Error("database is locked");
        });
      })).toThrow("State committed, but event delivery failed");
      expect(bodyCalls).toBe(2);
      expect(deliveries).toBe(1);
      expect(db.prepare("SELECT * FROM evidence").all()).toEqual([{ value: "committed" }]);
    } finally { db.close(); }
  });

  it("discards rolled-back savepoint delivery and releases committed callbacks outside the transaction", () => {
    const db = openDatabase(":memory:");
    const delivered: string[] = [];
    try {
      stateTransaction(db, () => {
        afterStateCommit(db, () => {
          expect(inStateTransaction(db)).toBe(false);
          delivered.push("outer");
        });
        expect(() => stateTransaction(db, () => {
          afterStateCommit(db, () => delivered.push("rolled back"));
          throw new Error("fixture savepoint failure");
        })).toThrow("fixture savepoint failure");
        stateTransaction(db, () => afterStateCommit(db, () => delivered.push("nested")));
        expect(delivered).toEqual([]);
      });
      expect(delivered).toEqual(["outer", "nested"]);
      afterStateCommit(db, () => delivered.push("immediate"));
      expect(delivered).toEqual(["outer", "nested", "immediate"]);
    } finally { db.close(); }
  });

  it("keeps committed state and attempts remaining delivery when a callback fails", () => {
    const db = openDatabase(":memory:");
    const delivered: string[] = [];
    try {
      db.exec("CREATE TABLE evidence (value TEXT)");
      expect(() => stateTransaction(db, () => {
        db.run("INSERT INTO evidence VALUES ('committed')");
        afterStateCommit(db, () => { throw new Error("fixture delivery failure"); });
        afterStateCommit(db, () => delivered.push("next"));
      })).toThrow("State committed, but event delivery failed");
      expect(db.prepare("SELECT value FROM evidence").all()).toEqual([{ value: "committed" }]);
      expect(delivered).toEqual(["next"]);
      expect(inStateTransaction(db)).toBe(false);
    } finally { db.close(); }
  });
});
