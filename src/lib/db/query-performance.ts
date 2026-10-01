import { createHash } from "node:crypto";
import type { SqliteDb, Statement } from "../db.js";

type Timing = { calls: number; errors: number; totalMs: number; maxMs: number };
type QueryTiming = Timing & { id: string; operation: string; sql: string };
const emptyTiming = (): Timing => ({ calls: 0, errors: 0, totalMs: 0, maxMs: 0 });

// SQL values and comments are not diagnostic data. Bound the exported shape;
// parameters, result rows, error messages and database paths are never collected.
function queryShape(sql: string): string {
  return sql
    .replace(
      /'(?:''|[^'])*(?:'|$)|"(?:""|[^"])*(?:"|$)|`(?:``|[^`])*(?:`|$)|\[[^\]]*(?:\]|$)|--[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi,
      (part) => (part.startsWith("--") || part.startsWith("/*") ? " " : "?"),
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Bounded, process-local observations of completed synchronous SQLite calls. */
export class SqlPerformance {
  private startedAt: number;
  private queriesSince: number;
  private total = emptyTiming();
  private untracked = emptyTiming();
  private queries = new Map<string, QueryTiming>();
  private shapes = new Map<string, { shape: string; hash: string }>();
  private previousQueries: ReturnType<SqlPerformance["querySnapshot"]> | undefined;

  constructor(
    private readonly limit = 512,
    private readonly now = () => Date.now(),
  ) {
    this.startedAt = this.queriesSince = now();
  }

  private rotateQueries() {
    const now = this.now();
    if (now - this.queriesSince < 300_000) return;
    this.previousQueries = this.querySnapshot(this.queriesSince + 300_000);
    this.queries.clear();
    this.queriesSince = now;
  }

  statement(sql: string): <T>(operation: string, work: () => T) => T {
    let identity = this.shapes.get(sql);
    if (!identity) {
      const shape = queryShape(sql);
      identity = { shape: shape.slice(0, 800), hash: createHash("sha256").update(shape).digest("hex").slice(0, 16) };
      if (sql.length <= 16_384 && this.shapes.size < this.limit) this.shapes.set(sql, identity);
    }
    const { shape, hash } = identity;
    return <T>(operation: string, work: () => T): T => {
      const id = `${operation}:${hash}`;
      const started = performance.now();
      let failed = true;
      try {
        const result = work();
        failed = false;
        return result;
      } finally {
        const elapsed = performance.now() - started;
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
      const measure = profile.statement(sql);
      const statement = measure("prepare", () => db.prepare(sql));
      return {
        get: (...params) => measure("get", () => statement.get(...params)),
        all: (...params) => measure("all", () => statement.all(...params)),
        run: (...params) => measure("run", () => statement.run(...params)),
      };
    },
    close() {
      db.close();
    },
  };
}
