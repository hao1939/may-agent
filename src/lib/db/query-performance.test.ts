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

test.each(["get", "all"] as const)("SQL diagnostics retain one parameterized plan for a slow %s read", (operation) => {
  let duration = 0;
  let start = true;
  const elapsedNow = () => {
    start = !start;
    return start ? duration : 0;
  };
  const profile = new SqlPerformance(512, () => 123_456, elapsedNow);
  const underlying = openDatabase(":memory:");
  let explainCalls = 0;
  const explainParams: unknown[][] = [];
  const observed = {
    exec: (sql: string) => underlying.exec(sql),
    run: (sql: string, params?: unknown[]) => underlying.run(sql, params),
    prepare(sql: string) {
      const statement = underlying.prepare(sql);
      if (!sql.startsWith("EXPLAIN QUERY PLAN ")) return statement;
      return {
        ...statement,
        all(...params: unknown[]) {
          explainCalls++;
          explainParams.push(params);
          return statement.all(...params);
        },
      };
    },
    close: () => underlying.close(),
  };
  const db = profileDatabase(observed, profile);
  try {
    db.exec("CREATE TABLE sample(value TEXT UNIQUE)");
    db.prepare("INSERT INTO sample VALUES (?)").run("private parameter");

    const ordinary = db.prepare("SELECT value FROM sample WHERE value IS NOT NULL");
    expect(ordinary.get()).toEqual({ value: "private parameter" });
    expect(explainCalls).toBe(0);

    const write = db.prepare("UPDATE sample SET value = ?");
    duration = 2_000;
    expect(write.run("private parameter").changes).toBe(1);
    expect(db.prepare("UPDATE sample SET value = ? RETURNING value").get("private parameter")).toEqual({
      value: "private parameter",
    });
    expect(db.prepare("WITH next(value) AS (SELECT ?) UPDATE sample SET value = (SELECT value FROM next) RETURNING value").all("private parameter")).toEqual([
      { value: "private parameter" },
    ]);
    expect(
      db
        .prepare("WITH select2(value) AS (SELECT ?) UPDATE sample SET value = (SELECT value FROM select2) RETURNING value")
        .all("private parameter"),
    ).toEqual([{ value: "private parameter" }]);
    expect(
      db
        .prepare("WITH selecté(value) AS (SELECT ?) UPDATE sample SET value = (SELECT value FROM selecté) RETURNING value")
        .all("private parameter"),
    ).toEqual([{ value: "private parameter" }]);
    const longCte = "a".repeat(790);
    expect(
      db
        .prepare(
          `WITH ${longCte} AS (SELECT 1), select2(value) AS (SELECT ?) UPDATE sample SET value = (SELECT value FROM select2) RETURNING value`,
        )
        .all("private parameter"),
    ).toEqual([{ value: "private parameter" }]);
    expect(db.prepare("CREATE TABLE written AS SELECT 1 AS value").all()).toEqual([]);
    expect(explainCalls).toBe(0);

    const read = db.prepare("SELECT value FROM sample WHERE value = ?");
    duration = 3_000;
    const expected = operation === "get" ? { value: "private parameter" } : [{ value: "private parameter" }];
    expect(read[operation]("private parameter")).toEqual(expected);
    const slow = profile.snapshot().queries.topByWorstTime.find((row) => row.operation === operation && row.plan);
    expect(slow?.plan).toMatchObject({
      fingerprint: slow?.id,
      shape: "SELECT value FROM sample WHERE value = ?",
      capturedAt: 123_456,
      rowsTruncated: false,
    });
    expect(slow?.plan?.rows.length).toBeGreaterThan(0);
    expect(slow?.plan?.rows.length).toBeLessThanOrEqual(20);
    expect(explainParams).toEqual([["private parameter"]]);
    expect(JSON.stringify(profile.snapshot())).not.toContain("private parameter");

    for (let i = 0; i < 25; i++) read[operation]("private parameter");
    expect(explainCalls).toBe(1);
  } finally {
    db.close();
  }
});

