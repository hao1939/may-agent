/**
 * convention-check — Mechanical convention compliance checker.
 *
 * Runs on evaluated sessions, parses transcripts, and checks against
 * the convention registry (agents/shared/CONVENTIONS.md).
 * Writes results to `convention_checks` table in may.db.
 *
 * Phase 1 checks: C1.1, C1.3, C1.4, C1.5, C1.7, C2.1, C3.2, C3.3, C6.1, C7.1, C8.2, C12.1
 *
 * Exports create() conforming to HandlerModule.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import type { SqliteDb } from "../../../src/lib/db.js";

// ── Types ─────────────────────────────────────────────────────────────

interface TranscriptEntry {
  role: string;
  content?: unknown;
  toolName?: string;
  toolCallId?: string;
  name?: string;
}

interface ToolCall {
  index: number;
  name: string;
  /** Parsed input arguments (best-effort). */
  input: Record<string, unknown>;
  /** Raw tool result content if available. */
  resultContent?: string;
  /** Whether this call had an error result. */
  isError?: boolean;
}

interface CheckResult {
  convention: string;
  passed: boolean;
  violations: string[];
}

// ── Configuration ─────────────────────────────────────────────────────

/** Agents exempt from workspace-isolation checks (they write everywhere). */
const WORKSPACE_EXEMPT_AGENTS = new Set(["may", "tech-lead"]);

/** Allowed write prefixes for all agents. */
const ALLOWED_WRITE_PREFIXES = [".state/", "tmp/", "/tmp/"];

/** Known append-only file patterns (C3.3). */
const APPEND_ONLY_PATTERNS = [
  /journal\.md$/,
  /history\.md$/,
  /\.jsonl$/,
];

/** Forbidden path prefixes (C7.1). */
const FORBIDDEN_PATH_PREFIXES = ["/home/", "~/", "/Users/", "/root/"];

/** Lookback for regression detection (7 days in ms). */
const REGRESSION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** Minimum sessions needed before regression detection applies. */
const MIN_SESSIONS_FOR_REGRESSION = 10;

/** Regression threshold: 5 percentage points drop. */
const REGRESSION_THRESHOLD_PP = 5;

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const result = runConventionChecks({
      persistDir: ctx.persistDir,
      agentsRoot: ctx.agentsRoot,
      log: (msg) => ctx.log(msg),
      getDb: ctx.getDb,
    });

    if (result.sessionsChecked === 0) {
      return; // Nothing to do — silent
    }

    ctx.log(
      `[convention-check] Checked ${result.sessionsChecked} session(s): ` +
        `${result.totalPassed}/${result.totalChecks} checks passed. ` +
        `${result.errors.length} error(s).`
    );

    // Check for regressions and trigger coaching
    if (result.regressions.length > 0) {
      for (const reg of result.regressions) {
        ctx.log(
          `[convention-check] 🚨 Regression: ${reg.agent} ${reg.convention} ` +
            `dropped from ${reg.previousRate}% to ${reg.currentRate}%`
        );
      }
      ctx.triggerNow("heartbeat-coach");
    }
  };
};

// ── Main logic ────────────────────────────────────────────────────────

export interface ConventionCheckResult {
  sessionsChecked: number;
  totalChecks: number;
  totalPassed: number;
  regressions: RegressionEntry[];
  errors: string[];
}

interface RegressionEntry {
  agent: string;
  convention: string;
  previousRate: number;
  currentRate: number;
}

