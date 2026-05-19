/**
 * Shared heartbeat data loaders.
 *
 * Pure JS functions that pre-load metrics, projects, alerts, inbox, and
 * heartbeat.md for any agent's heartbeat workflow. Zero LLM cost.
 *
 * Usage in per-agent heartbeat workflows:
 *   import { loadMetrics, loadProjects, loadAlerts, loadHeartbeatMd, loadInbox, formatMetricsBlock } from "../../shared/workflows/heartbeat-data.js";
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "./index.js";
import { checkCircuitBreaker, recordOutcome as recordCircuitOutcome } from "./circuit-breaker.js";
import { shouldDispatch, recordDispatch, recordOutcome as recordDedupOutcome, cleanup as cleanupDispatchRecords } from "./dispatch-dedup-guard.js";
import { listConfiguredAgents, resolveMetricOwner } from "./metric-ownership.js";
import { parseProjectMeta } from "./project-schema.js";

/**
 * Find knowledge-base entries that mention a given metric id.
 *
 * Returns up to `limit` filenames sorted newest-first by KE number.
 * Used by loadMetrics to inject prior-art KEs into the heartbeat
 * prompt when a metric has been breaching for multiple checks
 * (KE-423 Recommendation C — break the "write-only KB" failure
 * mode where prior analyses do not reach the agent that needs them).
 */
export function findRelatedKEs(
  agentsRoot: string,
  metricId: string,
  limit = 3,
): string[] {
  try {
    const appRoot = basename(agentsRoot) === "agents" ? dirname(agentsRoot) : agentsRoot;
    const dirs = [
      join(appRoot, "shared", "knowledge", "entries"),
      join(agentsRoot, "shared", "knowledge", "entries"),
    ];
    const dir = dirs.find((candidate) => existsSync(candidate));
    if (!dir) return [];
    const matches: { name: string; num: number }[] = [];
    for (const entry of readdirSync(dir)) {
      if (!entry.startsWith("KE-") || !entry.endsWith(".md")) continue;
      let body: string;
      try { body = readFileSync(join(dir, entry), "utf-8"); } catch { continue; }
      // Match the literal metric id (dotted form) anywhere in the body.
      // Escape dots so "project.stale-active-count" does not match unrelated ids.
      const escaped = metricId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(escaped).test(body)) {
        const numMatch = entry.match(/^KE-(\d+)/);
        const num = numMatch ? parseInt(numMatch[1], 10) : 0;
        matches.push({ name: entry, num });
      }
    }
    matches.sort((a, b) => b.num - a.num);
    return matches.slice(0, limit).map((m) => m.name);
  } catch { return []; }
}

function getAgentsRoot(ctx: WorkflowContext): string {
  return ctx.agentsRoot || join(process.cwd(), "agents");
}

function getAppRoot(ctx: WorkflowContext): string {
  const maybeSdkRoot = (ctx as any).sdk?.paths?.root ?? (ctx as any).paths?.root;
  if (typeof maybeSdkRoot === "string" && maybeSdkRoot) return maybeSdkRoot;
  const agentsRoot = getAgentsRoot(ctx);
  return basename(agentsRoot) === "agents" ? dirname(agentsRoot) : agentsRoot;
}

function getProjectsRoot(ctx: WorkflowContext): string {
  const maybeProjects = (ctx as any).sdk?.paths?.projects ?? (ctx as any).paths?.projects;
  if (typeof maybeProjects === "string" && maybeProjects) return maybeProjects;
  return join(getAppRoot(ctx), "projects");
}

const heartbeatContextCache = new WeakMap<object, Map<string, any>>();

function loadHeartbeatContext(ctx: WorkflowContext, agent: string): any {
  let byAgent = heartbeatContextCache.get(ctx as object);
  if (!byAgent) {
    byAgent = new Map();
    heartbeatContextCache.set(ctx as object, byAgent);
  }
  const cached = byAgent.get(agent);
  if (cached) return cached;
  const context = ctx.query.heartbeatContext({
    agent,
    metricSnapshotLimit: 10,
    alertLimit: 100,
    inboxLimit: 12,
    inboxLookbackMs: 2 * 60 * 60 * 1000,
  });
  byAgent.set(agent, context);
  return context;
}

