/**
 * convention-check — Mechanical convention compliance checker.
 * Checks evaluated sessions against CONVENTIONS.md, writes to convention_checks table.
 * Phase 1 checks: C1.1, C1.3, C1.4, C1.5, C1.7, C2.1, C3.2, C3.3, C6.1, C7.1, C8.2, C12.1
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import type { SqliteDb } from "../../../src/lib/db.js";
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
/** Agents exempt from workspace-isolation checks (they write everywhere). */
const WORKSPACE_EXEMPT_AGENTS = new Set(["may", "tech-lead", "bob", "coach", "optimizer", "coder"]);

/** Allowed write prefixes for all agents. */
const ALLOWED_WRITE_PREFIXES = [".state/", "tmp/", "/tmp/", "agents/shared/", "agents/gym/", "agents/.lab/"];

/** Known append-only file patterns (C3.3). */
const APPEND_ONLY_PATTERNS = [
  /journal\.md$/,
  /history\.md$/,
  /\.jsonl$/,
];

/** Forbidden path prefixes (C7.1). */
const FORBIDDEN_PATH_PREFIXES = ["/home/", "~/", "/Users/", "/root/"];

/** Internal bookkeeping files exempt from C1.3 verify-writes. */
const C1_3_EXEMPT_PATTERNS = [
  /journal\.md$/,
  /todo\.md$/,
  /periodic-tasks\.md$/,
  /focus-tasks\.md$/,
  /heartbeat-context\.md$/,
  /common-sense-status\.md$/,
  /last-reviewed-commit\.txt$/,
  /knowledge\/.*\.md$/,
  /reflections\/.*\.md$/,
  /bulletin\.md$/,
  // Shared registries — append-only catalogs, low-risk
  /LIBRARY\.md$/,
  /REGISTRY\.md$/,
  /graduation-log\.md$/,
  /DELIVERABLES_CHECKLIST\.md$/,
  /finding-.*\.md$/,
  // Note: agents/gym/, agents/.lab/, /tmp/ are already in ALLOWED_WRITE_PREFIXES
  // and handled by C3.2, not duplicated here.
];

/** Lookback for regression detection (7 days in ms). */
const REGRESSION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** Minimum sessions needed before regression detection applies. */
const MIN_SESSIONS_FOR_REGRESSION = 10;

/** Regression threshold: 5 percentage points drop. */
const REGRESSION_THRESHOLD_PP = 5;
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

    // Check for regressions and trigger coaching (with dedup)
    if (result.regressions.length > 0) {
      const sentAny = emitDeduplicatedRegressions(ctx, result.regressions);
      if (sentAny) ctx.triggerNow("heartbeat-coach");
    }
  };
};