export function runConventionChecks(opts: {
  persistDir: string;
  agentsRoot: string;
  log: (msg: string) => void;
  getDb: () => SqliteDb;
}): ConventionCheckResult {
  const { persistDir, agentsRoot, log } = opts;
  const db = opts.getDb();
  const now = Date.now();

  const result: ConventionCheckResult = {
    sessionsChecked: 0,
    totalChecks: 0,
    totalPassed: 0,
    regressions: [],
    errors: [],
  };

  // Find evaluated sessions not yet convention-checked
  const uncheckedSessions = findUncheckedSessions(persistDir, db);

  if (uncheckedSessions.length === 0) {
    return result;
  }

  // Cap per run to avoid long-running handler
  const MAX_PER_RUN = 20;
  const batch = uncheckedSessions.slice(0, MAX_PER_RUN);
  if (uncheckedSessions.length > MAX_PER_RUN) {
    log(`[convention-check] ${uncheckedSessions.length} unchecked — processing ${MAX_PER_RUN} this run`);
  }

  // Prepare insert statement
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO convention_checks (session_id, agent, convention, passed, violations, checked_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const { sessionId, agent } of batch) {
    try {
      const toolCalls = loadToolCalls(persistDir, sessionId);
      if (toolCalls === null) {
        // Unparseable transcript — skip entirely
        continue;
      }

      const checks = runAllChecks(toolCalls, agent);
      result.sessionsChecked++;

      for (const check of checks) {
        result.totalChecks++;
        if (check.passed) result.totalPassed++;

        insertStmt.run(
          sessionId,
          agent,
          check.convention,
          check.passed ? 1 : 0,
          check.violations.length > 0 ? JSON.stringify(check.violations) : null,
          now
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Session ${sessionId}: ${msg}`);
    }
  }

  // Detect regressions
  result.regressions = detectRegressions(db, now);

  // Write summary
  writeSummary(persistDir, db, now);

  return result;
}

// ── Session discovery ─────────────────────────────────────────────────

interface UncheckedSession {
  sessionId: string;
  agent: string;
}

function findUncheckedSessions(
  _persistDir: string,
  db: SqliteDb
): UncheckedSession[] {
  const MAX_SCAN = 200;

  // Query evaluations table for sessions not yet convention-checked.
  // Uses NOT IN subquery to exclude already-checked sessions.
  const rows = db
    .prepare(
      `SELECT DISTINCT e.sessionId, e.agent
       FROM evaluations e
       WHERE e.agent != 'evaluator'
         AND e.sessionId NOT IN (SELECT DISTINCT session_id FROM convention_checks)
       ORDER BY e.createdAt DESC
       LIMIT ?`
    )
    .all(MAX_SCAN) as Array<{ sessionId: string; agent: string }>;

  return rows.map((r) => ({ sessionId: r.sessionId, agent: r.agent }));
}

// ── Transcript parsing ────────────────────────────────────────────────

function loadToolCalls(persistDir: string, sessionId: string): ToolCall[] | null {
  const paths = [
    join(persistDir, "sessions", "history", sessionId, "session.jsonl"),
    join(persistDir, "sessions", sessionId, "session.jsonl"),
  ];

  let content: string | null = null;
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        content = readFileSync(p, "utf-8");
      } catch {
        return null;
      }
      break;
    }
  }

  if (!content) return null;

  const toolCalls: ToolCall[] = [];
  const lines = content.split("\n").filter(Boolean);
  let callIndex = 0;

  // Track pending tool calls from assistant messages
  const pendingCalls = new Map<string, ToolCall>();

  for (const line of lines) {
    let entry: TranscriptEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.role === "assistant" && Array.isArray(entry.content)) {
      for (const block of entry.content) {
        if (block.type === "tool_use" || block.type === "tool_call" || block.type === "toolCall") {
          const tc: ToolCall = {
            index: callIndex++,
            name: block.name || "",
            input: block.input || block.arguments || {},
          };
          toolCalls.push(tc);
          if (block.id) {
            pendingCalls.set(block.id, tc);
          }
        }
      }
    }

    // Match tool results back to calls
    if (
      (entry.role === "toolResult" || entry.role === "tool") &&
      entry.toolCallId
    ) {
      const tc = pendingCalls.get(entry.toolCallId);
      if (tc) {
        // Extract text content
        if (Array.isArray(entry.content)) {
          tc.resultContent = entry.content
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text || "")
            .join("");
        } else if (typeof entry.content === "string") {
          tc.resultContent = entry.content;
        }
        // Check for error indicators
        if (tc.resultContent) {
          tc.isError =
            tc.resultContent.includes("ENOENT:") ||
            tc.resultContent.includes("Error:") ||
            tc.resultContent.startsWith("error");
        }
      }
    }
  }

  return toolCalls;
}

// ── Check implementations ─────────────────────────────────────────────

function runAllChecks(toolCalls: ToolCall[], agent: string): CheckResult[] {
  if (toolCalls.length === 0) return [];

  return [
    checkC1_1_readBeforeEdit(toolCalls),
    checkC1_3_verifyWrites(toolCalls),
    checkC1_4_finishClearly(toolCalls),
    checkC1_5_ghostDeliverables(toolCalls),
    checkC2_1_preciseArgs(toolCalls),
    checkC3_2_workspaceIsolation(toolCalls, agent),
    checkC3_3_safeAppend(toolCalls),
    checkC6_1_budgetAwareness(toolCalls),
    checkC7_1_rootIsApp(toolCalls),
    checkC8_2_promiseDeliverReport(toolCalls),
    checkC12_1_sessionStart(toolCalls, agent),
    checkC1_7_verificationEvidence(toolCalls),
  ];
}

/**
 * C1.1: read-before-edit
 * For every edit()/write() target path, there must be a preceding read() of that path.
 */
function checkC1_1_readBeforeEdit(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];
  const readPaths = new Set<string>();

  for (const tc of toolCalls) {
    if (tc.name === "read") {
      const path = extractPath(tc.input);
      if (path) readPaths.add(normalizePath(path));
    }
    if (tc.name === "edit" || tc.name === "write") {
      const path = extractPath(tc.input);
      if (path) {
        const normed = normalizePath(path);
        if (!readPaths.has(normed)) {
          violations.push(`${tc.name}(${path}) without prior read`);
        }
      }
    }
  }

  return { convention: "C1.1", passed: violations.length === 0, violations };
}

/**
 * C1.3: verify-writes
 * For every edit()/write(), there must be a subsequent read() of that path.
 */
function checkC1_3_verifyWrites(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];
  // Track paths that need verification (edit/write happened, no subsequent read)
  const unverified = new Map<string, string>(); // normPath → original tool description

  for (const tc of toolCalls) {
    if (tc.name === "edit" || tc.name === "write") {
      const path = extractPath(tc.input);
      if (path) {
        unverified.set(normalizePath(path), `${tc.name}(${path})`);
      }
    }
    if (tc.name === "read") {
      const path = extractPath(tc.input);
      if (path) {
        unverified.delete(normalizePath(path));
      }
    }
    // Also count bash cat as verification
    if (tc.name === "bash") {
      const cmd = String(tc.input.command || "");
      // Simple heuristic: cat <path> counts
      for (const [normed] of unverified) {
        if (cmd.includes(`cat ${normed}`) || cmd.includes(`cat "${normed}"`)) {
          unverified.delete(normed);
        }
      }
    }
  }

  for (const [, desc] of unverified) {
    violations.push(`${desc} not verified with subsequent read`);
  }

  return { convention: "C1.3", passed: violations.length === 0, violations };
}

/**
 * C1.4: finish-clearly
 * Last tool call must be finish().
 */
function checkC1_4_finishClearly(toolCalls: ToolCall[]): CheckResult {
  if (toolCalls.length === 0) {
    return { convention: "C1.4", passed: false, violations: ["No tool calls in session"] };
  }

  const last = toolCalls[toolCalls.length - 1];
  const passed = last.name === "finish";

  return {
    convention: "C1.4",
    passed,
    violations: passed ? [] : [`Last tool call was ${last.name}(), not finish()`],
  };
}

/**
 * C1.5: ghost-deliverables
 * Every deliverable path declared in finish(success/partial) must exist on disk.
 * Uses fs.existsSync — same logic as src/lib/finish-guard.ts but applied post-hoc.
 */
function checkC1_5_ghostDeliverables(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];
  const finishCalls = toolCalls.filter((tc) => tc.name === "finish");

  for (const tc of finishCalls) {
    const status = tc.input?.status as string | undefined;
    if (!status || (status !== "success" && status !== "partial")) continue;

    const deliverables = tc.input?.deliverables as Array<{ path?: string }> | undefined;
    if (!deliverables || !Array.isArray(deliverables)) continue;

    for (const d of deliverables) {
      if (!d.path || typeof d.path !== "string") continue;
      const resolved = d.path.startsWith("/") ? d.path : join("/app", d.path);
      if (!existsSync(resolved)) {
        violations.push(`Ghost deliverable: '${d.path}' declared in finish(${status}) but does not exist on disk`);
      }
    }
  }

  return { convention: "C1.5", passed: violations.length === 0, violations };
}

/**
 * C2.1: precise-args
 * Check tool results for schema validation errors.
 */
function checkC2_1_preciseArgs(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];
  const errorPatterns = [
    /Invalid arguments/i,
    /schema validation/i,
    /missing required/i,
    /unexpected.*parameter/i,
  ];

  for (const tc of toolCalls) {
    if (tc.resultContent) {
      for (const pattern of errorPatterns) {
        if (pattern.test(tc.resultContent)) {
          violations.push(`${tc.name}() got schema error: ${tc.resultContent.substring(0, 100)}`);
          break;
        }
      }
    }
  }

  return { convention: "C2.1", passed: violations.length === 0, violations };
}

/**
 * C3.2: workspace-isolation
 * All write()/edit() paths must be within agents/[agentName]/workspace/ or allowed prefixes.
 * Exempt: may, tech-lead.
 */
function checkC3_2_workspaceIsolation(toolCalls: ToolCall[], agent: string): CheckResult {
  if (WORKSPACE_EXEMPT_AGENTS.has(agent)) {
    return { convention: "C3.2", passed: true, violations: [] };
  }

  const violations: string[] = [];
  const agentPrefix = `agents/${agent}/`;

  for (const tc of toolCalls) {
    if (tc.name !== "edit" && tc.name !== "write") continue;
    const path = extractPath(tc.input);
    if (!path) continue;

    const normed = normalizePath(path);

    // Check if it's in agent's own directory or allowed prefixes
    const isAllowed =
      normed.startsWith(agentPrefix) ||
      ALLOWED_WRITE_PREFIXES.some((p) => normed.startsWith(p));

    if (!isAllowed) {
      violations.push(`${tc.name}(${path}) outside workspace`);
    }
  }

  return { convention: "C3.2", passed: violations.length === 0, violations };
}

/**
 * C3.3: safe-append
 * write() should not be used on known append-only files.
 */
function checkC3_3_safeAppend(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];

  for (const tc of toolCalls) {
    if (tc.name !== "write") continue;
    const path = extractPath(tc.input);
    if (!path) continue;

    for (const pattern of APPEND_ONLY_PATTERNS) {
      if (pattern.test(path)) {
        violations.push(`write(${path}) on append-only file`);
        break;
      }
    }
  }

  return { convention: "C3.3", passed: violations.length === 0, violations };
}

/**
 * C6.1: budget-awareness
 * Check total tool calls vs reasonable budget. If > 45 tool ops in a session, flag.
 * (Approximation: most sessions have budget ~50 ops.)
 */
function checkC6_1_budgetAwareness(toolCalls: ToolCall[]): CheckResult {
  // Heuristic: if the session has very high tool call count, it's hitting limits
  // We can't know the exact budget, so use 90% of typical 50-op budget = 45
  const BUDGET_THRESHOLD = 45;
  const passed = toolCalls.length < BUDGET_THRESHOLD;

  return {
    convention: "C6.1",
    passed,
    violations: passed
      ? []
      : [`${toolCalls.length} tool calls (likely hitting budget limit)`],
  };
}

/**
 * C7.1: root-is-app
 * No bash commands should reference /home/, ~, /Users/.
 */
function checkC7_1_rootIsApp(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];

  for (const tc of toolCalls) {
    if (tc.name !== "bash") continue;
    const cmd = String(tc.input.command || "");

    for (const prefix of FORBIDDEN_PATH_PREFIXES) {
      if (cmd.includes(prefix)) {
        violations.push(`bash command references ${prefix}: ${cmd.substring(0, 80)}`);
        break;
      }
    }
  }

  return { convention: "C7.1", passed: violations.length === 0, violations };
}

/**
 * C8.2: promise-deliver-report
 * Check for a plan in early assistant messages and a finish() with summary/completed_items.
 */
function checkC8_2_promiseDeliverReport(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];

  // Check if finish() has summary or completed_items
  const finishCall = toolCalls.find((tc) => tc.name === "finish");
  if (!finishCall) {
    violations.push("No finish() call — cannot verify report");
  } else {
    const input = finishCall.input;
    const hasSummary = typeof input.summary === "string" && input.summary.length > 0;
    const hasCompleted = Array.isArray(input.completed_items) && input.completed_items.length > 0;
    if (!hasSummary && !hasCompleted) {
      violations.push("finish() has no summary or completed_items");
    }
  }

  return {
    convention: "C8.2",
    passed: violations.length === 0,
    violations,
  };
}

/**
 * C12.1: session-start
 * First tool call should be read() of heartbeat.md.
 */
function checkC12_1_sessionStart(toolCalls: ToolCall[], agent: string): CheckResult {
  if (toolCalls.length === 0) {
    return { convention: "C12.1", passed: false, violations: ["No tool calls"] };
  }

  const first = toolCalls[0];
  if (first.name !== "read") {
    return {
      convention: "C12.1",
      passed: false,
      violations: [`First tool call was ${first.name}(), not read()`],
    };
  }

  const path = extractPath(first.input);
  if (!path) {
    return { convention: "C12.1", passed: false, violations: ["First read() has no path"] };
  }

  const isHeartbeat =
    path.includes("heartbeat.md") ||
    path.includes(`agents/${agent}/heartbeat`);

  return {
    convention: "C12.1",
    passed: isHeartbeat,
    violations: isHeartbeat ? [] : [`First read() was ${path}, not heartbeat.md`],
  };
}

/**
 * C1.7: verification-evidence
 * If finish(status: "success"), there must be at least one verification command
 * (bash with grep/ls/test/curl/node/python, or read()) in the last N tool calls.
 */
function checkC1_7_verificationEvidence(toolCalls: ToolCall[]): CheckResult {
  // Find finish calls with status "success"
  const finishCalls = toolCalls.filter(
    (tc) => tc.name === "finish" && tc.input?.status === "success"
  );

  if (finishCalls.length === 0) {
    // No success claim — not applicable, pass by default
    return { convention: "C1.7", passed: true, violations: [] };
  }

  const violations: string[] = [];

  for (const finish of finishCalls) {
    // Look at the last 5 tool calls before this finish
    const finishIdx = finish.index;
    const lookbackStart = Math.max(0, finishIdx - 5);
    const recentCalls = toolCalls.filter(
      (tc) => tc.index >= lookbackStart && tc.index < finishIdx
    );

    // Check for verification signals
    const VERIFICATION_PATTERNS = [
      /\bgrep\b/,
      /\bls\b/,
      /\btest\b/,
      /\bcurl\b/,
      /\bnode\b/,
      /\bpython\b/,
      /\bcat\b/,
      /\bwc\b/,
      /\bfind\b/,
      /\bdiff\b/,
      /\btsc\b/,
      /\bvitest\b/,
    ];

    let hasVerification = false;

    for (const tc of recentCalls) {
      // read() counts as verification
      if (tc.name === "read") {
        hasVerification = true;
        break;
      }
      // bash with verification command
      if (tc.name === "bash") {
        const cmd = String(tc.input.command || "");
        if (VERIFICATION_PATTERNS.some((p) => p.test(cmd))) {
          hasVerification = true;
          break;
        }
      }
    }

    if (!hasVerification) {
      violations.push(
        "finish(success) without verification: no grep/ls/test/read in last 5 tool calls"
      );
    }
  }

  return { convention: "C1.7", passed: violations.length === 0, violations };
}

// ── Regression detection ──────────────────────────────────────────────

function detectRegressions(
  db: SqliteDb,
  now: number
): RegressionEntry[] {
  const regressions: RegressionEntry[] = [];
  const halfWindow = REGRESSION_LOOKBACK_MS / 2;

  // Get per-agent per-convention rates for two windows:
  // Recent (last 3.5d) vs Previous (3.5d-7d)
  const conventions = [
    "C1.1", "C1.3", "C1.4", "C1.5", "C1.7", "C2.1", "C3.2", "C3.3",
    "C6.1", "C7.1", "C8.2", "C12.1",
  ];

  for (const convention of conventions) {
    const recentRows = db
      .prepare(
        `SELECT agent, SUM(passed) as passes, COUNT(*) as total
         FROM convention_checks
         WHERE convention = ? AND checked_at > ?
         GROUP BY agent`
      )
      .all(convention, now - halfWindow) as Array<{ agent: string; passes: number; total: number }>;

    const prevRows = db
      .prepare(
        `SELECT agent, SUM(passed) as passes, COUNT(*) as total
         FROM convention_checks
         WHERE convention = ? AND checked_at > ? AND checked_at <= ?
         GROUP BY agent`
      )
      .all(convention, now - REGRESSION_LOOKBACK_MS, now - halfWindow) as Array<{
        agent: string;
        passes: number;
        total: number;
      }>;

    const prevMap = new Map(prevRows.map((r) => [r.agent, r]));

    for (const recent of recentRows) {
      const prev = prevMap.get(recent.agent);
      if (!prev) continue;
      if (recent.total < MIN_SESSIONS_FOR_REGRESSION / 2) continue;
      if (prev.total < MIN_SESSIONS_FOR_REGRESSION / 2) continue;

      const recentRate = (recent.passes / recent.total) * 100;
      const prevRate = (prev.passes / prev.total) * 100;

      if (prevRate - recentRate >= REGRESSION_THRESHOLD_PP) {
        regressions.push({
          agent: recent.agent,
          convention,
          previousRate: Math.round(prevRate * 10) / 10,
          currentRate: Math.round(recentRate * 10) / 10,
        });
      }
    }
  }

  return regressions;
}

// ── Summary output ────────────────────────────────────────────────────

function writeSummary(
  persistDir: string,
  db: SqliteDb,
  now: number
): void {
  const summaryDir = join(persistDir, "convention-checks");
  mkdirSync(summaryDir, { recursive: true });

  // Aggregate pass rates per agent per convention (7d window)
  const rows = db
    .prepare(
      `SELECT agent, convention, SUM(passed) as passes, COUNT(*) as total
       FROM convention_checks
       WHERE checked_at > ?
       GROUP BY agent, convention`
    )
    .all(now - REGRESSION_LOOKBACK_MS) as Array<{
      agent: string;
      convention: string;
      passes: number;
      total: number;
    }>;

  const summary: Record<string, Record<string, { passes: number; total: number; rate: number }>> = {};

  for (const row of rows) {
    if (!summary[row.agent]) summary[row.agent] = {};
    summary[row.agent][row.convention] = {
      passes: row.passes,
      total: row.total,
      rate: Math.round((row.passes / row.total) * 1000) / 10,
    };
  }

  const output = {
    generatedAt: new Date(now).toISOString(),
    windowDays: 7,
    agents: summary,
  };

  writeFileSync(
    join(summaryDir, "summary.json"),
    JSON.stringify(output, null, 2),
    "utf-8"
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function extractPath(input: Record<string, unknown>): string | null {
  if (typeof input.path === "string") return input.path;
  if (typeof input.file === "string") return input.file;
  return null;
}

function normalizePath(path: string): string {
  // Strip leading /app/ or ./ for consistent comparison
  return path
    .replace(/^\/app\//, "")
    .replace(/^\.\//, "");
}
