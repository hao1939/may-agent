import { createHash } from "node:crypto";
import type { SqliteDb, Statement } from "../db.js";

type Timing = { calls: number; errors: number; totalMs: number; maxMs: number };
type QueryPlan = {
  fingerprint: string;
  shape: string;
  capturedAt: number;
  rows: Array<{ id: number; parent: number; detail: string }>;
  rowsTruncated: boolean;
};
type QueryTiming = Timing & { id: string; operation: string; sql: string; plan?: QueryPlan };
const emptyTiming = (): Timing => ({ calls: 0, errors: 0, totalMs: 0, maxMs: 0 });
const slowReadThresholdMs = 1_000;
const planRowLimit = 20;
const planDetailLimit = 500;

// SQL values and comments are not diagnostic data. Bound the exported shape;
// parameters, result rows, error messages and database paths are never collected.
function queryShape(sql: string): string {
  return sql
    .replace(
      /'(?:''|[^'])*(?:'|$)|"(?:""|[^"])*(?:"|$)|`(?:``|[^`])*(?:`|$)|\[[^\]]*(?:\]|$)|--[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|(?<![\w$\u0080-\uffff])(?:0x[\da-f](?:_?[\da-f])*|(?:\d(?:_?\d)*(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:e[+-]?\d(?:_?\d)*)?)(?![\w$\u0080-\uffff])/gi,
      (part) => (part.startsWith("--") || part.startsWith("/*") ? " " : "?"),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function isReadShape(shape: string): boolean {
  // SQLite accepts non-ASCII bare identifiers, but this bounded classifier does
  // not try to reproduce SQLite's tokenizer. Skip uncertain shapes rather than
  // risk treating an identifier fragment as a read keyword.
  if (/[^\x00-\x7f]/.test(shape)) return false;
  const tokens = [...shape.matchAll(/[A-Za-z_][A-Za-z0-9_$]*|[()]/g)].map((match) => match[0].toUpperCase());
  const first = tokens.find((token) => token !== "(" && token !== ")");
  if (first === "SELECT") return true;
  if (first !== "WITH") return false;

  let depth = 0;
  for (const token of tokens.slice(tokens.indexOf("WITH") + 1)) {
    if (token === "(") {
      depth++;
      continue;
    }
    if (token === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0 || token === "RECURSIVE") continue;
    if (["SELECT", "INSERT", "UPDATE", "DELETE", "REPLACE"].includes(token)) return token === "SELECT";
  }
  return false;
}

/** Bounded, process-local observations of completed synchronous SQLite calls. */
export class SqlPerformance {
  private startedAt: number;
  private queriesSince: number;
  private total = emptyTiming();
  private untracked = emptyTiming();
  private queries = new Map<string, QueryTiming>();
  private shapes = new Map<string, { shape: string; hash: string; read: boolean }>();
  private planAttempts = new Set<string>();
  private previousQueries: ReturnType<SqlPerformance["querySnapshot"]> | undefined;

  constructor(
    private readonly limit = 512,
    private readonly now = () => Date.now(),
    private readonly elapsedNow = () => performance.now(),
  ) {
    this.startedAt = this.queriesSince = now();
  }

  private rotateQueries() {
    const now = this.now();
    if (now - this.queriesSince < 300_000) return;
    this.previousQueries = this.querySnapshot(this.queriesSince + 300_000);
    this.queries.clear();
    this.planAttempts.clear();
    this.queriesSince = now;
  }

  statement(
    sql: string,
    explain?: (params: readonly unknown[]) => Array<Record<string, unknown>>,
  ): <T>(operation: string, work: () => T, params?: readonly unknown[]) => T {
    let identity = this.shapes.get(sql);
    if (!identity) {
      const fullShape = queryShape(sql);
      identity = {
        shape: fullShape.slice(0, 800),
        hash: createHash("sha256").update(fullShape).digest("hex").slice(0, 16),
        read: isReadShape(fullShape),
      };
      if (sql.length <= 16_384 && this.shapes.size < this.limit) this.shapes.set(sql, identity);
    }
    const { shape, hash, read } = identity;
    return <T>(operation: string, work: () => T, params: readonly unknown[] = []): T => {
      const id = `${operation}:${hash}`;
      const started = this.elapsedNow();
      let failed = true;
      try {
        const result = work();
        failed = false;
        return result;
      } finally {
        const elapsed = this.elapsedNow() - started;
        this.rotateQueries();
        let query = this.queries.get(id);
        if (!query && this.queries.size < this.limit) {
          query = { id, operation, sql: shape.slice(0, 800), ...emptyTiming() };
          this.queries.set(id, query);
        }
        for (const timing of [this.total, query ?? this.untracked]) {
          timing.calls++;
          timing.errors += Number(failed);
          timing.totalMs += elapsed;
          timing.maxMs = Math.max(timing.maxMs, elapsed);
        }
        if (
          !failed &&
          elapsed > slowReadThresholdMs &&
          (operation === "get" || operation === "all") &&
          read &&
          query &&
          !this.planAttempts.has(id) &&
          explain
        ) {
          this.planAttempts.add(id);
          try {
            const rows = explain(params);
            query.plan = {
              fingerprint: id,
              shape: query.sql,
              capturedAt: this.now(),
              rows: rows.slice(0, planRowLimit).map((row) => ({
                id: Number(row.id),
                parent: Number(row.parent),
                detail: String(row.detail ?? "").slice(0, planDetailLimit),
              })),
              rowsTruncated: rows.length > planRowLimit,
            };
          } catch {
            // Diagnostics must never change the successful read's result or failure semantics.
          }
        }
      }
    };
  }

  private querySnapshot(until: number) {
    const withAverage = <T extends Timing>(entry: T) => ({
      ...entry,
      averageMs: entry.calls ? entry.totalMs / entry.calls : 0,
    });
    const rows = [...this.queries.values()].map(withAverage);
    const top = (field: "totalMs" | "maxMs" | "calls") => [...rows].sort((a, b) => b[field] - a[field]).slice(0, 10);
    return {
      since: this.queriesSince,
      until,
      trackedQueries: this.queries.size,
      topByTotalTime: top("totalMs"),
      topByWorstTime: top("maxMs"),
      topByCalls: top("calls"),
    };
  }

  snapshot() {
    this.rotateQueries();
    return {
      since: this.startedAt,
      measuredAt: this.now(),
      ...this.total,
      averageMs: this.total.calls ? this.total.totalMs / this.total.calls : 0,
      queryLimit: this.limit,
      untracked: { ...this.untracked },
      queries: this.querySnapshot(this.now()),
      previousQueries: this.previousQueries,
    };
  }
}

const performanceByProcess = new SqlPerformance();
export const readSqlPerformance = () => performanceByProcess.snapshot();

export function profileDatabase(db: SqliteDb, profile = performanceByProcess): SqliteDb {
  return {
    exec(sql) {
      return profile.statement(sql)("exec", () => db.exec(sql));
    },
    run(sql, params) {
      return profile.statement(sql)("run", () => db.run(sql, params));
    },
    prepare(sql): Statement {
      const measure = profile.statement(sql, (params) => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params));
      const statement = measure("prepare", () => db.prepare(sql));
      return {
        get: (...params) => measure("get", () => statement.get(...params), params),
        all: (...params) => measure("all", () => statement.all(...params), params),
        run: (...params) => measure("run", () => statement.run(...params), params),
      };
    },
    close() {
      db.close();
    },
  };
}
