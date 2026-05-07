/**
 * session-recovery — Auto-resume failed sessions (Ambulance Protocol).
 *
 * Subscribes to `session.failed` events via cron.json `on` field.
 * Two-tier classification:
 *   Tier 1: Digest classifier (structured understanding of what happened)
 *   Tier 2: classifyError fallback (string matching)
 *
 * Actions: resume/requeue → re-run the task, escalate → notify human,
 * kill/nothing → let the session die.
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

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    if (!event?.data) return;

    const { sessionId, agent, error, task } = event.data as {
      sessionId: string;
      agent: string;
      error: string;
      task?: string;
    };

    if (!sessionId || !agent || !error) return;

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

    ctx.log(`[recovery] decision=${action} source=${source} session=${sessionId} agent=${agent}`);

    // ── Act on the decision ──────────────────────────────────────────
    if (action === "resume" || action === "requeue") {
      const rKey = recoveryKey(agent, task ?? "");
      const attempts = recoveryAttempts.get(rKey) || 0;
      if (attempts < MAX_RECOVERY_ATTEMPTS) {
        try {
          recoveryAttempts.set(rKey, attempts + 1);
          const result = await ctx.sdk.runAgent(agent, task ?? "", { source: "recovery" });
          const newSessionId = result.sessionId;
          // Digest: recovery_requeue
          ctx.upsertDigest({
            sessionId,
            agent,
            trigger: "recovery_requeue",
            what_happened: `Recovery requeue attempt ${attempts + 1}/${MAX_RECOVERY_ATTEMPTS} (${source}): ${(error ?? "unknown error").slice(0, 200)}`,
            details: { attempt: attempts + 1, maxAttempts: MAX_RECOVERY_ATTEMPTS, newSessionId, error: (error ?? "").slice(0, 300), decisionSource: source },
          }).catch(() => { /* best-effort */ });
          ctx.log(`[recovery] Requeued ${agent} session ${sessionId} → ${newSessionId} (${source}, attempt ${attempts + 1}/${MAX_RECOVERY_ATTEMPTS})`);
        } catch (requeueErr) {
          const msg = requeueErr instanceof Error ? requeueErr.message : String(requeueErr);
          ctx.log(`[recovery] Failed to requeue ${agent}: ${msg}`);
        }
      } else {
        ctx.log(`[recovery] ${agent} exhausted ${MAX_RECOVERY_ATTEMPTS} recovery attempts for task — escalating`);
        ctx.escalate(agent, `exhausted ${MAX_RECOVERY_ATTEMPTS} recovery retries`);
      }
    } else if (action === "escalate") {
      ctx.escalate(agent, `digest classifier recommended escalation for session ${sessionId}`);
    }
    // "kill" and "nothing" → do nothing (session is dead or non-recoverable)
  };
};
