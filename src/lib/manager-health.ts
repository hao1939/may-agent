/**
 * Health monitoring — extracted from manager.ts for maintainability.
 *
 * All functions are standalone and take their dependencies as parameters.
 * The SubagentManager delegates health(), auditHealth(), reconcileHealth() here.
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { formatDuration } from "./manager-utils.js";
import type { RegisteredAgent, ActiveSession } from "./manager-utils.js";
import { loadAllSessionMetas, listWorkflowRuns, readWorkflowRun } from "./persistence.js";
import type {
  ManagerHealthReport,
  HealthActiveSession,
  AuditHealthOptions,
  AuditHealthReport,
  ReconcileReport,
} from "./types.js";

/** Agents whose sessions are auto-skippable for evaluation (meta-agents). */
export const EVAL_SKIP_AGENTS = new Set(["evaluator", "optimizer", "may"]);

/** Input context needed by health functions — a subset of manager state. */
export interface HealthContext {
  agents: Map<string, RegisteredAgent>;
  activeSessions: Map<string, ActiveSession>;
  startedAt: number;
  persistDir: string;
}

/** Fast, in-memory health snapshot. Returns data the manager already knows. */
export function computeHealth(ctx: HealthContext): ManagerHealthReport {
  const now = Date.now();
  const names = [...ctx.agents.keys()];

  const activeList: HealthActiveSession[] = [];
  let running = 0;
  let idle = 0;
  for (const s of ctx.activeSessions.values()) {
    activeList.push({
      sessionId: s.sessionId,
      agent: s.agentName,
      status: s.status,
      startedAt: s.startedAt,
      runtime: formatDuration((s.endedAt ?? now) - s.startedAt),
      turnCount: s.turnCount,
    });
    if (s.status === "running") running++;
    if (s.status === "idle") idle++;
  }

  return {
    registeredAgents: { count: names.length, names },
    activeSessions: activeList,
    sessionCounts: { running, idle, total: ctx.activeSessions.size },
    uptime: formatDuration(now - ctx.startedAt),
    timestamp: new Date(now).toISOString(),
  };
}

/**
 * Filesystem-based ground-truth scan. Inspects persisted session data on disk.
 * Intentionally synchronous — this is a diagnostic endpoint, not a hot path.
 * For large state directories, consider running in a worker thread if latency matters.
 */
export function computeAuditHealth(ctx: HealthContext, _opts?: AuditHealthOptions): AuditHealthReport {
  const persistDir = ctx.persistDir;
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Load all persisted session metas
  const allSessions = loadAllSessionMetas(persistDir);
  const allSessionEntries = Object.entries(allSessions);

  // 1. Sessions in last 24h
  let sessionsLast24h = 0;
  for (const session of Object.values(allSessions)) {
    if (session.startedAt >= oneDayAgo) sessionsLast24h++;
  }

  // 2. Unevaluated sessions
  const evalDir = join(persistDir, "evaluations");
  const evaluatedIds = new Set<string>();
  if (existsSync(evalDir)) {
    try {
      for (const f of readdirSync(evalDir)) {
        if (f.endsWith(".json")) evaluatedIds.add(f.replace(".json", ""));
      }
    } catch {
      /* best-effort */
    }
  }

  const META_AGENTS = EVAL_SKIP_AGENTS;
  let unevalTotal = 0;
  let unevalActionable = 0;
  let unevalAutoSkippable = 0;

  for (const [sid, session] of allSessionEntries) {
    if (evaluatedIds.has(sid)) continue;
    if (session.status === "running" || session.status === "idle") continue;
    unevalTotal++;

    if (META_AGENTS.has(session.agent)) {
      unevalAutoSkippable++;
      continue;
    }

    // Check if transcript exists
    const activeJsonl = join(persistDir, "sessions", sid, "session.jsonl");
    const archivedJsonl = join(persistDir, "sessions", "history", sid, "session.jsonl");
    if (!existsSync(activeJsonl) && !existsSync(archivedJsonl)) {
      unevalAutoSkippable++;
      continue;
    }

    unevalActionable++;
  }

  // 3. Stale sessions: status "running" in filesystem but not in activeSessions
  const staleSessions: Array<{ sessionId: string; agent: string; task: string }> = [];
  for (const [sid, session] of allSessionEntries) {
    if (session.status === "running" && !ctx.activeSessions.has(sid)) {
      staleSessions.push({ sessionId: sid, agent: session.agent, task: session.task });
    }
  }

  // 4. Total persisted sessions
  const totalPersistedSessions = allSessionEntries.length;

  // 5. Workflow runs
  const runIds = listWorkflowRuns(persistDir);
  let wfRunning = 0;
  let wfCompleted = 0;
  let wfInterrupted = 0;
  for (const runId of runIds) {
    const run = readWorkflowRun(persistDir, runId);
    if (!run) continue;
    if (run.status === "running") wfRunning++;
    else if (run.status === "done") wfCompleted++;
    else if (run.status === "interrupted" || run.status === "error") wfInterrupted++;
    else wfCompleted++; // escalated counts as completed
  }

  return {
    sessionsLast24h,
    unevaluated: { total: unevalTotal, actionable: unevalActionable, autoSkippable: unevalAutoSkippable },
    staleSessions,
    totalPersistedSessions,
    workflowRuns: { total: runIds.length, running: wfRunning, completed: wfCompleted, interrupted: wfInterrupted },
    persistedSessionIds: new Set(Object.keys(allSessions)),
    timestamp: new Date(now).toISOString(),
  };
}

/** Compare in-memory state vs filesystem and flag discrepancies. */
export function computeReconcileHealth(ctx: HealthContext, opts?: AuditHealthOptions): ReconcileReport {
  const healthReport = computeHealth(ctx);
  const auditReport = computeAuditHealth(ctx, opts);
  const discrepancies: string[] = [];

  // 1. Stale sessions: running in filesystem but not in activeSessions
  if (auditReport.staleSessions.length > 0) {
    for (const s of auditReport.staleSessions) {
      discrepancies.push(
        `Stale session: ${s.sessionId} (agent=${s.agent}) is "running" on disk but not active in memory`,
      );
    }
  }

  // 2. Active in memory but missing from filesystem
  for (const active of healthReport.activeSessions) {
    if (!auditReport.persistedSessionIds.has(active.sessionId)) {
      discrepancies.push(
        `Lost persistence: ${active.sessionId} (agent=${active.agent}) is active in memory but has no meta.json on disk`,
      );
    }
  }

  // 3. Agent count mismatch: if filesystem has agent configs that aren't registered
  if (healthReport.registeredAgents.count === 0 && auditReport.totalPersistedSessions > 0) {
    discrepancies.push(
      `No agents registered but ${auditReport.totalPersistedSessions} persisted sessions exist — agents may not have been re-registered after restart`,
    );
  }

  return {
    health: healthReport,
    audit: auditReport,
    discrepancies,
    healthy: discrepancies.length === 0,
  };
}
