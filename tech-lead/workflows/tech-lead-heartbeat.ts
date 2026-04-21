/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const name = "tech-lead-heartbeat";
export const description = "tech-lead's heartbeat.";

function getAgentsRoot(ctx: WorkflowContext): string {
  return ctx.agentsRoot || join(process.cwd(), "agents");
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "tech-lead";

  // Pre-load all context in JS (no LLM ops wasted on queries)
  const metrics = loadMetrics(ctx, agent);
  const projects = loadProjects(ctx, agent);
  const alerts = loadAlerts(ctx, agent);
  const guidance = loadHeartbeatMd(ctx, agent);

  // Detect if there are below-target metrics for G-pattern injection
  const hasRedMetrics = metrics.includes("⚠️ BELOW TARGET");
  if (hasRedMetrics) ctx.emit({ type: "breadcrumb_shown", step: "metrics" });
  const gPatternBlock = hasRedMetrics ? `
## ⚡ FIRST — evaluate your red metrics before anything else

**Question**: Which metric above is furthest from its target? Follow the "→ Quick check" breadcrumb for that metric NOW — run the command or query. Then decide: is this urgent enough to act on this heartbeat, or can it wait?

---
` : "";

  const prompt = `You are **tech-lead** waking up for your heartbeat.

## Your Metrics
${metrics || "No metrics data available."}
${gPatternBlock}
## Active Alerts
${alerts || "None — all clear."}

## Your Projects
${projects || "No active projects."}

## Your Role & Guidance
${guidance}

---

Review your metrics, check your projects, do your job. Act on what matters. Commit and finish.`;

  ctx.emit({ type: "step_start", step: "heartbeat" });
  const result = await ctx.runAgent(agent, prompt);
  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}

// ── Data loaders (JS, no LLM ops) ──────────────────────────────

function loadMetrics(ctx: WorkflowContext, agent: string): string {
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
      // Add actionable breadcrumb for below-target metrics
      if (breached) {
        if (r.source_command) line += `
  → Quick check: bash ${r.source_command}`;
        else if (r.source_query) line += `
  → Quick check: run SQL — ${r.source_query.substring(0, 120)}`;
      }
      return line;
    }).join("\n");
  } catch { return ""; }
}

function loadProjects(ctx: WorkflowContext, agent: string): string {
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

function loadAlerts(ctx: WorkflowContext, agent: string): string {
  try {
    const db = ctx.getDb() as any;
    const rows = db.prepare(
      "SELECT metric_id, severity, message FROM metric_alerts WHERE resolved_at IS NULL AND metric_id LIKE ?"
    ).all(`${agent}.%`) as any[];
    if (!rows.length) return "";
    return rows.map((r: any) => `⚠️ ${r.metric_id}: ${r.message}`).join("\n");
  } catch { return ""; }
}

function loadHeartbeatMd(ctx: WorkflowContext, agent: string): string {
  try {
    
    
    return readFileSync(join(getAgentsRoot(ctx), agent, "heartbeat.md"), "utf-8");
  } catch { return "(No heartbeat.md found)"; }
}