test.each([
  "WITH input(value) AS (SELECT ?) SELECT value FROM input",
  "WITH RECURSIVE input(value) AS (SELECT ? UNION ALL SELECT value + 1 FROM input WHERE value < 2) SELECT value FROM input",
])("SQL diagnostics capture plans for successful CTE reads: %s", (sql) => {
  let elapsed = 0;
  const profile = new SqlPerformance(512, () => 0, () => (elapsed += 1_001));
  const db = profileDatabase(openDatabase(":memory:"), profile);
  try {
    expect(db.prepare(sql).get(2)).toEqual({ value: 2 });
    const row = profile.snapshot().queries.topByWorstTime.find((row) => row.operation === "get");
    expect(row?.plan?.rows.length).toBeGreaterThan(0);
    expect(row?.plan?.shape).not.toContain("< 2");
  } finally {
    db.close();
  }
});

test("plan capture respects the slow threshold, tracking capacity and window limits", () => {
  let now = 0;
  let elapsed = 0;
  let duration = 1_000;
  let captures = 0;
  const profile = new SqlPerformance(1, () => now, () => (elapsed += duration));
  const value = { value: "private result" };
  const measure = profile.statement("SELECT ? AS value", (params) => {
    expect(params).toEqual(["private parameter"]);
    captures++;
    return Array.from({ length: 30 }, (_, id) => ({
      id, parent: 0, detail: "SCAN sample ".repeat(60), ignored: "private extra field",
    }));
  });
  const read = () => measure("get", () => value, ["private parameter"]);
  expect(read()).toBe(value);
  expect(captures).toBe(0); // Exactly 1000 ms does not qualify.
  duration = 1_001;
  const failure = new Error("private read failure");
  expect(() => measure("get", () => { throw failure; })).toThrow(failure);
  expect(captures).toBe(0); // A failed read must not consume a later successful read's opportunity.
  expect(read()).toBe(value);
  expect(captures).toBe(1);
  const first = profile.snapshot().queries.topByWorstTime[0]!.plan!;
  expect(first.capturedAt).toBe(0);
  expect(first.rows).toHaveLength(20);
  expect(first.rowsTruncated).toBe(true);
  expect(first.rows.every((row) => row.detail.length === 500)).toBe(true);
  expect(JSON.stringify(profile.snapshot())).not.toContain("private");

  let untrackedCaptures = 0;
  const untracked = profile.statement("SELECT ? AS other", () => { untrackedCaptures++; return []; });
  expect(untracked("get", () => value)).toBe(value);
  expect(untrackedCaptures).toBe(0);
  expect(profile.snapshot().untracked.calls).toBe(1);
  now = 299_999;
  expect(read()).toBe(value);
  expect(captures).toBe(1);
  now = 300_000;
  expect(read()).toBe(value);
  expect(captures).toBe(2);
  const rotated = profile.snapshot();
  expect(rotated.queries.topByWorstTime[0]?.plan?.capturedAt).toBe(now);
  expect(rotated.previousQueries?.topByWorstTime[0]?.plan).toEqual(first);
  expect(first.capturedAt).toBe(0);
});

test("a failed plan capture cannot change a successful slow read", () => {
  let start = true;
  let now = 123_456;
  const profile = new SqlPerformance(
    512,
    () => now,
    () => {
      start = !start;
      return start ? 1_001 : 0;
    },
  );
  const underlying = openDatabase(":memory:");
  let planAttempts = 0;
  const db = profileDatabase(
    {
      exec: (sql) => underlying.exec(sql),
      run: (sql, params) => underlying.run(sql, params),
      prepare(sql) {
        if (sql.startsWith("EXPLAIN QUERY PLAN ")) {
          planAttempts++;
          throw new Error("plan unavailable");
        }
        return underlying.prepare(sql);
      },
      close: () => underlying.close(),
    },
    profile,
  );
  try {
    const read = db.prepare("SELECT ? AS value");
    for (let i = 0; i < 25; i++) expect(read.get("still returned")).toEqual({ value: "still returned" });
    expect(planAttempts).toBe(1);
    expect(profile.snapshot().queries.topByWorstTime.find((row) => row.operation === "get")?.plan).toBeUndefined();
    now += 300_000;
    expect(read.get("still returned")).toEqual({ value: "still returned" });
    expect(planAttempts).toBe(2);
  } finally {
    db.close();
  }
});
