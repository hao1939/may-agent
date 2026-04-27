/// <reference path="../../../src/lib/workflow-defs.d.ts" />
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
import { join } from "node:path";
import { checkCircuitBreaker, recordOutcome } from "./circuit-breaker.js";

function getAgentsRoot(ctx: WorkflowContext): string {
  return ctx.agentsRoot || join(process.cwd(), "agents");
}

export function loadMetrics(ctx: WorkflowContext, agent: string): string {
  try {
    const db = ctx.getDb() as any;
    const rows = db.prepare(
      "SELECT id, current, target, threshold, alert_op, source_query, source_command FROM metrics WHERE owner = ? AND status = 'active'"
    ).all(agent) as any[];
    if (!rows.length) return "";
    return rows.map((r: any) => {
      const breached = r.threshold != null && r.current != null &&
        (r.alert_op === ">" || r.alert_op === "above" ? r.current > r.threshold : r.current < r.threshold);
      let line = `📊 ${r.id}: ${r.current ?? "?"} (target ${r.target ?? "?"}) ${breached ? "⚠️ BELOW TARGET" : "✅"}`;
      if (breached) {
        // Count consecutive breached snapshots for escalation
        let consecutiveBreaches = 0;
        try {
          const snapshots = db.prepare(
            "SELECT value FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 10"
          ).all(r.id) as any[];
          for (const s of snapshots) {
            const sBreach = r.alert_op === ">" || r.alert_op === "above" ? s.value > r.threshold : s.value < r.threshold;
            if (sBreach) consecutiveBreaches++;
            else break;
          }
        } catch {}

        if (consecutiveBreaches >= 3) {
          line += `\n  ⛔ REPEATED ALERT (seen ${consecutiveBreaches}x): This metric has been failing for ${consecutiveBreaches} consecutive checks with NO action taken.`;
          line += `\n  → You MUST act on this NOW. Continuing to ignore it is not acceptable.`;
        }
        if (r.source_command) line += `\n  → MANDATORY: Run this command NOW → bash("${r.source_command}")`;
        else if (r.source_query) line += `\n  → MANDATORY: Run this query NOW → ${r.source_query.substring(0, 120)}`;
        line += `\n  → You MUST call a tool (bash/read/agents) for this metric. Do NOT just acknowledge it — execute.`;
      }
      return line;
    }).join("\n");
  } catch { return ""; }
}

