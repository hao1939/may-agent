import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── Mock db.ts so openDatabase works without node:sqlite ──────────────
// Vitest runs under Node 18 which lacks node:sqlite. We provide a minimal
// in-memory SqliteDb implementation that handles the SQL patterns used by
// requests.ts (evaluations table CRUD + schema DDL).

vi.mock("../src/lib/db.js", () => {
  /** Tiny in-memory SQL-ish store keyed by table name → rows (Map by PK). */
  function createMemoryDb() {
    const tables = new Map<string, Map<string, Record<string, unknown>>>();

    function getTable(name: string): Map<string, Record<string, unknown>> {
      if (!tables.has(name)) tables.set(name, new Map());
      return tables.get(name)!;
    }

    // Parse "INSERT OR REPLACE INTO <table> (...cols...) VALUES (?, ...)"
    function parseInsert(sql: string): { table: string; cols: string[] } | null {
      const m = sql.match(/INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
      if (!m) return null;
      return { table: m[1], cols: m[2].split(",").map((c) => c.trim()) };
    }

    // Parse "SELECT ... FROM <table> WHERE <col> = ?"
    // Also handles "WHERE col1 = ? AND col2 = val AND col3 = val"
    function parseSelect(sql: string): { table: string; cols: string | "*"; whereCol: string; extraConditions?: Array<{ col: string; val: string }> } | null {
      const m = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?(?:\s+AND\s+(.+))?/i);
      if (!m) return null;
      const result: { table: string; cols: string | "*"; whereCol: string; extraConditions?: Array<{ col: string; val: string }> } = {
        cols: m[1].trim(), table: m[2], whereCol: m[3],
      };
      // Parse additional "AND col = val" conditions (literal values, not params)
      if (m[4]) {
        const extras = m[4].split(/\s+AND\s+/i);
        result.extraConditions = extras.map(cond => {
          const cm = cond.trim().match(/(\w+)\s*=\s*(.+)/);
          return cm ? { col: cm[1], val: cm[2].trim() } : { col: "", val: "" };
        }).filter(c => c.col);
      }
      return result;
    }

    const db = {
      exec(_sql: string) {
        /* DDL / PRAGMA — no-op */
      },
      prepare(sql: string) {
        const sel = parseSelect(sql);
        return {
          get(...params: unknown[]): Record<string, unknown> | null {
            if (!sel) return null;
            const tbl = getTable(sel.table);
            for (const row of tbl.values()) {
              if (row[sel.whereCol] !== params[0]) continue;
              // Check extra conditions (literal value comparisons)
              if (sel.extraConditions) {
                const allMatch = sel.extraConditions.every(ec => {
                  const rowVal = row[ec.col];
                  const expected = Number(ec.val);
                  return rowVal === expected || String(rowVal) === ec.val;
                });
                if (!allMatch) continue;
              }
              if (sel.cols === "1") return { "1": 1 };
              return { ...row };
            }
            return null;
          },
          all(...params: unknown[]): Record<string, unknown>[] {
            if (!sel) return [];
            const tbl = getTable(sel.table);
            const results: Record<string, unknown>[] = [];
            for (const row of tbl.values()) {
              if (row[sel.whereCol] === params[0]) {
                results.push({ ...row });
              }
            }
            return results;
          },
          run(...params: unknown[]) {
            // INSERT OR REPLACE
            const ins = parseInsert(sql);
            if (ins) {
              const row: Record<string, unknown> = {};
              ins.cols.forEach((col, i) => {
                row[col] = params[i];
              });
              const pk = row[ins.cols[0]] as string;
              getTable(ins.table).set(pk, row);
              return { changes: 1, lastInsertRowid: 0 };
            }
            return { changes: 0, lastInsertRowid: 0 };
          },
        };
      },
      run(sql: string, params?: unknown[]) {
        const ins = parseInsert(sql);
        if (ins && params) {
          const row: Record<string, unknown> = {};
          ins.cols.forEach((col, i) => {
            row[col] = params[i];
          });
          const pk = row[ins.cols[0]] as string;
          getTable(ins.table).set(pk, row);
          return { changes: 1, lastInsertRowid: 0 };
        }
        return { changes: 0, lastInsertRowid: 0 };
      },
      close() {
        tables.clear();
      },
    };
    return db;
  }

  return {
    openDatabase: (_path: string) => createMemoryDb(),
  };
});

import { findUnevaluatedChildren } from "../src/lib/evaluator.js";
import { upsertEvaluation, hasEvaluation, hasLLMEvaluation, closeDb } from "../src/lib/requests.js";
import type { PersistedSession } from "../src/lib/persistence.js";

