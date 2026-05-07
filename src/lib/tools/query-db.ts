/**
 * query_db tool — read-only SQL inspection for the May runtime database.
 *
 * Agents should not guess DB paths or open SQLite from bash. This tool uses
 * the runtime getDb() convention and exposes only bounded read queries.
 */

import { Type } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { getDb } from "../requests.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface QueryDbParams {
  sql: string;
  params?: unknown[];
  limit?: number;
}

interface QueryDbDetails {
  rowCount: number;
  limit: number;
  truncated: boolean;
  columns: string[];
}

function textResult(text: string, details?: QueryDbDetails): AgentToolResult<QueryDbDetails | undefined> {
  return { content: [{ type: "text" as const, text }], details };
}

function clampLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(value)));
}

function normalizeSql(input: unknown): string {
  if (typeof input !== "string") throw new Error("sql must be a string");
  let sql = input.trim();
  if (!sql) throw new Error("sql is required");
  if (sql.endsWith(";")) sql = sql.slice(0, -1).trim();
  if (sql.includes(";")) {
    throw new Error("query_db accepts one statement at a time");
  }
  return sql;
}

function assertReadOnlySql(sql: string): void {
  const lower = sql.toLowerCase();
  const firstWord = lower.match(/^\s*([a-z]+)/)?.[1];

  if (firstWord === "pragma") {
    const pragma = lower.match(/^\s*pragma\s+([a-z_]+)/)?.[1] ?? "";
    const allowed = new Set([
      "database_list",
      "foreign_key_list",
      "index_info",
      "index_list",
      "integrity_check",
      "quick_check",
      "schema_version",
      "table_info",
      "table_list",
      "table_xinfo",
      "user_version",
    ]);
    if (!allowed.has(pragma) || lower.includes("=")) {
      throw new Error(`PRAGMA ${pragma || "<unknown>"} is not allowed by query_db`);
    }
    return;
  }

  if (firstWord !== "select" && firstWord !== "with") {
    throw new Error("query_db only allows SELECT, WITH, and read-only PRAGMA statements");
  }

  const writePattern =
    /\b(attach|alter|analyze|begin|commit|create|delete|detach|drop|insert|reindex|replace|rollback|update|vacuum)\b/i;
  if (writePattern.test(sql)) {
    throw new Error("query_db is read-only; write or schema-changing statements are not allowed");
  }
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `<blob:${value.byteLength}>`;
  return value;
}

function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = normalizeValue(value);
    }
    return normalized;
  });
}

function formatRows(rows: Record<string, unknown>[], limit: number, truncated: boolean): string {
  const payload = {
    rowCount: rows.length,
    limit,
    truncated,
    rows,
  };
  return JSON.stringify(payload, null, 2);
}

function queryWithLimit(sql: string): string {
  return `SELECT * FROM (${sql}) LIMIT ?`;
}

export function createQueryDbTool(persistDir: string): AgentTool {
  return {
    name: "query_db",
    label: "Query DB",
    description:
      "Run a bounded read-only query against the runtime SQLite DB. Use this instead of sqlite3, bun:sqlite, or guessing .state/may.db. Allows SELECT/WITH and read-only PRAGMA only.",
    parameters: Type.Object({
      sql: Type.String({
        description:
          "A single read-only SQL statement. Allowed: SELECT, WITH, or read-only PRAGMA such as PRAGMA table_info(sessions).",
      }),
      params: Type.Optional(
        Type.Array(Type.Unknown(), {
          description: "Optional positional bind parameters for ? placeholders.",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: `Maximum rows to return. Default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}.`,
          default: DEFAULT_LIMIT,
        }),
      ),
    }),
    execute: async (_toolCallId, rawParams) => {
      try {
        const params = rawParams as QueryDbParams;
        const sql = normalizeSql(params.sql);
        assertReadOnlySql(sql);

        const limit = clampLimit(params.limit);
        const bindParams = Array.isArray(params.params) ? params.params : [];
        const db = getDb(persistDir);

        const isPragma = /^\s*pragma\b/i.test(sql);
        const statement = db.prepare(isPragma ? sql : queryWithLimit(sql));
        const rows = normalizeRows(
          statement.all(...(isPragma ? bindParams : [...bindParams, limit + 1])) as Record<string, unknown>[],
        );
        const truncated = rows.length > limit;
        const visibleRows = truncated ? rows.slice(0, limit) : rows;
        const columns = visibleRows.length > 0 ? Object.keys(visibleRows[0]) : [];

        return textResult(formatRows(visibleRows, limit, truncated), {
          rowCount: visibleRows.length,
          limit,
          truncated,
          columns,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return textResult(JSON.stringify({ error: message }, null, 2));
      }
    },
  };
}