export function loadProjects(ctx: WorkflowContext, agent: string): string {
  try {
    const lines: string[] = [];

    // Scan shared projects (new location)
    const sharedProjDir = join(getAgentsRoot(ctx), "shared", "projects");
    if (existsSync(sharedProjDir)) {
      for (const entry of readdirSync(sharedProjDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const pFile = join(sharedProjDir, entry.name, "project.md");
        if (!existsSync(pFile)) continue;
        const content = readFileSync(pFile, "utf-8");
        const owner = content.match(/^\*\*Owner\*\*:\s*(\S+)/m)?.[1] ?? "?";
        if (owner !== agent) continue; // only show owned projects
        const status = content.match(/^\*\*Status\*\*:\s*(\S+)/m)?.[1] ?? "?";
        if (status === "done" || status === "complete") continue;
        const health = content.match(/^\*\*Health\*\*:\s*(.+)/m)?.[1] ?? "";
        const msX = (content.match(/^- \[x\]/gim) || []).length;
        const msT = msX + (content.match(/^- \[ \]/gm) || []).length;
        const resumeCond = content.match(/Resume.*?:(.+)/i)?.[1]?.trim() ?? "";
        lines.push(`- **${entry.name}**: ${status} | health: ${health || "—"} | ms: ${msX}/${msT}${resumeCond ? " | resume: " + resumeCond.slice(0, 60) : ""}`);
      }
    }

    // Also scan legacy per-agent location
    const projDir = join(getAgentsRoot(ctx), agent, "workspace", "projects");
    if (existsSync(projDir)) {
      for (const entry of readdirSync(projDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const pFile = join(projDir, entry.name, "project.md");
        if (!existsSync(pFile)) continue;
        const content = readFileSync(pFile, "utf-8");
        const status = content.match(/^\*\*Status\*\*:\s*(\S+)/m)?.[1] ?? "?";
        if (status === "done" || status === "complete") continue;
        const health = content.match(/^\*\*Health\*\*:\s*(.+)/m)?.[1] ?? "";
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
    const db = ctx.getDb() as any;
    const rows = db.prepare(
      "SELECT metric_id, severity, message FROM metric_alerts WHERE resolved_at IS NULL AND metric_id LIKE ?"
    ).all(`${agent}.%`) as any[];
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
    const db = ctx.getDb() as any;
    const rows = db.prepare(`
      SELECT id, event_type, data, urgency, timestamp, retry_count
      FROM events
      WHERE status IN ('pending', 'failed')
        AND owner = ?
        AND (ttl_ms IS NULL OR timestamp + ttl_ms > ?)
      ORDER BY CASE WHEN urgency = 'immediate' THEN 0 ELSE 1 END,
        retry_count DESC, timestamp ASC
      LIMIT 20
    `).all(agent, Date.now()) as any[];
    if (!rows.length) return "";
    return rows.map((r: any) => {
      const age = Math.round((Date.now() - r.timestamp) / 60000);
      const ageStr = age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
      const retry = r.retry_count > 0 ? ` (retry #${r.retry_count})` : "";
      const dataObj = r.data ? JSON.parse(r.data) : {};
      const summary = dataObj.summary || dataObj.error || dataObj.task || "";
      return `- [${ageStr}] **${r.event_type}**${retry} — ${summary}`.slice(0, 120);
    }).join("\n");
  } catch { return ""; }
}

/**
 * Run MANDATORY commands for red metrics in JS (no LLM needed).
 *
 * Returns a structured report of command outputs that can be injected
 * directly into the main heartbeat prompt, eliminating the need for
 * a separate LLM "red metric gate" session.
 */
export function runRedMetricCommands(ctx: WorkflowContext, agent: string): string {
  try {
    const { execSync } = require("node:child_process");
    const db = ctx.getDb() as any;
    const rows = db.prepare(
      "SELECT id, current, target, threshold, alert_op, source_command, source_query FROM metrics WHERE owner = ? AND status = 'active'"
    ).all(agent) as any[];

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
  if (!metrics) return "📊 No metrics configured.\n";

  const hasRed = metrics.includes("⚠️ BELOW TARGET");
  if (!hasRed) {
    return `📊 All metrics healthy — no action needed.\n${metrics}\n`;
  }

  return `**⚡ FIRST — evaluate your metrics before anything else:**

${metrics}

**STOP. Your FIRST tool call must be one of the "→ MANDATORY" commands above.** Do not plan, do not summarize — execute the command for the worst metric RIGHT NOW. After you see the result, decide what to do about it.

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
    const db = ctx.getDb() as any;
    const lastRun = db.prepare(
      `SELECT MAX(timestamp) as t FROM events
       WHERE event_type = 'handler.completed'
         AND json_extract(data, '$.handler') = ?
         AND timestamp > ?`
    ).get(`heartbeat-${agent === 'may' ? '' : ''}${agent}`, Date.now() - COOLDOWN_MS) as any;

    // Also check using the heartbeat naming convention
    const lastRun2 = db.prepare(
      `SELECT MAX(timestamp) as t FROM events
       WHERE event_type = 'handler.completed'
         AND data LIKE ?
         AND timestamp > ?`
    ).get(`%heartbeat%${agent}%`, Date.now() - COOLDOWN_MS) as any;

    if (lastRun?.t || lastRun2?.t) {
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

  // ── CIRCUIT BREAKER: Skip if agent has too many consecutive errors ──
  const agentsRoot = getAgentsRoot(ctx);
  const circuitBlock = checkCircuitBreaker(agentsRoot, agent);
  if (circuitBlock) {
    ctx.emit({ type: "circuit_breaker_open", agent, reason: circuitBlock });
    ctx.log(`[heartbeat:${agent}] Circuit breaker open: ${circuitBlock}`);
    return ctx.done(`Circuit breaker OPEN for ${agent}: ${circuitBlock}`);
  }

  // ── DEDUP: Skip heartbeat if nothing actionable ──────────────
  const skipReason = shouldSkipHeartbeat(ctx, agent, metrics, alerts, inbox, projects);
  if (skipReason) {
    ctx.emit({ type: "heartbeat_skipped", agent, reason: skipReason });
    ctx.log(`[heartbeat:${agent}] Skipped: ${skipReason}`);
    return ctx.done(`Heartbeat skipped (${skipReason}) — no LLM session needed.`);
  }

  // ── RED METRIC GATE (JS — no LLM cost) ──────────────────────
  const hasRedMetrics = metrics.includes("⚠️ BELOW TARGET");
  let redMetricDiagnostics = "";

  if (hasRedMetrics) {
    ctx.emit({ type: "red_metric_gate_start", step: "metrics" });
    redMetricDiagnostics = runRedMetricCommands(ctx, agent);
    ctx.emit({ type: "red_metric_gate_done", step: "metrics", summary: redMetricDiagnostics ? "JS diagnostics collected" : "no commands to run" });
  }

  // ── MAIN HEARTBEAT ─────────────────────────────────────────
  const redMetricContext = redMetricDiagnostics ? `
${redMetricDiagnostics}

**Review the diagnostic results above.** For each red metric, decide: fix it, escalate it, or defer with a concrete reason.
` : "";

  const prompt = `You are **${agent}** waking up for your heartbeat.

${metricsBlock}
${redMetricContext}
## Active Alerts
${alerts || "None — all clear."}

## Pending Events (inbox)
${inbox || "No pending events."}
For each: act, delegate, dismiss (with reason), or escalate.

## Your Projects
${projects || "No active projects."}

## Your Role & Guidance
${guidance}

---

${redMetricDiagnostics ? "Red metric diagnostics are above — address each one, then proceed with normal heartbeat work." : "Review your metrics, check your projects, do your job. Act on what matters."} Commit and finish.`;

  ctx.emit({ type: "step_start", step: "heartbeat" });
  const result = await ctx.runAgent(agent, prompt);
  recordOutcome(agentsRoot, agent, result.status === "error",
    result.status === "error" ? "heartbeat session error" : undefined);
  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}
