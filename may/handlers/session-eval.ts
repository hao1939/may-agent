/**
 * session-eval — Auto-evaluate completed task trees.
 *
 * Subscribes to `session.completed` events via cron.json `on` field.
 * Fires heuristic evaluation on completed session trees (sessions with a parent),
 * then emits context-learn events for each evaluated session.
 *
 * Replaces inline bus.subscribe() auto-eval logic that was in may.ts.
 */

import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";
import { evaluateTask } from "../../shared/evaluation/evaluator.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    if (!event?.data) return;

    const { sessionId, agent, parentSessionId } = event.data as {
      sessionId: string;
      agent: string;
      parentSessionId?: string;
    };

    if (!sessionId || !agent || !parentSessionId) return;

    try {
      const result = await evaluateTask({
        manager: ctx.manager,
        ctx,
        parentSessionId,
      });

      if (result) {
        const agentNames = Object.keys(result.agents).join(", ");
        const verdict = result.overall.verdict;
        ctx.log(`[eval] Auto-evaluated ${result.sessionIds.length} session(s) (${agentNames}): ${verdict}`);

        // Emit context-learn events for each evaluated session
        for (const evalSessionId of result.sessionIds) {
          const meta = ctx.readSessionMeta(evalSessionId);
          if (meta?.agent) {
            ctx.emit({ type: "context-learn", agentName: meta.agent, sessionId: evalSessionId, persistDir: ctx.persistDir });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.log(`[eval] Auto-evaluation failed: ${msg}`);
    }
  };
};
