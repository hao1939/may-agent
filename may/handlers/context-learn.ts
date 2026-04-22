/**
 * context-learn — Extract durable facts from completed sessions.
 *
 * Subscribes to `context-learn` events via cron.json `on` field.
 * Uses LLM (evaluator agent) for extraction; falls back to mechanical.
 * Enabled per-agent via CONTEXT_LEARN_AGENTS env var.
 */

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";
import { learnFromSession, learnFromSessionLLM } from "../../shared/evaluation/context-learn.js";

const contextLearnAgents = new Set(
  (process.env.CONTEXT_LEARN_AGENTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    if (!event?.data) return;

    const { agentName, sessionId } = event.data as {
      agentName: string;
      sessionId: string;
    };

    if (!agentName || !sessionId) return;

    // Filter: only learn for enabled agents
    if (!contextLearnAgents.has("all") && !contextLearnAgents.has(agentName)) return;
    // Never learn from meta-agents
    if (["evaluator", "coach", "judge"].includes(agentName)) return;

    const agentDir = resolve(ctx.agentsRoot, agentName);
    if (!existsSync(agentDir)) return;

    try {
      const meta = ctx.readSessionMeta(sessionId);
      const messages = ctx.readSessionMessages(sessionId);
      if (messages.length === 0) return;

      const task = meta?.task ?? "";

      // Try LLM extraction, fall back to mechanical
      let result: { added: string[]; removed: string[] };
      try {
        result = await learnFromSessionLLM({
          agentDir,
          messages: messages as any,
          agentName,
          task,
          manager: ctx.manager,
        });
      } catch {
        result = learnFromSession({
          agentDir,
          messages: messages as any,
        });
      }

      if (result.added.length > 0 || result.removed.length > 0) {
        const parts: string[] = [];
        if (result.added.length > 0) parts.push(`+${result.added.length} added`);
        if (result.removed.length > 0) parts.push(`-${result.removed.length} removed`);
        ctx.log(`[context-learn] ${agentName}: ${parts.join(", ")} from session ${sessionId}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.log(`[context-learn] Error for ${agentName}/${sessionId}: ${msg}`);
    }
  };
};
