import { describe, expect, it } from "bun:test";
import { openDatabase } from "../db.js";
import { afterStateCommit, inStateTransaction, stateTransaction } from "./transaction.js";

describe("state transaction delivery", () => {
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