/** Emit regression alerts with 24h per-key cooldown. Returns true if any sent. */
function emitDeduplicatedRegressions(ctx: HandlerContext, regressions: RegressionEntry[]): boolean {
  const cooldownPath = join(ctx.persistDir, "convention-checks", "regression-cooldown.json");
  let cooldowns: Record<string, number> = {};
  try { if (existsSync(cooldownPath)) cooldowns = JSON.parse(readFileSync(cooldownPath, "utf-8")); } catch { /* fresh */ }

  const COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  let sentAny = false;

  for (const reg of regressions) {
    const key = `${reg.agent}:${reg.convention}`;
    if (now - (cooldowns[key] || 0) < COOLDOWN_MS) {
      ctx.log(`[convention-check] Suppressed duplicate regression alert: ${key}`);
      continue;
    }
    ctx.log(`[convention-check] 🚨 Regression: ${reg.agent} ${reg.convention} dropped from ${reg.previousRate}% to ${reg.currentRate}%`);
    ctx.emit({
      type: "message_created", from: "convention-check", to: "coach",
      task: `Convention regression: ${reg.agent} ${reg.convention} dropped from ${reg.previousRate}% to ${reg.currentRate}%. Query convention_checks table in .state/may.db for details.`,
      requestId: `cc-${Date.now()}-${reg.convention}`,
    });
    cooldowns[key] = now;
    sentAny = true;
  }

  mkdirSync(join(ctx.persistDir, "convention-checks"), { recursive: true });
  writeFileSync(cooldownPath, JSON.stringify(cooldowns, null, 2), "utf-8");
  return sentAny;
}
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

  // One-time retroactive fix: correct finish-dependent check failures for
  // interrupted/error/orphan sessions. Gated so it only runs once.
  applyRetroactiveFix(db, persistDir, log);

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

      // Check if session was interrupted (can't penalize for missing finish())
      const sessionRow = db.prepare(
        `SELECT status, kind, source, task FROM sessions WHERE sessionId = ?`
      ).get(sessionId) as { status: string; kind: string | null; source: string | null; task: string | null } | undefined;
      // Review-only workflow calls are one-shot assessments; exempt from
      // finish-dependent checks like interrupted sessions.
      const isReviewOnlyCall = sessionRow?.kind === "call"
        && sessionRow?.source === "workflow"
        && /^\[REVIEW ONLY/i.test(sessionRow?.task ?? "");
      const isInterrupted = !sessionRow
        || sessionRow.status === "interrupted"
        || sessionRow.status === "error"
        || isReviewOnlyCall;

      const checks = runAllChecks(toolCalls, agent, isInterrupted);
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
        if (tc.resultContent) {
          // Wrapped <tool_output> = tool succeeded, content is file/cmd output
          const isWrappedOutput = tc.resultContent.includes('<tool_output');
          if (isWrappedOutput) {
            tc.isError = false;
          } else {
            tc.isError =
              tc.resultContent.includes("ENOENT:") ||
              tc.resultContent.includes("Error:") ||
              tc.resultContent.startsWith("error");
          }
        }
      }
    }
  }

  return toolCalls;
}
function runAllChecks(toolCalls: ToolCall[], agent: string, isInterrupted: boolean = false): CheckResult[] {
  if (toolCalls.length === 0) return [];

  // For interrupted sessions, skip finish-dependent checks (C1.4, C8.2, C1.5, C1.7)
  // since the session was externally terminated before the agent could call finish()
  const checks: CheckResult[] = [
    checkC1_1_readBeforeEdit(toolCalls),
    checkC1_3_verifyWrites(toolCalls),
    checkC2_1_preciseArgs(toolCalls),
    checkC3_2_workspaceIsolation(toolCalls, agent),
    checkC3_3_safeAppend(toolCalls),
    checkC6_1_budgetAwareness(toolCalls),
    checkC7_1_rootIsApp(toolCalls),
    checkC12_1_sessionStart(toolCalls, agent),
  ];

  if (!isInterrupted) {
    checks.push(
      checkC1_4_finishClearly(toolCalls),
      checkC1_5_ghostDeliverables(toolCalls),
      checkC8_2_promiseDeliverReport(toolCalls),
      checkC1_7_verificationEvidence(toolCalls),
    );
  }

  return checks;
}

/** C1.1: read-before-edit — edit() targets must have a preceding read(). */
function checkC1_1_readBeforeEdit(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];
  const readPaths = new Set<string>();

  for (const tc of toolCalls) {
    if (tc.name === "read") {
      const path = extractPath(tc.input);
      if (path) readPaths.add(normalizePath(path));
    }
    // Only flag edit() — write() creates/replaces files and doesn't need prior read.
    if (tc.name === "edit") {
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

/** C1.3: verify-writes — edit()/write() must have subsequent read(). Successful edit() is self-verifying. */
function checkC1_3_verifyWrites(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];
  // Track paths that need verification (edit/write happened, no subsequent read)
  const unverified = new Map<string, string>(); // normPath → original tool description

  for (const tc of toolCalls) {
    if (tc.name === "edit" || tc.name === "write") {
      const path = extractPath(tc.input);
      if (path) {
        // edit() returns a diff preview on success — this IS verification.
        // Only write() and failed edits need separate read-back.
        if (tc.name === "edit" && !tc.isError) {
          // Successful edit with diff preview = self-verifying, skip tracking
          continue;
        }
        unverified.set(normalizePath(path), `${tc.name}(${path})`);
      }
    }
    if (tc.name === "read") {
      const path = extractPath(tc.input);
      if (path) {
        unverified.delete(normalizePath(path));
      }
    }
    // Also count bash verification commands (cat, grep, etc.)
    if (tc.name === "bash") {
      const cmd = String(tc.input.command || "");
      for (const [normed] of unverified) {
        // cat <path> counts as verification
        if (cmd.includes(`cat ${normed}`) || cmd.includes(`cat "${normed}"`)) {
          unverified.delete(normed);
          continue;
        }
        // grep/grep -flags <path> counts as verification
        // Matches: grep "x" <path>, grep -n "x" <path>, grep pattern <path>
        if (cmd.includes(normed) && /\bgrep\b/.test(cmd)) {
          unverified.delete(normed);
          continue;
        }
      }
    }
  }

  for (const [normed, desc] of unverified) {
    // Skip internal bookkeeping files — low risk, not deliverables
    if (C1_3_EXEMPT_PATTERNS.some((p) => p.test(normed))) continue;
    violations.push(`${desc} not verified with subsequent read`);
  }

  return { convention: "C1.3", passed: violations.length === 0, violations };
}

/** C1.4: finish-clearly — last tool call must be finish(). */
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

/** C1.5: ghost-deliverables — checks finish() result for missing deliverables at session end. */
function checkC1_5_ghostDeliverables(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];

  for (const tc of toolCalls) {
    if (tc.name !== "finish") continue;
    const status = tc.input?.status as string | undefined;
    if (status !== "success" && status !== "partial") continue;
    const deliverables = tc.input?.deliverables as Array<{ path?: string }> | undefined;
    if (!deliverables?.length) continue;

    const result = tc.resultContent || "";
    if (!result || result.includes("blocked") || result.includes("✅") || result.includes("✓")) continue;

    if (result.includes("Deliverables not found on disk")) {
      const match = result.match(/Deliverables not found on disk:\s*(.+?)(?:\.|$)/);
      if (match) {
        for (const p of match[1].split(",").map((s: string) => s.trim())) {
          violations.push(`Ghost deliverable: '${p}' declared in finish(${status}) but did not exist at session end`);
        }
      } else {
        violations.push(`Ghost deliverable(s) declared in finish(${status}) — lifecycle guard caught missing files at session end`);
      }
    }
  }

  return { convention: "C1.5", passed: violations.length === 0, violations };
}

