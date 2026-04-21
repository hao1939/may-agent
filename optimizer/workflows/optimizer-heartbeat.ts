/// <reference path="../../../src/lib/workflow-defs.d.ts" />

export const name = "optimizer-heartbeat";
export const description = "optimizer's heartbeat.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "optimizer";

  // Pre-load all context in JS (no LLM ops wasted on queries)
  const metrics = loadMetrics(ctx, agent);
  const projects = loadProjects(ctx, agent);
  const alerts = loadAlerts(ctx, agent);
  const guidance = loadHeartbeatMd(ctx, agent);

  const prompt = `You are **optimizer** waking up for your heartbeat.

## Your Metrics
${metrics || "No metrics data available."}

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
      "SELECT id, current, target, threshold, alert_direction FROM metrics WHERE owner = ? AND status = 'active'"
    ).all(agent) as any[];
    if (!rows.length) return "";
    return rows.map((r: any) => {
      const breached = r.threshold != null && r.current != null &&
        (r.alert_direction === "above" ? r.current > r.threshold : r.current < r.threshold);
      return `📊 ${r.id}: ${r.current ?? "?"} (target ${r.target ?? "?"}) ${breached ? "⚠️ BELOW TARGET" : "✅"}`;
    }).join("\n");
  } catch { return ""; }
}

function loadProjects(ctx: WorkflowContext, agent: string): string {
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const projDir = path.join(ctx.agentsRoot, agent, "workspace", "projects");
    if (!fs.existsSync(projDir)) return "";
    const lines: string[] = [];
    for (const entry of fs.readdirSync(projDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pFile = path.join(projDir, entry.name, "project.md");
      if (!fs.existsSync(pFile)) continue;
      const content = fs.readFileSync(pFile, "utf-8");
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
    const fs = require("node:fs");
    const path = require("node:path");
    return fs.readFileSync(path.join(ctx.agentsRoot, agent, "heartbeat.md"), "utf-8");
  } catch { return "(No heartbeat.md found)"; }
}
