/**
 * escalation — Route blocked/failed session escalations to human.
 *
 * Subscribes to `session.escalated` events via cron.json `on` field.
 * Consults the digest classifier to decide whether to escalate or ignore.
 *
 * Replaces inline bus.subscribe() escalation logic that was in may.ts.
 */

import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    if (!event?.data) return;

    const { sessionId, agent, finishParams } = event.data as {
      sessionId: string;
      agent: string;
      finishParams: { status: string; summary?: string; [key: string]: unknown };
    };

    if (!sessionId || !agent || !finishParams) return;

    const fp = finishParams;

    // ── Consult digest classifier ──────────────────────────────────────
    const trigger = fp.status === "blocked" ? "session_end_blocked" : "session_end_failure";
    let action = "escalate"; // fallback: always escalate (backward compat)
    let reason = `${fp.status}: ${fp.summary ?? "unknown"}`;
    let source = "fallback";

    try {
      const digest = ctx.getLastDigest(sessionId);
      if (digest?.what_happened) {
        const classification = ctx.classifyDigest(
          {
            outcome: digest.outcome ?? fp.status,
            still_open: digest.still_open ?? null,
            what_happened: digest.what_happened,
          },
          trigger,
        );
        action = classification.action;
        reason = classification.reason;
        source = "digest";
      }
    } catch { /* best-effort — classifier failure falls through to escalate */ }

    ctx.sdk.log("info", `[escalation] decision=${action} source=${source} session=${sessionId} agent=${agent} status=${fp.status}`);

    if (action === "escalate") {
      ctx.sdk.escalate(agent, `${fp.status}: ${fp.summary ?? "unknown"}`);
    }
    // "nothing" / other → session ended cleanly enough, no escalation needed
  };
};