/** C2.1: precise-args — check tool results for schema validation errors. */
function checkC2_1_preciseArgs(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];
  const errorPatterns = [
    /Invalid arguments/i,
    /schema validation/i,
    /missing required/i,
    /unexpected.*parameter/i,
  ];

  for (const tc of toolCalls) {
    if (tc.resultContent && tc.isError) {
      // Skip if the error pattern only appears deep in the content (>200 chars in),
      // which indicates it's part of file content or command output, not a tool error.
      const first200 = tc.resultContent.substring(0, 200);
      for (const pattern of errorPatterns) {
        if (pattern.test(first200)) {
          violations.push(`${tc.name}() got schema error: ${tc.resultContent.substring(0, 100)}`);
          break;
        }
      }
    }
  }

  return { convention: "C2.1", passed: violations.length === 0, violations };
}

/** C3.2: workspace-isolation — writes must be in agent's workspace or allowed prefixes. */
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

/** C3.3: safe-append — write() should not target append-only files. */
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

/** C6.1: budget-awareness — flag sessions with excessive tool calls (>80). */
function checkC6_1_budgetAwareness(toolCalls: ToolCall[]): CheckResult {
  const BUDGET_THRESHOLD = 80;
  const passed = toolCalls.length < BUDGET_THRESHOLD;
  return {
    convention: "C6.1", passed,
    violations: passed ? [] : [`${toolCalls.length} tool calls (likely hitting budget limit)`],
  };
}

/** C7.1: root-is-app — no bash commands should reference /home/, ~, /Users/. */
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

/** C8.2: promise-deliver-report — finish() must have summary or completed_items. */
function checkC8_2_promiseDeliverReport(toolCalls: ToolCall[]): CheckResult {
  const finishCalls = toolCalls.filter((tc) => tc.name === "finish");
  const finishCall = finishCalls.length > 0 ? finishCalls[finishCalls.length - 1] : null;
  if (!finishCall) {
    return { convention: "C8.2", passed: false, violations: ["No finish() call — cannot verify report"] };
  }
  const input = finishCall.input;
  const hasSummary = typeof input.summary === "string" && input.summary.length > 0;
  const hasCompleted = Array.isArray(input.completed_items) && input.completed_items.length > 0;
  const passed = hasSummary || hasCompleted;
  return {
    convention: "C8.2", passed,
    violations: passed ? [] : ["finish() has no summary or completed_items"],
  };
}

/**
 * C12.1: session-start
 * First few tool calls should show orientation behavior (reading context, checking state).
 */
