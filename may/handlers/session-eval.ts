/**
 * session-eval — Post-session evaluation and learning.
 *
 * Subscribes to `session.completed` events.
 * Calls the evaluator agent which:
 *   1. Judges session quality (writes evaluation via write_evaluation tool)
 *   2. Extracts durable facts and updates the agent's context.md
 */

import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    if (!event?.data) return;

    const { sessionId, agent } = event.data as {
      sessionId: string;
      agent: string;
    };

    if (!sessionId || !agent) return;
    if (["evaluator", "judge"].includes(agent)) return;

    const messages = ctx.readSessionMessages(sessionId);
    if (!messages || messages.length === 0) return;

    const meta = ctx.readSessionMeta(sessionId);
    const task = [
      `Evaluate session ${sessionId} (agent: ${agent}).`,
      `Task: ${meta?.task ?? "unknown"}`,
      `Messages: ${messages.length}`,
      ``,
      `1. Judge quality and efficiency. Use write_evaluation tool.`,
      `2. Extract durable facts and update agents/${agent}/context.md if warranted.`,
    ].join("\n");

    try {
      await ctx.sdk.runAgent("evaluator", task, { source: "session-eval" });
      ctx.sdk.log("info", `[eval] Evaluated session ${sessionId} (agent: ${agent})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.sdk.log("info", `[eval] Evaluation failed for ${sessionId}: ${msg}`);
    }
  };
};