function tmpDir(): string {
  const dir = join(tmpdir(), `eval-task-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeRegistry(sessions: Record<string, Partial<PersistedSession>>): Record<string, PersistedSession> {
  const result: Record<string, PersistedSession> = {};
  for (const [id, partial] of Object.entries(sessions)) {
    result[id] = {
      agent: partial.agent ?? "coder",
      task: partial.task ?? "test task",
      status: partial.status ?? "done",
      startedAt: partial.startedAt ?? Date.now(),
      parentSessionId: partial.parentSessionId,
      workflowRunId: partial.workflowRunId,
      stepLabel: partial.stepLabel,
    };
  }
  return result;
}

function writeSessionJsonl(persistDir: string, sessionId: string, messages: unknown[]): void {
  // Write to active sessions dir (readSessionMessages reads from here)
  const dir = join(persistDir, "sessions", sessionId);
  mkdirSync(dir, { recursive: true });
  const jsonl = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
  writeFileSync(join(dir, "session.jsonl"), jsonl, "utf-8");
}

function writeEvaluation(persistDir: string, sessionId: string): void {
  upsertEvaluation(persistDir, {
    sessionId,
    agent: "test",
    quality: 0,
    efficiency: 0,
    verdict: "skipped",
    createdAt: Date.now(),
  });
}

/** Write a heuristic-only evaluation (as evaluation-sync does). */
function writeHeuristicEvaluation(persistDir: string, sessionId: string): void {
  upsertEvaluation(persistDir, {
    sessionId,
    agent: "test",
    quality: 1.0,
    efficiency: 0.8,
    verdict: "good",
    evaluatedByHeuristic: true,
    createdAt: Date.now(),
  });
}

const skipAgents = new Set(["evaluator", "optimizer", "may"]);

const fakeMessages = [
  { role: "user", content: [{ type: "text", text: "do something" }], timestamp: 1 },
  { role: "assistant", content: [{ type: "text", text: "done" }] },
];

describe("findUnevaluatedChildren", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = tmpDir();
  });

  it("finds unevaluated child sessions", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "qa-1": { agent: "qa", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "qa-1", fakeMessages);

    const children = findUnevaluatedChildren(persistDir, registry, "may-session", skipAgents);
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.agent).sort()).toEqual(["coder", "qa"]);
  });

  it("skips already evaluated sessions", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "coder-2", fakeMessages);
    writeEvaluation(persistDir, "coder-1"); // already evaluated

    const children = findUnevaluatedChildren(persistDir, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].sessionId).toBe("coder-2");
  });

  it("skips meta agents (evaluator, optimizer, may)", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "eval-1": { agent: "evaluator", status: "done", parentSessionId: "may-session" },
      "opt-1": { agent: "optimizer", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "eval-1", fakeMessages);
    writeSessionJsonl(persistDir, "opt-1", fakeMessages);

    const children = findUnevaluatedChildren(persistDir, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].agent).toBe("coder");
  });

  it("skips sessions still running", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "running", parentSessionId: "may-session" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "coder-2", fakeMessages);

    const children = findUnevaluatedChildren(persistDir, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].sessionId).toBe("coder-2");
  });

  it("skips sessions from other parents", () => {
    const registry = makeRegistry({
      "may-1": { agent: "may", status: "idle" },
      "may-2": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-1" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-2" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "coder-2", fakeMessages);

    const children = findUnevaluatedChildren(persistDir, registry, "may-1", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].sessionId).toBe("coder-1");
  });

  it("skips sessions with empty transcripts", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    // coder-2 has no transcript written

    const children = findUnevaluatedChildren(persistDir, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].sessionId).toBe("coder-1");
  });

  it("returns empty when all children are evaluated", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeEvaluation(persistDir, "coder-1");

    const children = findUnevaluatedChildren(persistDir, registry, "may-session", skipAgents);
    expect(children).toHaveLength(0);
  });

  it("returns empty when parent has no children", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
    });

    const children = findUnevaluatedChildren(persistDir, registry, "may-session", skipAgents);
    expect(children).toHaveLength(0);
  });

  it("loads messages from child sessions", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session", task: "implement foo" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);

    const children = findUnevaluatedChildren(persistDir, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].agent).toBe("coder");
    expect(children[0].task).toBe("implement foo");
    expect(children[0].messages).toHaveLength(2);
    expect(children[0].messages[0].role).toBe("user");
  });

  it("includes sessions with only heuristic evaluations (allows LLM upgrade)", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "coder-2", fakeMessages);
    writeHeuristicEvaluation(persistDir, "coder-1"); // heuristic-only → should be re-evaluated

    const children = findUnevaluatedChildren(persistDir, registry, "may-session", skipAgents);
    expect(children).toHaveLength(2); // Both should be included
    const sessionIds = children.map(c => c.sessionId).sort();
    expect(sessionIds).toEqual(["coder-1", "coder-2"]);
  });

  it("skips sessions with LLM evaluations (no double LLM eval)", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "coder-2", fakeMessages);
    writeEvaluation(persistDir, "coder-1"); // LLM-style eval (evaluatedByHeuristic=false)

    const children = findUnevaluatedChildren(persistDir, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].sessionId).toBe("coder-2");
  });

  it("hasLLMEvaluation returns false for heuristic evals", () => {
    writeHeuristicEvaluation(persistDir, "test-session-1");
    expect(hasEvaluation(persistDir, "test-session-1")).toBe(true);
    expect(hasLLMEvaluation(persistDir, "test-session-1")).toBe(false);
  });

  it("hasLLMEvaluation returns true for LLM evals", () => {
    writeEvaluation(persistDir, "test-session-2");
    expect(hasEvaluation(persistDir, "test-session-2")).toBe(true);
    expect(hasLLMEvaluation(persistDir, "test-session-2")).toBe(true);
  });
});

