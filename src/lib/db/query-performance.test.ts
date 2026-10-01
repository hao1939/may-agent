import { expect, test } from "bun:test";
import { openDatabase } from "../db.js";
import { SqlPerformance, profileDatabase, readSqlPerformance } from "./query-performance.js";

test("SQL diagnostics preserve results, transactions and thrown failures without exposing values", () => {
  const profile = new SqlPerformance();
  const db = profileDatabase(openDatabase(":memory:"), profile);
  try {
    db.exec("CREATE TABLE sample(value TEXT UNIQUE)");
    const insert = db.prepare("INSERT INTO sample VALUES (?)");
    expect(insert.run("private parameter").changes).toBe(1);
    expect(() => insert.run("private parameter")).toThrow("UNIQUE");
    db.exec("BEGIN");
    db.run("INSERT INTO sample VALUES (?)", ["rolled back"]);
    db.exec("ROLLBACK");
    expect(db.prepare("SELECT * FROM sample").all()).toEqual([{ value: "private parameter" }]);
    for (let i = 0; i < 3; i++)
      expect(db.prepare(`SELECT 'private literal ${i}' AS value /* private comment */`).get()).toEqual({
        value: `private literal ${i}`,
      });
    db.prepare('SELECT 99 AS "private column" -- private comment').get();
    expect(() => db.prepare("SELECT 'private unterminated literal")).toThrow();
    const before = profile.snapshot();
    expect(before.errors).toBe(2);
    const literal = before.queries.topByCalls.find((row) => row.operation === "get" && row.sql === "SELECT ? AS value");
    expect(literal).toMatchObject({ calls: 3, errors: 0 });
    expect(literal!.totalMs).toBeGreaterThanOrEqual(literal!.maxMs);
    expect(literal!.averageMs).toBeLessThanOrEqual(literal!.maxMs);
    expect(JSON.stringify(before)).not.toContain("private");
    db.prepare("SELECT * FROM sample").all();
    expect(profile.snapshot().calls).toBe(before.calls + 2);
    expect(before.calls).toBeLessThan(profile.snapshot().calls);
    // The ordinary public opener also records calls without caller opt-in.
    expect(readSqlPerformance().calls).toBeGreaterThanOrEqual(profile.snapshot().calls);
  } finally {
    db.close();
  }
});

test("SQL diagnostics mask SQLite numeric forms and group equivalent query shapes", () => {
  const profile = new SqlPerformance();
  const db = profileDatabase(openDatabase(":memory:"), profile);
  try {
    for (const [literal, value] of [
      ["0xDEADBEEF", 3735928559],
      ["0xDEAD_BEEF", 3735928559],
      ["123_456", 123456],
      ["1_2.3_4e+0_2", 1234],
      [".125", 0.125],
      ["12.", 12],
      ["12.e-1", 1.2],
    ] as const) {
      expect(db.prepare(`SELECT ${literal} AS value`).get()).toEqual({ value });
    }
    const rows = profile.snapshot().queries.topByCalls;
    expect(rows).toHaveLength(2); // prepare and get share one masked SQL shape
    for (const row of rows) expect(row).toMatchObject({ sql: "SELECT ? AS value", calls: 7 });
    // Digits in identifiers must not be mistaken for literals.
    db.prepare("SELECT 1 AS column_123").get();
    expect(profile.snapshot().queries.topByCalls.some((row) => row.sql === "SELECT ? AS column_123")).toBe(true);
  } finally {
    db.close();
  }
});

test("SQL diagnostics bound distinct shapes and expose omitted work instead of claiming full coverage", () => {
  let now = 0;
  const profile = new SqlPerformance(2, () => now);
  const db = profileDatabase(openDatabase(":memory:"), profile);
  try {
    for (let i = 0; i < 20; i++) db.prepare(`SELECT 1 AS column_${i}`).get();
    const result = profile.snapshot();
    expect(result.queries.trackedQueries).toBe(2);
    expect(result.calls).toBe(40);
    expect(result.untracked.calls).toBe(38);
    expect(result.queries.topByTotalTime).toHaveLength(2);
    expect(result.queries.topByWorstTime).toHaveLength(2);
    expect(result.queries.topByCalls).toHaveLength(2);
    now = 300_000;
    db.prepare("SELECT 1 AS recent").get();
    const next = profile.snapshot();
    expect(next.calls).toBe(42);
    expect(next.untracked.calls).toBe(38);
    expect(next.queries.since).toBe(now);
    expect(next.queries.topByCalls.every((row) => row.sql.endsWith("AS recent"))).toBe(true);
    expect(next.previousQueries).toEqual({ ...result.queries, until: now });
    expect(result.queries.since).toBe(0);
  } finally {
    db.close();
  }
});
