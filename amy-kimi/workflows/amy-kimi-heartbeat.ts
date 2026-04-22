/// <reference path="../../../src/lib/workflow-defs.d.ts" />

export const name = "amy-kimi-heartbeat";
export const description = "amy-kimi's heartbeat.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "amy-kimi";

  // Pre-load all context in JS (no LLM ops wasted on queries)
  const metrics = loadMetrics(ctx, agent);
  const projects = loadProjects(ctx, agent);
  const alerts = loadAlerts(ctx, agent);
  const guidance = loadHeartbeatMd(ctx, agent);

  // ── RED METRIC GATE ──────────────────────────────────────────
  // Structural workflow gate: if ANY metric is below target, the agent
  // MUST address them in a dedicated step BEFORE the normal heartbeat.
  // This is not a prompt hint — it's a separate runAgent call that blocks.
  const hasRedMetrics = metrics.includes("⚠️ BELOW TARGET");
  let redMetricActions = "";

  if (hasRedMetrics) {
    ctx.emit({ type: "red_metric_gate_start", step: "metrics" });
    const gatePrompt = `You are **${agent}**. You have RED METRICS that must be addressed before your normal heartbeat can proceed.

## ⚠️ RED METRIC GATE — MANDATORY
Your metrics:
${metrics}

## Instructions
You CANNOT skip this step. For EACH metric marked "⚠️ BELOW TARGET" above, you must:
1. Run the "→ Quick check" command/query to get current data
2. Investigate WHY it is red (check recent sessions, code changes, etc.)
3. Take ONE of these actions:
   a. **Fix it now** — fork/dispatch work to address the root cause
   b. **Escalate** — notify the responsible agent or may with specifics
   c. **Defer with reason** — explain concretely why you cannot act now (not just "will look later")

Output a section for EACH red metric with your findings and action taken.
Do NOT do any other heartbeat work — ONLY address red metrics.`;

    const gateResult = await ctx.runAgent(agent, gatePrompt);
    redMetricActions = ctx.summarize(gateResult, { maxLength: 800 });
    ctx.emit({ type: "red_metric_gate_done", step: "metrics", summary: redMetricActions });
  }

  // ── MAIN HEARTBEAT ─────────────────────────────────────────
  const redMetricContext = redMetricActions ? `
## Red Metric Actions (completed in gate step)
${redMetricActions}
` : "";

  const prompt = `You are **${agent}** waking up for your heartbeat.

## Your Metrics
${metrics || "No metrics data available."}
${redMetricContext}
## Active Alerts
${alerts || "None — all clear."}

## Your Projects
${projects || "No active projects."}

## Your Role & Guidance
${guidance}

---

${redMetricActions ? "Your red metrics have been addressed above. Now proceed with your normal heartbeat work." : "Review your metrics, check your projects, do your job. Act on what matters."} Commit and finish.`;

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
        // M4: Count consecutive breached snapshots for escalation
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
        if (r.source_command) line += `
  → Quick check: bash ${r.source_command}`;
        else if (r.source_query) line += `
  → Quick check: run SQL — ${r.source_query.substring(0, 120)}`;
        line += `\n  → ACTION REQUIRED: Investigate this metric NOW or explain in your session summary why you deferred it.`;
      }
      return line;
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