function normalizeHeartbeatMetric(row: any): any {
  return {
    ...row,
    alert_op: row.alert_op ?? row.alertOp,
    source_query: row.source_query ?? row.sourceQuery,
    source_command: row.source_command ?? row.sourceCommand,
    snapshots: Array.isArray(row.snapshots) ? row.snapshots : [],
  };
}

function normalizeHeartbeatAlert(row: any): any {
  return {
    ...row,
    metric_id: row.metric_id ?? row.metricId,
  };
}

function normalizeHeartbeatEvent(row: any): any {
  return {
    ...row,
    event_type: row.event_type ?? row.eventType,
  };
}

const FINISH_HYGIENE_INSTRUCTIONS = [
  "",
  "Finish hygiene (do this before every successful finish):",
  "1. Call read() on every file you wrote or edited; shell cat/head/grep does not satisfy the read-back guard.",
  "2. Run `cd /app && git status --short` and classify every dirty path before committing.",
  "3. Stage only your intentional deliverables with explicit paths; never use broad `git add .` or stage unrelated agent/runtime work. If an intentional deliverable is under the ignored canonical `projects/` tree, use `git add -f <that exact path>` and explain why.",
  "4. If a dirty path is unrelated or unsafe to clean, do not commit it just to satisfy the guard. finish(partial/blocked) and name the exact path plus owner/escalation needed.",
  "5. After committing, re-run `cd /app && git status --short`; success requires a clean app worktree or an explicit blocker.",
  "6. In finish(success), cite the commit id, the clean-status check, and read-back evidence in verification_evidence.",
].join("\n");

function loadMetricRowsForAgent(ctx: WorkflowContext, agent: string): any[] {
  const configuredAgents = listConfiguredAgents(getAgentsRoot(ctx));
  const rows = (loadHeartbeatContext(ctx, agent).metrics ?? []).map(normalizeHeartbeatMetric);
  return rows.filter((row: { id: string; explicitOwner?: string; projectOwner?: string }) => resolveMetricOwner(row.id, configuredAgents, row.explicitOwner, row.projectOwner) === agent);
}

export function loadMetrics(ctx: WorkflowContext, agent: string): string {
  try {
    const rows = loadMetricRowsForAgent(ctx, agent);
    if (!rows.length) return "";
    const agentsRoot = getAgentsRoot(ctx);
    return rows.map((r: any) => {
      const breached = r.threshold != null && r.current != null &&
        (r.alert_op === ">" || r.alert_op === "above" ? r.current > r.threshold : r.current < r.threshold);
      let line = `📊 ${r.id}: ${r.current ?? "?"} (target ${r.target ?? "?"}) ${breached ? "⚠️ BELOW TARGET" : "✅"}`;
      if (breached) {
        // Count consecutive breached snapshots for escalation
        let consecutiveBreaches = 0;
        try {
          for (const s of r.snapshots ?? []) {
            const sBreach = r.alert_op === ">" || r.alert_op === "above" ? s.value > r.threshold : s.value < r.threshold;
            if (sBreach) consecutiveBreaches++;
            else break;
          }
        } catch {}

        if (consecutiveBreaches >= 3) {
          line += `\n  ⛔ REPEATED ALERT (seen ${consecutiveBreaches}x): Failing for ${consecutiveBreaches} consecutive checks.`;
          line += `\n  → Investigate the root cause. If it requires destructive action (DB rebuild, data deletion), ESCALATE to human — do NOT fix autonomously.`;
          // KE-423 Rec C: inject prior knowledge entries that already
          // analyzed this metric, so the next agent does not re-derive
          // (or worse, confabulate around) what's already documented.
          const relatedKEs = findRelatedKEs(agentsRoot, r.id, 3);
          if (relatedKEs.length > 0) {
            line += `\n  → 📚 Prior analyses of this metric (READ BEFORE ACTING):`;
            for (const ke of relatedKEs) {
              line += `\n     • shared/knowledge/entries/${ke}`;
            }
            line += `\n     If prior KEs identify this red metric as caused by fabricated/phantom data, do NOT treat it as a new investigation — follow the documented remediation or escalate.`;
          }
        }
        if (r.source_command) line += `\n  → Diagnostic command: bash("${r.source_command}")`;
        else if (r.source_query) line += `\n  → Diagnostic query: ${r.source_query.substring(0, 120)}`;
        line += `\n  → Investigate this metric. Do NOT take destructive actions (rename/delete/rebuild DB, rm data). Escalate if unsure.`;
      }
      return line;
    }).join("\n");
  } catch { return ""; }
}

