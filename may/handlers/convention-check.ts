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
const WORKSPACE_EXEMPT_AGENTS = new Set(["may", "tech-lead", "bob", "coach", "optimizer"]);

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

/** Internal bookkeeping files exempt from C1.3 verify-writes.
 * These are personal/shared tracking files where write failures are
 * low-risk (edit() fails atomically) and read-back adds no value.
 * C1.3 should focus on deliverables (code, configs, briefs). */
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
  // Gym scenario scaffolding — creating test environments, not deliverables
  /agents\/gym\/scenarios\//,
  // Lab experiment files — exploratory, not production
  /agents\/\.lab\//,
  // Shared registries — append-only catalogs, low-risk
  /LIBRARY\.md$/,
  /REGISTRY\.md$/,
  // Workspace logs — append-only bookkeeping
  /graduation-log\.md$/,
  // Temp files — not worth verifying
  /^\/tmp\//,
  // Deliverable checklists — planning/tracking files, read back when edited later
  /DELIVERABLES_CHECKLIST\.md$/,
  // Workspace findings — investigation artifacts, new file creation (low-risk)
  /finding-.*\.md$/,
];

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

    // Check for regressions and trigger coaching (with dedup)
    if (result.regressions.length > 0) {
      // Load cooldown state to avoid re-sending the same regression alert
      const cooldownPath = join(ctx.persistDir, "convention-checks", "regression-cooldown.json");
      let cooldowns: Record<string, number> = {};
      try {
        if (existsSync(cooldownPath)) {
          cooldowns = JSON.parse(readFileSync(cooldownPath, "utf-8"));
        }
      } catch { /* start fresh */ }

      const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
      const now = Date.now();
      let sentAny = false;

      for (const reg of result.regressions) {
        const key = `${reg.agent}:${reg.convention}`;
        const lastSent = cooldowns[key] || 0;

        if (now - lastSent < COOLDOWN_MS) {
          ctx.log(
            `[convention-check] Suppressed duplicate regression alert: ${reg.agent} ${reg.convention} ` +
              `(sent ${Math.round((now - lastSent) / 3600000)}h ago)`
          );
          continue;
        }

        ctx.log(
          `[convention-check] 🚨 Regression: ${reg.agent} ${reg.convention} ` +
            `dropped from ${reg.previousRate}% to ${reg.currentRate}%`
        );
        // Send finding to coach via event bus
        ctx.emit({
          type: "message_created",
          from: "convention-check",
          to: "coach",
          task: `Convention regression: ${reg.agent} ${reg.convention} dropped from ${reg.previousRate}% to ${reg.currentRate}%. Query convention_checks table in .state/may.db for details. Design a targeted skill or exercise.`,
          requestId: `cc-${Date.now()}-${reg.convention}`,
        });
        cooldowns[key] = now;
        sentAny = true;
      }

      // Persist cooldown state
      const cooldownDir = join(ctx.persistDir, "convention-checks");
      mkdirSync(cooldownDir, { recursive: true });
      writeFileSync(cooldownPath, JSON.stringify(cooldowns, null, 2), "utf-8");

      if (sentAny) {
        ctx.triggerNow("heartbeat-coach");
      }
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

  // Retroactive fix: correct finish-dependent check failures for sessions
  // that were later marked as "interrupted" (race condition: convention checks
  // can run before session status is updated after a restart)
  const FINISH_DEPENDENT = ['C1.4', 'C8.2', 'C1.5', 'C1.7'];
  const placeholders = FINISH_DEPENDENT.map(() => '?').join(',');
  const staleFailures = db.prepare(`
    SELECT cc.rowid, cc.session_id, cc.convention
    FROM convention_checks cc
    JOIN sessions s ON cc.session_id = s.sessionId
    WHERE cc.passed = 0
      AND cc.convention IN (${placeholders})
      AND s.status IN ('interrupted', 'error')
  `).all(...FINISH_DEPENDENT) as { rowid: number; session_id: string; convention: string }[];

  if (staleFailures.length > 0) {
    const updateStmt = db.prepare(
      `UPDATE convention_checks SET passed = 1, violations = '["retroactive: session was interrupted/errored"]' WHERE rowid = ?`
    );
    for (const sf of staleFailures) {
      updateStmt.run(sf.rowid);
    }
    log(`[convention-check] Retroactively corrected ${staleFailures.length} false positives on interrupted/error sessions`);
  }

  // Retroactive fix #2: correct finish-dependent check failures for orphan sessions
  // (sessions that have convention_check records but no sessions table entry at all).
  // These are typically gym runs or sessions that died before session creation.
  // Can't penalize for missing finish() if the session never registered.
  const orphanFailures = db.prepare(`
    SELECT cc.rowid, cc.session_id, cc.convention
    FROM convention_checks cc
    LEFT JOIN sessions s ON cc.session_id = s.sessionId
    WHERE cc.passed = 0
      AND cc.convention IN (${placeholders})
      AND s.sessionId IS NULL
  `).all() as { rowid: number; session_id: string; convention: string }[];

  if (orphanFailures.length > 0) {
    const updateOrphanStmt = db.prepare(
      `UPDATE convention_checks SET passed = 1, violations = '["retroactive: orphan session (no session record)"]' WHERE rowid = ?`
    );
    for (const orphan of orphanFailures) {
      updateOrphanStmt.run(orphan.rowid);
    }
    log(`[convention-check] Retroactively corrected ${orphanFailures.length} false positives on orphan sessions (no session record)`);
  }

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
      // Also treat sessions with no session record as interrupted (orphans —
      // gym runs or sessions that died before session record creation)
      const sessionRow = db.prepare(
        `SELECT status FROM sessions WHERE sessionId = ?`
      ).get(sessionId) as { status: string } | undefined;
      const isInterrupted = !sessionRow || sessionRow.status === "interrupted" || sessionRow.status === "error";

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
        // Check for error indicators — but skip false positives from file content
        if (tc.resultContent) {
          // If the tool output is wrapped in <tool_output>, it succeeded —
          // the content is file/command output, not a tool error.
          // Only check for errors in raw (unwrapped) output.
          const isWrappedOutput = tc.resultContent.includes('<tool_output');
          if (isWrappedOutput) {
            // Wrapped output means the tool succeeded — content is file/command
            // output, not a tool error. Never flag as error: the content may
            // contain strings like "ENOENT:" or "Error:" as literal text
            // (e.g., reading source code that handles errors).
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

// ── Check implementations ─────────────────────────────────────────────

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
    // Only flag edit() — write() creates/replaces files and doesn't need prior read.
    // edit() needs prior read to get exact oldText for matching.
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

/**
 * C1.3: verify-writes
 * For every edit()/write(), there must be a subsequent read() of that path.
 * Exception: edit() with a successful result (diff preview) counts as self-verifying,
 * since the diff output confirms the change landed correctly.
 */
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
 * Every deliverable path declared in finish(success/partial) must have existed at session end.
 *
 * The finish() tool in lifecycle.ts already validates existsSync() at call time and
 * returns an error if any deliverable is missing. So rather than re-checking the disk
 * post-hoc (which causes false positives when files are deleted by later cleanup/KB
 * archival), we check the finish() tool result from the transcript:
 *
 * - If the finish result contains "Deliverables not found on disk" → ghost deliverable
 * - If the finish result contains the success marker (✅ or ✓) → files existed at session end
 * - If the finish call was blocked by the guard → skip (agent may have retried)
 *
 * This eliminates the timing bug where existsSync() at check time (hours later)
 * disagrees with existsSync() at session end time.
 */
function checkC1_5_ghostDeliverables(toolCalls: ToolCall[]): CheckResult {
  const violations: string[] = [];
  const finishCalls = toolCalls.filter((tc) => tc.name === "finish");

  for (const tc of finishCalls) {
    const status = tc.input?.status as string | undefined;
    if (!status || (status !== "success" && status !== "partial")) continue;

    const deliverables = tc.input?.deliverables as Array<{ path?: string }> | undefined;
    if (!deliverables || !Array.isArray(deliverables)) continue;
    if (deliverables.length === 0) continue;

    // Check the finish() tool result to determine if deliverables existed at session end.
    // The lifecycle.ts finish tool returns "Deliverables not found on disk: ..." if missing,
    // or a formatted summary with ✓ markers if present.
    const result = tc.resultContent || "";

    // If the result shows the finish tool caught missing deliverables at call time, flag them
    if (result.includes("Deliverables not found on disk")) {
      // Extract specific missing paths from the error message
      const match = result.match(/Deliverables not found on disk:\s*(.+?)(?:\.|$)/);
      if (match) {
        const missingPaths = match[1].split(",").map((p: string) => p.trim());
        for (const p of missingPaths) {
          violations.push(`Ghost deliverable: '${p}' declared in finish(${status}) but did not exist at session end`);
        }
      } else {
        // Fallback: we know something was missing but can't parse which
        violations.push(`Ghost deliverable(s) declared in finish(${status}) — lifecycle guard caught missing files at session end`);
      }
      continue;
    }

    // If the finish call was blocked by any guard (FM-3.1, FM-3.3, uncommitted changes, etc.),
    // skip — this call didn't actually succeed, and the agent may have retried
    if (result.includes("blocked")) {
      continue;
    }

    // If we have a result that looks like a successful finish (contains the ✅ marker
    // or deliverable checkmarks), trust that files existed at session end
    if (result.includes("✅") || result.includes("✓")) {
      continue; // Deliverables verified at finish time — pass
    }

    // No result content available (transcript truncated or format changed) —
    // give benefit of the doubt rather than produce false positives.
    // The lifecycle.ts guard enforces this at runtime; post-hoc disk checks
    // are unreliable due to file cleanup timing.
    if (!result) {
      continue;
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
    if (tc.resultContent && tc.isError) {
      // Double-check: wrapped tool output is never a schema error — it's file/command
      // content that happens to contain error-like strings. Belt-and-suspenders with
      // the isError=false fix above (which may be cached).
      if (tc.resultContent.includes('<tool_output')) continue;
      // Also skip if the error pattern only appears deep in the content (>200 chars in),
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
 * Check total tool calls for session efficiency. If > 60 tool ops in a session, flag.
 * Threshold raised from 45→60 (2026-03-30) after opBudget removal — 45 was hitting
 * 16% of sessions as false positives. 60 = ~93rd percentile, catches only truly
 * bloated sessions while still incentivizing efficiency.
 */
function checkC6_1_budgetAwareness(toolCalls: ToolCall[]): CheckResult {
  // Heuristic: sessions with very high tool call counts are inefficient.
  // 80 = ~97th percentile of recent sessions (2026-03-31). Post-opBudget,
  // this is an efficiency signal only. Coach/Bob regularly use 50-75 calls
  // for legitimate complex work (gym scenarios, convention analysis).
  const BUDGET_THRESHOLD = 80;
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
  // Use the LAST finish() call — agents may retry finish() after validation errors
  const finishCalls = toolCalls.filter((tc) => tc.name === "finish");
  const finishCall = finishCalls.length > 0 ? finishCalls[finishCalls.length - 1] : null;
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

  // C12.1 spirit: agents should orient themselves before acting.
  // "Orient" means reading context files OR using orientation tools.
  // Different agents and session types have different valid startup patterns.

  // Named context files that indicate orientation
  const CONTEXT_FILE_PATTERNS = [
    /heartbeat\.md$/,
    /todo\.md$/,
    /focus-tasks\.md$/,
    /periodic-tasks\.md$/,
    /context\.md$/,
    /common-sense\.md$/,
    /nudge-active\.md$/,
    /heartbeat-context\.md$/,
    /pending-decisions\.md$/,
    /journal\.md$/,
    /analysis\.md$/,
  ];

  // Agent workspace reads also count as orientation (e.g., QA reading
  // last-reviewed-commit.txt, Coach reading diagnosis-*.md)
  // Also accept agents/shared/ reads — reading shared knowledge IS orientation.
  // (Fixes false positives on dispatched work sessions that read shared knowledge first.)
  const WORKSPACE_PATTERN = new RegExp(`agents/(${agent}|shared)/(workspace|knowledge|skills)/`);

  // Orientation tools that aren't read() but still show the agent is
  // getting context before acting
  const ORIENTATION_TOOLS = new Set([
    "system_status",  // checking system state
    "agents",         // listing agents or checking requests
    "claude_code",    // delegation to external CLI agent (has its own context)
  ]);

  // Check first 5 tool calls for any orientation behavior
  const earlyWindow = toolCalls.slice(0, 5);

  for (const tc of earlyWindow) {
    // read() of a context file or workspace file
    if (tc.name === "read") {
      const path = extractPath(tc.input);
      if (!path) continue;
      if (CONTEXT_FILE_PATTERNS.some((p) => p.test(path))) {
        return { convention: "C12.1", passed: true, violations: [] };
      }
      if (WORKSPACE_PATTERN.test(path)) {
        return { convention: "C12.1", passed: true, violations: [] };
      }
    }

    // Orientation tools (system_status, agents list/requests)
    if (ORIENTATION_TOOLS.has(tc.name)) {
      return { convention: "C12.1", passed: true, violations: [] };
    }

    // workflow() is a valid start for cron tasks that are told to run a workflow
    if (tc.name === "workflow") {
      return { convention: "C12.1", passed: true, violations: [] };
    }

    // bash() with grep/find/ls in early window = searching for context
    if (tc.name === "bash") {
      const cmd = extractBashCommand(tc.input);
      if (cmd) {
        // Strip common prefixes: "cd /app && grep ..." → "grep ..."
        // Also strip "export PATH=... &&" and similar env setups
        let stripped = cmd.trim();
        // Iteratively strip cd and export prefixes (handles "cd /app && export PATH=... && ls")
        let changed = true;
        while (changed) {
          changed = false;
          const next = stripped
            .replace(/^cd\s+[^\s;]+\s*&&\s*/, "")
            .replace(/^export\s+\w+=("[^"]*"|'[^']*'|[^\s;]+)\s*&&\s*/, "")
            .trim();
          if (next !== stripped) {
            stripped = next;
            changed = true;
          }
        }
        if (/^(grep|rg|find|ls|cat|head|tail|git|bun)\b/.test(stripped)) {
          return { convention: "C12.1", passed: true, violations: [] };
        }
      }
    }
  }

  return {
    convention: "C12.1",
    passed: false,
    violations: [
      `No context file read in first 5 tool calls (first was ${toolCalls[0].name}(${extractPath(toolCalls[0].input) || ""}))`,
    ],
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

  // Only check the LAST finish(success) call — if the agent retried finish()
  // multiple times (e.g., finish-gate rejection loop), earlier attempts have
  // only other finish() calls in their lookback window, which is unfixable.
  const finish = finishCalls[finishCalls.length - 1];
  {
    // Look at the last 5 tool calls before this finish (excluding other finish() calls)
    const finishIdx = finish.index;
    const recentCalls = toolCalls.filter(
      (tc) => tc.index < finishIdx && tc.name !== "finish"
    ).slice(-5);

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
      // Delegation tools count as verification (master delegates to CLI agents)
      if (tc.name === "agents" || tc.name === "claude_code" || tc.name === "codex") {
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

function extractBashCommand(input: Record<string, unknown>): string | null {
  if (typeof input.command === "string") return input.command;
  return null;
}

function normalizePath(path: string): string {
  // Strip leading /app/ or ./ for consistent comparison
  return path
    .replace(/^\/app\//, "")
    .replace(/^\.\//, "");
}
