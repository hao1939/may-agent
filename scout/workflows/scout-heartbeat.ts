/// <reference path="../../types/workflow-defs.d.ts" />
/**
 * Scout heartbeat — creative autonomous sessions.
 *
 * No gates (artifact, anti-shallow, duration, impact).
 * Loads context (metrics, projects, inbox) but lets scout decide freely.
 */
import {
  loadMetrics,
  loadProjects,
  loadAlerts,
  loadHeartbeatMd,
  loadInbox,
  formatMetricsBlock,
  runRedMetricCommands,
} from "../../shared/workflows/heartbeat-data.js";
import { checkCircuitBreaker, recordOutcome } from "../../shared/workflows/circuit-breaker.js";
import { shouldDispatch, recordDispatch, recordOutcome as dedupRecordOutcome, cleanup as dedupCleanup } from "../../shared/workflows/dispatch-dedup-guard.js";

export const name = "scout-heartbeat";
export const description = "Scout's creative heartbeat — synthesize, connect, discover.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "scout";
  const agentsRoot = ctx.agentsRoot || require("path").join(process.cwd(), "agents");

  // Circuit breaker + dedup (keep these — they prevent runaway errors)
  const circuitBlock = checkCircuitBreaker(agentsRoot, agent);
  if (circuitBlock) {
    ctx.emit({ type: "circuit_breaker_open", agent, reason: circuitBlock });
    return ctx.done(`Circuit breaker OPEN: ${circuitBlock}`);
  }
  const dedupCheck = shouldDispatch(agent, "heartbeat");
  if (!dedupCheck.allowed) {
    return ctx.done(`Dedup blocked: ${dedupCheck.reason}`);
  }
  recordDispatch(agent, "heartbeat");
  dedupCleanup();

  // Load context
  const metricsBlock = formatMetricsBlock(ctx, agent);
  const projects = loadProjects(ctx, agent);
  const alerts = loadAlerts(ctx, agent);
  const guidance = loadHeartbeatMd(ctx, agent);
  const inbox = loadInbox(ctx, agent);

  const prompt = `You are **scout** in creative heartbeat mode.

Your cron tasks handle routine discovery (fetching arXiv, HN, XHS, GitHub).
This session is for **creative, autonomous work** — things nobody asked you to do:

- Synthesize across sources: what patterns connect recent findings?
- Find non-obvious implications for our agent system
- Make connections between disparate research areas
- Identify emerging trends before they're obvious
- Update or create shared knowledge entries (agents/shared/knowledge/entries/KE-NNN.md)
- Append any notable insights to agents/scout/workspace/digest/today.md

## Finish Hygiene (required before finish(success))
Scout sessions frequently modify tracked knowledge/digest files. Do this BEFORE the first finish(success), not only after a guard rejection:
1. After every write/edit/append, verify the changed file with read() (preferred) or a targeted file check for shell-written content.
2. Run \`cd /app/agents && git status --short\` and identify only your intentional deliverables.
3. Stage exact intentional paths only; never use \`git add .\`. If a Scout workspace deliverable is ignored, use \`git add -f -- '<exact path>'\`.
4. Commit intentional deliverables with a descriptive \`scout: ...\` message.
5. Re-run \`cd /app/agents && git status --short\`. Do not stage runtime files like \`scout/last-session.md\`, shared gate logs, or unrelated project files.
6. In finish(success), list deliverables and cite read-back, commit id/output, and status check evidence.

${metricsBlock}

## Alerts
${alerts || "None."}

## Inbox
${inbox || "No pending events."}

## Your Projects
${projects || "No active projects."}

## Guidance
${guidance}

---

Think freely. Go deep on something interesting. The value is in connections and insights that routine fetching can't produce.`;

  ctx.emit({ type: "step_start", step: "heartbeat" });

  let result: any;
  try {
    result = await ctx.runAgent(agent, prompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordOutcome(agentsRoot, agent, true, `heartbeat threw: ${message.slice(0, 200)}`);
    dedupRecordOutcome(agent, "heartbeat", "error");
    throw err;
  }

  recordOutcome(agentsRoot, agent, result.status === "error",
    result.status === "error" ? "heartbeat session error" : undefined);
  dedupRecordOutcome(agent, "heartbeat", result.status === "error" ? "error" : "success");

  // No gates — return directly
  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}