function checkC12_1_sessionStart(toolCalls: ToolCall[], _agent: string): CheckResult {
  if (toolCalls.length === 0) {
    return { convention: "C12.1", passed: false, violations: ["No tool calls"] };
  }

  // Check first 5 tool calls for any orientation behavior
  const ORIENTATION_TOOLS = new Set(["read", "system_status", "agents", "claude_code", "workflow"]);
  const BASH_ORIENTATION = /^(grep|rg|find|ls|cat|head|tail|git|bun)\b/;

  for (const tc of toolCalls.slice(0, 5)) {
    if (ORIENTATION_TOOLS.has(tc.name)) {
      return { convention: "C12.1", passed: true, violations: [] };
    }
    if (tc.name === "bash") {
      const cmd = String(tc.input.command || "").trim()
        .replace(/^(cd\s+[^\s;]+\s*&&\s*|export\s+\w+=("[^"]*"|'[^']*'|[^\s;]+)\s*&&\s*)*/g, "");
      if (BASH_ORIENTATION.test(cmd)) {
        return { convention: "C12.1", passed: true, violations: [] };
      }
    }
  }

  return {
    convention: "C12.1",
    passed: false,
    violations: [
      `No orientation in first 5 tool calls (first was ${toolCalls[0].name}(${extractPath(toolCalls[0].input) || ""}))`,
    ],
  };
}

/** C1.7: verification-evidence — finish(success) needs verification in last 5 tool calls. */
function checkC1_7_verificationEvidence(toolCalls: ToolCall[]): CheckResult {
  const finishCalls = toolCalls.filter(
    (tc) => tc.name === "finish" && tc.input?.status === "success"
  );
  if (finishCalls.length === 0) {
    return { convention: "C1.7", passed: true, violations: [] };
  }

  // Only check the LAST finish(success) call
  const finish = finishCalls[finishCalls.length - 1];
  const recentCalls = toolCalls.filter(
    (tc) => tc.index < finish.index && tc.name !== "finish"
  ).slice(-5);

  const VERIFICATION_RE = /\b(grep|ls|test|curl|node|python|cat|wc|find|diff|tsc|vitest|head|tail)\b/;
  let hasVerification = false;

  for (const tc of recentCalls) {
    if (tc.name === "read" || tc.name === "agents" || tc.name === "claude_code" || tc.name === "codex") {
      hasVerification = true;
      break;
    }
    if (tc.name === "bash" && VERIFICATION_RE.test(String(tc.input.command || ""))) {
      hasVerification = true;
      break;
    }
  }

  return {
    convention: "C1.7",
    passed: hasVerification,
    violations: hasVerification ? [] : ["finish(success) without verification: no grep/ls/test/read in last 5 tool calls"],
  };
}
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
/** Fix historical false positives for interrupted/orphan sessions. Runs once. */
function applyRetroactiveFix(db: SqliteDb, persistDir: string, log: (msg: string) => void): void {
  const flagPath = join(persistDir, "convention-checks", "retro-fix-applied.flag");
  if (existsSync(flagPath)) return;

  const FINISH_DEPENDENT = ['C1.4', 'C8.2', 'C1.5', 'C1.7'];
  const placeholders = FINISH_DEPENDENT.map(() => '?').join(',');
  const queries = [
    { sql: `SELECT cc.rowid FROM convention_checks cc JOIN sessions s ON cc.session_id = s.sessionId
            WHERE cc.passed = 0 AND cc.convention IN (${placeholders}) AND s.status IN ('interrupted', 'error')`,
      reason: 'session was interrupted/errored' },
    { sql: `SELECT cc.rowid FROM convention_checks cc LEFT JOIN sessions s ON cc.session_id = s.sessionId
            WHERE cc.passed = 0 AND cc.convention IN (${placeholders}) AND s.sessionId IS NULL`,
      reason: 'orphan session (no session record)' },
  ];
  for (const { sql, reason } of queries) {
    const rows = db.prepare(sql).all(...FINISH_DEPENDENT) as { rowid: number }[];
    if (rows.length > 0) {
      const stmt = db.prepare(`UPDATE convention_checks SET passed = 1, violations = ? WHERE rowid = ?`);
      const violationJson = JSON.stringify([`retroactive: ${reason}`]);
      for (const r of rows) stmt.run(violationJson, r.rowid);
      log(`[convention-check] Retroactively corrected ${rows.length} false positives: ${reason}`);
    }
  }

  const dir = join(persistDir, "convention-checks");
  mkdirSync(dir, { recursive: true });
  writeFileSync(flagPath, new Date().toISOString(), "utf-8");
}
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
