/**
 * session-recovery — Auto-resume failed sessions (Ambulance Protocol).
 *
 * Subscribes to `session.failed` events via cron.json `on` field.
 * Two-tier classification:
 *   Tier 1: Digest classifier (structured understanding of what happened)
 *   Tier 2: classifyError fallback (string matching)
 *
 * Actions: resume/requeue/escalate are dispatched to the session-recovery
 * workflow so the recovery attempt has a workflow trace. kill/nothing are
 * recorded as skipped.
 *
 * Replaces inline bus.subscribe() recovery logic that was in may.ts.
 */

import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

const MAX_RECOVERY_ATTEMPTS = 2;

/** Key: "agent:taskPrefix", Value: recovery attempt count. */
const recoveryAttempts = new Map<string, number>();

function recoveryKey(agent: string, task: string): string {
  return `${agent}:${task.slice(0, 100)}`;
}

function emitSkip(ctx: HandlerContext, sessionId: string | null, reason: string, data: Record<string, unknown> = {}): void {
  ctx.sdk.log("info", `[recovery] skipped: ${reason}`);
  ctx.sdk.emit("handler.skipped", {
    handler: "session-recovery",
    sessionId,
    reason,
    ...data,
  });
}

function workflowTask(input: {
  sessionId: string;
  agent: string;
  error: string;
  task?: string;
  action: string;
  source: string;
  attempt?: number;
  maxAttempts?: number;
  event?: TriggerEvent;
}): string {
  return [
    `[session-recovery] Handle failed session ${input.sessionId}.`,
    "",
    "Use the classified recovery action below. Keep the recovery simple:",
    "- resume/requeue: rerun the original task for the failed agent and report the new session id.",
    "- escalate: notify the responsible owner/human with the concrete reason.",
    "- do not mutate DB tables directly.",
    "",
    "## Recovery Decision",
    "```json",
    JSON.stringify({
      sessionId: input.sessionId,
      agent: input.agent,
      action: input.action,
      source: input.source,
      attempt: input.attempt,
      maxAttempts: input.maxAttempts,
      error: input.error,
      task: input.task ?? "",
    }, null, 2),
    "```",
    "",
    "## Trigger Event",
    "```json",
    JSON.stringify(input.event ?? null, null, 2),
    "```",
  ].join("\n");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    if (!event?.data) {
      emitSkip(ctx, null, "missing session.failed event data", { eventType: event?.type ?? null });
      return;
    }

    const { sessionId, agent, error, task } = event.data as {
      sessionId: string;
      agent: string;
      error: string;
      task?: string;
    };

    if (!sessionId || !agent || !error) {
      emitSkip(ctx, sessionId ?? null, "session.failed event missing sessionId, agent, or error", { eventType: event.type });
      return;
    }

    // ── Tier 1: Check digest classification ──────────────────────────
    let action: string | null = null;
    let source = "fallback";
    try {
      const digest = ctx.getLastDigest(sessionId);
      if (digest?.action) {
        action = digest.action;
        source = "digest";
      }
    } catch { /* best-effort — digest system shouldn't break recovery */ }

    // ── Tier 2: Fall back to classifyError (backward compat) ─────────
    if (!action) {
      const errorClass = ctx.classifyError(error);
      if (errorClass === "infra") action = "requeue";
      else action = "nothing";
    }

    ctx.sdk.log("info", `[recovery] decision=${action} source=${source} session=${sessionId} agent=${agent}`);

    // ── Act on the decision ──────────────────────────────────────────
    if (action === "resume" || action === "requeue") {
      const rKey = recoveryKey(agent, task ?? "");
      const attempts = recoveryAttempts.get(rKey) || 0;
      if (attempts < MAX_RECOVERY_ATTEMPTS) {
        try {
          recoveryAttempts.set(rKey, attempts + 1);
          const result = await ctx.sdk.runWorkflow("session-recovery", workflowTask({
            sessionId,
            agent,
            error,
            task,
            action,
            source,
            attempt: attempts + 1,
            maxAttempts: MAX_RECOVERY_ATTEMPTS,
            event,
          }), { source: "may" });
          ctx.sdk.emit("handler.workflow_dispatched", {
            handler: "session-recovery",
            workflow: "session-recovery",
            source: "may",
            workflowRunId: result.runId ?? null,
            status: result.status,
            sessionId,
            agent,
            action,
            attempt: attempts + 1,
          });
          ctx.upsertDigest({
            sessionId,
            agent,
            trigger: "recovery_requeue",
            what_happened: `Recovery requeue attempt ${attempts + 1}/${MAX_RECOVERY_ATTEMPTS} (${source}): ${(error ?? "unknown error").slice(0, 200)}`,
            details: { attempt: attempts + 1, maxAttempts: MAX_RECOVERY_ATTEMPTS, workflowRunId: result.runId ?? null, error: (error ?? "").slice(0, 300), decisionSource: source },
          }).catch(() => { /* best-effort */ });
          ctx.sdk.log("info", `[recovery] Dispatched ${agent} recovery for ${sessionId} via workflow ${result.runId ?? "unknown"} (${source}, attempt ${attempts + 1}/${MAX_RECOVERY_ATTEMPTS})`);
        } catch (requeueErr) {
          const msg = requeueErr instanceof Error ? requeueErr.message : String(requeueErr);
          ctx.sdk.log("info", `[recovery] Failed to requeue ${agent}: ${msg}`);
          ctx.sdk.emit("handler.failed", {
            handler: "session-recovery",
            agent: "may",
            sessionId,
            error: msg,
          });
        }
      } else {
        ctx.sdk.log("info", `[recovery] ${agent} exhausted ${MAX_RECOVERY_ATTEMPTS} recovery attempts for task — escalating`);
        ctx.sdk.escalate(agent, `exhausted ${MAX_RECOVERY_ATTEMPTS} recovery retries`);
      }
    } else if (action === "escalate") {
      const result = await ctx.sdk.runWorkflow("session-recovery", workflowTask({
        sessionId,
        agent,
        error,
        task,
        action,
        source,
        event,
      }), { source: "may" });
      ctx.sdk.emit("handler.workflow_dispatched", {
        handler: "session-recovery",
        workflow: "session-recovery",
        source: "may",
        workflowRunId: result.runId ?? null,
        status: result.status,
        sessionId,
        agent,
        action,
      });
    } else {
      emitSkip(ctx, sessionId, `classifier chose ${action}`, { agent, decisionSource: source });
    }
  };
};
