import { describe, expect, it } from "bun:test";
import { openDatabase } from "../db.js";
import { readContentionObservations } from "./contention-observations.js";
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
      // Nested savepoints are not independent writer intervals, and delivery is outside the interval.
      const history = readContentionObservations(db, "missing-fixture-directory");
      expect(history.intervals).toHaveLength(1);
      expect(history.intervals[0].kind).toBe("writer");
      expect(history.intervals[0].end).toBeGreaterThanOrEqual(history.intervals[0].start);
    } finally { db.close(); }
  });

  it("bounds writer capture, isolates databases and retains rolled-back outer intervals", () => {
    const db = openDatabase(":memory:");
    const other = openDatabase(":memory:");
    try {
      for (let i = 0; i < 130; i++) stateTransaction(db, () => undefined);
      expect(() => stateTransaction(db, () => { throw new Error("fixture rollback"); })).toThrow("fixture rollback");
      const history = readContentionObservations(db, "missing-fixture-directory");
      expect(history).toMatchObject({ coverage: "unknown", dropped: 0, evictions: [{ count: 3 }] });
      expect(history.evictions![0].end).toBeLessThanOrEqual(history.intervals[0].start);
      expect(history.intervals).toHaveLength(128);
      expect(readContentionObservations(other, "missing-fixture-directory").intervals).toEqual([]);
    } finally { db.close(); other.close(); }
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