export function loadProjects(ctx: WorkflowContext, agent: string): string {
  try {
    const lines: string[] = [];

    // Scan shared projects (new location)
    const sharedProjDir = getProjectsRoot(ctx);
    if (existsSync(sharedProjDir)) {
      for (const entry of readdirSync(sharedProjDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const pFile = join(sharedProjDir, entry.name, "project.md");
        if (!existsSync(pFile)) continue;
        const content = readFileSync(pFile, "utf-8");
        const meta = parseProjectMeta(content);
        const owner = meta.owner ?? "?";
        if (owner !== agent) continue; // only show owned projects
        const status = meta.status ?? "?";
        if (status === "done" || status === "complete") continue;
        const health = meta.health ?? "";
        const msX = (content.match(/^- \[x\]/gim) || []).length;
        const msT = msX + (content.match(/^- \[ \]/gm) || []).length;
        const resumeCond = content.match(/Resume.*?:(.+)/i)?.[1]?.trim() ?? "";
        lines.push(`- **${entry.name}**: ${status} | health: ${health || "—"} | ms: ${msX}/${msT}${resumeCond ? " | resume: " + resumeCond.slice(0, 60) : ""}`);
      }
    }

    return lines.length > 0 ? lines.join("\n") : "";
  } catch { return ""; }
}

export function loadAlerts(ctx: WorkflowContext, agent: string): string {
  try {
    const configuredAgents = listConfiguredAgents(getAgentsRoot(ctx));
    const rows = ((loadHeartbeatContext(ctx, agent).alerts ?? []).map(normalizeHeartbeatAlert) as any[])
      .filter((row) => resolveMetricOwner(row.metric_id, configuredAgents, row.explicitOwner, row.projectOwner) === agent);
    if (!rows.length) return "";
    return rows.map((r: any) => `⚠️ ${r.metric_id}: ${r.message}`).join("\n");
  } catch { return ""; }
}

export function loadHeartbeatMd(ctx: WorkflowContext, agent: string): string {
  try {
    return readFileSync(join(getAgentsRoot(ctx), agent, "heartbeat.md"), "utf-8");
  } catch { return "(No heartbeat.md found)"; }
}

export function loadInbox(ctx: WorkflowContext, agent: string): string {
  try {
    const rows = ((loadHeartbeatContext(ctx, agent).inbox ?? []).map(normalizeHeartbeatEvent) as any[]);
    if (!rows.length) return "";
    // Dedup: collapse notifications with similar content
    const dedupMap = new Map<string, { count: number; newest: any; oldest: any }>();
    for (const r of rows) {
      const dataObj = r.data ? JSON.parse(r.data) : {};
      const summary = dataObj.summary || dataObj.error || dataObj.task || "";
      // Normalize: strip redundant priority tags like [P1] [P1], collapse whitespace
      const normalized = summary
        .replace(/^(\[P[0-2]\]\s*)+/g, '')  // strip leading priority tags
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      // Extract topic keywords for better fuzzy matching (strip agent names, timestamps)
      // First, try to extract a project name — most notifications are about a specific project
      const projectMatch = normalized.match(/project\s*["`']?([a-z0-9][-a-z0-9]*)["`']?/);
      const topicKey = projectMatch
        ? `project:${projectMatch[1]}`  // group all notifications about the same project
        : normalized
          .replace(/\b(optimizer|coach|tech-lead|bob|scout|may|amy-kimi)\b/g, '')
          .replace(/\b\d+[hm]\b/g, '')        // strip time references like "43h" "12m"
          .replace(/\b\d+\/\d+\b/g, '')       // strip fractions like "21/27"
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 100);
      // Key on event_type + normalized topic (100 chars for better grouping)
      const key = `${r.event_type}:${topicKey}`;
      const existing = dedupMap.get(key);
      if (existing) {
        existing.count++;
        if (r.timestamp > existing.newest.timestamp) existing.newest = r;
        if (r.timestamp < existing.oldest.timestamp) existing.oldest = r;
      } else {
        dedupMap.set(key, { count: 1, newest: r, oldest: r });
      }
    }
    // Cap deduped groups to prevent context bloat (EXP-scout-inbox-trim)
    const groups = Array.from(dedupMap.values()).slice(0, 8);
    return groups.map((entry) => {
      const r = entry.newest;
      const age = Math.round((Date.now() - r.timestamp) / 60000);
      const ageStr = age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
      const retry = "";
      const dataObj = r.data ? JSON.parse(r.data) : {};
      const summary = dataObj.summary || dataObj.error || dataObj.task || "";
      const dupBadge = entry.count > 1 ? ` (×${entry.count})` : "";
      return `- [${ageStr}] **${r.event_type}**${retry}${dupBadge} — ${summary}`.slice(0, 140);
    }).join("\n");
  } catch { return ""; }
}

/**
 * Run diagnostic commands for red metrics in JS (no LLM needed).
 *
 * Returns a structured report of command outputs that can be injected
 * directly into the main heartbeat prompt, eliminating the need for
 * a separate LLM diagnostic session.
 */
export function runRedMetricCommands(ctx: WorkflowContext, agent: string): string {
  try {
    const { execSync } = require("node:child_process");
    const rows = loadMetricRowsForAgent(ctx, agent);

    const redMetrics = rows.filter((r: any) => {
      if (r.threshold == null || r.current == null) return false;
      return r.alert_op === ">" || r.alert_op === "above" ? r.current > r.threshold : r.current < r.threshold;
    });

    if (redMetrics.length === 0) return "";

    const results: string[] = [];
    for (const r of redMetrics) {
      const cmd = r.source_command || null;
      if (!cmd) {
        results.push(`### ${r.id}: ${r.current} (target ${r.target})\nNo diagnostic command configured.`);
        continue;
      }
      let output: string;
      try {
        output = execSync(cmd, {
          encoding: "utf-8",
          timeout: 30_000,
          stdio: ["pipe", "pipe", "pipe"],
          cwd: process.cwd(),
        }).trim();
      } catch (err: any) {
        const stdout = (err.stdout || "").trim();
        const stderr = (err.stderr || "").trim();
        output = [stdout, stderr].filter(Boolean).join("\n") || `(command failed with exit code ${err.status ?? "?"})`;
      }
      // Truncate long outputs
      const truncated = output.length > 1000 ? output.slice(0, 1000) + "\n...(truncated)" : output;
      results.push(`### ${r.id}: ${r.current} (target ${r.target})\nCommand: \`${cmd}\`\nOutput:\n\`\`\`\n${truncated}\n\`\`\``);
    }

    return `## 🔍 Red Metric Diagnostic Results (auto-collected)\n\n${results.join("\n\n")}`;
  } catch {
    return "";
  }
}

/**
 * Format a G-pattern metrics block for direct prompt injection.
 *
 * Returns a self-contained string that forces metric engagement (the "G pattern"):
 * - If any metrics are breaching: presents them with breadcrumbs and asks
 *   "which is furthest from target?"
 * - If all healthy: returns a short "all clear" line.
 *
 * Use this to inject metrics into any prompt context (not just heartbeats).
 * The returned block includes breadcrumbs (Quick check commands/queries).
 */
export function formatMetricsBlock(ctx: WorkflowContext, agent: string): string {
  const metrics = loadMetrics(ctx, agent);
  if (!metrics) return `📊 No metrics owned by ${agent}. Check system-level metrics if your heartbeat guidance requires it.\n`;

  const hasRed = metrics.includes("⚠️ BELOW TARGET");
  if (!hasRed) {
    return `📊 No red metric signals. Metrics alone do not require action.\n${metrics}\n`;
  }

  return `**⚡ FIRST — review red metric signals before choosing work:**

${metrics}

**Judge the signal in context.** Read the relevant project/agent context, then follow shared/may-agent-docs/manual/metric-alerts.md. Do NOT take destructive actions (rebuild DB, delete files, rename production data). If the fix requires destructive changes, escalate to human.

---
`;
}

/**
 * Generic heartbeat workflow executor.
 *
 * All agent heartbeats are identical except for the agent name.
 * This function contains the shared logic so each agent's heartbeat
 * file can be a thin 5-line wrapper.
 *
 * Usage in agent heartbeat files:
 *   import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";
 *   export const name = "bob-heartbeat";
 *   export const description = "bob's heartbeat.";
 *   export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "bob");
 */
/**
 * Check if this heartbeat has enough actionable work to justify an LLM session.
 * Returns null if the heartbeat should proceed, or a skip-reason string if it should be skipped.
 *
 * A heartbeat is skippable when ALL of these are true:
 *   1. No red/breaching metrics
 *   2. No unresolved alerts
 *   3. No pending inbox events
 *   4. No active projects needing attention
 *   5. Last heartbeat for this agent ran recently (within cooldown window)
 *
 * This saves ~1 LLM session per agent per skipped heartbeat (~7 agents × up to 1/hr = 7+ sessions/hr saved).
 */
export function shouldSkipHeartbeat(
  ctx: WorkflowContext,
  agent: string,
  metrics: string,
  alerts: string,
  inbox: string,
  projects: string,
): string | null {
  // Always run if there are red metrics
  if (metrics.includes("⚠️ BELOW TARGET")) return null;

  // Always run if there are active alerts
  if (alerts && alerts.trim().length > 0) return null;

  // Always run if there are pending inbox events
  if (inbox && inbox.trim().length > 0) return null;

  // Always run if there are active projects
  if (projects && projects.trim().length > 0) return null;

  // Check cooldown: skip if last heartbeat was recent (< 55 min ago)
  // This effectively halves heartbeat frequency from every 30min to ~every 60min
  // when there's nothing actionable
  const COOLDOWN_MS = 55 * 60 * 1000; // 55 minutes
  try {
    const recent = ctx.query.events({
      type: "handler.completed",
      since: Date.now() - COOLDOWN_MS,
      limit: 50,
    }).rows;
    const hasRecentHeartbeat = recent.some((event: any) => {
      const raw = typeof event.data === "string" ? event.data : JSON.stringify(event.data ?? {});
      let handler = "";
      try {
        const data = JSON.parse(raw);
        handler = String(data.handler ?? "");
      } catch {}
      return handler === `heartbeat-${agent}` || raw.includes("heartbeat") && raw.includes(agent);
    });

    if (hasRecentHeartbeat) {
      return `idle-skip: no actionable items and last heartbeat was recent`;
    }
  } catch {
    // If DB check fails, don't skip — run the heartbeat
    return null;
  }

  // First heartbeat or cooldown expired — run it
  return null;
}

export async function genericHeartbeat(ctx: WorkflowContext, agent: string): Promise<WorkflowResult> {
  const metrics = loadMetrics(ctx, agent);
  const metricsBlock = formatMetricsBlock(ctx, agent);
  const projects = loadProjects(ctx, agent);
  const alerts = loadAlerts(ctx, agent);
  const guidance = loadHeartbeatMd(ctx, agent);
  const inbox = loadInbox(ctx, agent);

  // Heartbeats ALWAYS run — the agent's job is to FIND things to work on.
  // Policy: common-sense.md rule + commit 20c7af19b. Never skip.

  // ── CIRCUIT BREAKER: Skip if agent has too many consecutive errors ──
  const agentsRoot = getAgentsRoot(ctx);
  const circuitBlock = checkCircuitBreaker(agentsRoot, agent);
  if (circuitBlock) {
    ctx.emit({
      type: "heartbeat.skipped",
      source: `agent:${agent}`,
      owner: `agent:${agent}`,
      data: { agent, gate: "circuit_breaker", reason: circuitBlock },
    });
    ctx.log(`[heartbeat:${agent}] Circuit breaker open: ${circuitBlock}`);
    return ctx.done(`Circuit breaker OPEN for ${agent}: ${circuitBlock}`);
  }

  // ── DISPATCH DEDUP GUARD: Skip if agent heartbeat is repeatedly failing ──
  const dedupCheck = shouldDispatch(agent, "heartbeat");
  if (!dedupCheck.allowed) {
    ctx.emit({
      type: "heartbeat.skipped",
      source: `agent:${agent}`,
      owner: `agent:${agent}`,
      data: { agent, gate: "dispatch_dedup", reason: dedupCheck.reason, attempts: dedupCheck.attempts },
    });
    ctx.log(`[heartbeat:${agent}] Dispatch dedup blocked: ${dedupCheck.reason}`);
    return ctx.done(`Dispatch dedup guard blocked heartbeat for ${agent}: ${dedupCheck.reason}`);
  }
  recordDispatch(agent, "heartbeat");

  // Periodic cleanup of stale dedup entries
  cleanupDispatchRecords();

  // ── RED METRIC DIAGNOSTICS (JS — no LLM cost) ───────────────
  const hasRedMetrics = metrics.includes("⚠️ BELOW TARGET");
  let redMetricDiagnostics = "";

  if (hasRedMetrics) {
    ctx.emit({
      type: "heartbeat.diagnostics_started",
      source: `agent:${agent}`,
      owner: `agent:${agent}`,
      data: { agent, step: "metrics" },
    });
    redMetricDiagnostics = runRedMetricCommands(ctx, agent);
    ctx.emit({
      type: "heartbeat.diagnostics_completed",
      source: `agent:${agent}`,
      owner: `agent:${agent}`,
      data: {
        agent,
        step: "metrics",
        summary: redMetricDiagnostics ? "JS diagnostics collected" : "no commands to run",
      },
    });
  }

  // ── MAIN HEARTBEAT ─────────────────────────────────────────
  const redMetricContext = redMetricDiagnostics ? `
${redMetricDiagnostics}

**Review the diagnostic results above.** For each red metric, follow shared/may-agent-docs/manual/metric-alerts.md and choose one operation: investigate then fix, calibrate, downgrade with evidence, upgrade/escalate emergency, resolve stale state, or document an exception.
` : "";

  const prompt = `You are **${agent}** waking up for your heartbeat.

Heartbeat is your implicit self-maintenance project. Use the same work model as explicit projects: goal/context + signals -> judgment -> action/evidence.

When heartbeat guidance asks you to review files (digests, logs, knowledge, or transcripts), use read() with offsets/limits or targeted shell commands (tail, sed ranges, grep). Do not dump large files with unbounded cat; oversized tool output can terminate the session before you produce value.

${metricsBlock}
${redMetricContext}
## Signals: Active Alerts
${alerts || "None — all clear."}
If any alert is yours, follow shared/may-agent-docs/manual/metric-alerts.md and state the chosen operation plus evidence in your final summary.

## Signals: Pending Events (inbox)
${inbox || "No pending events."}
For each: act, delegate, dismiss (with reason), or escalate.

## Explicit Shared Projects You Own
${projects || "No active shared projects."}

## Agent Goal / Standing Plan
${guidance}

---

Make a judgment from the full context. If routine self-maintenance is enough, leave evidence. If you find a durable multi-session goal, create or update an explicit shared project. ${redMetricDiagnostics ? "Red metric diagnostics are above — address each signal, then proceed with normal heartbeat work." : "Review signals, projects, and guidance. Act on what matters."}

Do not create a project just to dismiss, downgrade, or record a one-session metric alert judgment. Metric triage is an operation: investigate, fix, calibrate, downgrade, escalate, except, or resolve stale state with evidence. Create a project only when the alert reveals durable multi-session work with a clear goal, owner, signal, and next validation path.

When creating a shared project, use this canonical layout at \`projects/<id>/project.md\`; metadata lives in YAML frontmatter:
\`\`\`markdown
---
id: <id>
owner: ${agent}
status: active
type: milestone
priority: P2
workflow: project
iteration: 0
---

# <Project Name>

## Goal

## Signals

## Current State

## Plan

## Validation

## Journal
\`\`\`

${FINISH_HYGIENE_INSTRUCTIONS}`;

  ctx.emit({
    type: "workflow.step_started",
    source: `agent:${agent}`,
    owner: `agent:${agent}`,
    data: { workflow: "heartbeat", step: "heartbeat" },
  });
  ctx.emit({
    type: "context.read",
    source: `agent:${agent}`,
    owner: `agent:${agent}`,
    data: {
      agent,
      contextSource: "query.heartbeatContext",
      sections: { metrics: !!metrics, projects: !!projects, inbox: !!inbox, alerts: !!alerts },
    },
  });

  let result: any;
  try {
    result = await ctx.runAgent(agent, prompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordCircuitOutcome(agentsRoot, agent, true, `heartbeat threw: ${message.slice(0, 200)}`);
    recordDedupOutcome(agent, "heartbeat", "error");
    throw err;
  }
  ctx.emit({
    type: "agent.decision",
    source: `agent:${agent}`,
    owner: `agent:${agent}`,
    data: { agent, status: result.status, hasDeliverables: !!(result.deliverables?.length) },
  });
  recordCircuitOutcome(agentsRoot, agent, result.status === "error",
    result.status === "error" ? "heartbeat session error" : undefined);
  recordDedupOutcome(agent, "heartbeat", result.status === "error" ? "error" : "success");

  if (result.status === "error") {
    return ctx.escalate(`Heartbeat agent session failed for ${agent}`, {
      sessionId: result.sessionId,
      error: result.error ?? result.lastAssistantText ?? "unknown error",
    });
  }

  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}
