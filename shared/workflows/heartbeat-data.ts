/// <reference path="../../../src/lib/workflow-defs.d.ts" />
/**
 * Shared heartbeat data loaders.
 *
 * Pure JS functions that pre-load metrics, projects, alerts, inbox, and
 * heartbeat.md for any agent's heartbeat workflow. Zero LLM cost.
 *
 * Usage in per-agent heartbeat workflows:
 *   import { loadMetrics, loadProjects, loadAlerts, loadHeartbeatMd, loadInbox } from "../../shared/workflows/heartbeat-data.js";
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

function getAgentsRoot(ctx: WorkflowContext): string {
  return ctx.agentsRoot || join(process.cwd(), "agents");
}

export function loadMetrics(ctx: WorkflowContext, agent: string): string {
  try {
    const db = ctx.getDb() as any;
    const rows = db.prepare(
      "SELECT id, current, target, threshold, alert_direction, source_query, source_command FROM metrics WHERE owner = ? AND status = 'active'"
    ).all(agent) as any[];
    if (!rows.length) return "";
    return rows.map((r: any) => {
      const breached = r.threshold != null && r.current != null &&
        (r.alert_direction === "above" ? r.current > r.threshold : r.current < r.threshold);
      let line = `📊 ${r.id}: ${r.current ?? "?"} (target ${r.target ?? "?"}) ${breached ? "⚠️ BELOW TARGET" : "✅"}`;
      if (breached) {
        // Count consecutive breached snapshots for escalation
        let consecutiveBreaches = 0;
        try {
          const snapshots = db.prepare(
            "SELECT value FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 10"
          ).all(r.id) as any[];
          for (const s of snapshots) {
            const sBreach = r.alert_direction === "above" ? s.value > r.threshold : s.value < r.threshold;
            if (sBreach) consecutiveBreaches++;
            else break;
          }
        } catch {}

        if (consecutiveBreaches >= 3) {
          line += `\n  ⛔ REPEATED ALERT (seen ${consecutiveBreaches}x): This metric has been failing for ${consecutiveBreaches} consecutive checks with NO action taken.`;
          line += `\n  → You MUST act on this NOW. Continuing to ignore it is not acceptable.`;
        }
        if (r.source_command) line += `\n  → Quick check: bash ${r.source_command}`;
        else if (r.source_query) line += `\n  → Quick check: run SQL — ${r.source_query.substring(0, 120)}`;
        line += `\n  → ACTION REQUIRED: Investigate this metric NOW or explain in your session summary why you deferred it.`;
      }
      return line;
    }).join("\n");
  } catch { return ""; }
}

export function loadProjects(ctx: WorkflowContext, agent: string): string {
  try {
    const projDir = join(getAgentsRoot(ctx), agent, "workspace", "projects");
    if (!existsSync(projDir)) return "";
    const lines: string[] = [];
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
