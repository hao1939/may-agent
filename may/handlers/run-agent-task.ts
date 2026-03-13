/**
 * run-agent-task — generic handler for cron jobs that delegate to an agent.
 *
 * Replaces the broken `fireTask` (subprocess) path. Runs the target agent
 * in-process via SubagentManager, with timeout protection.
 *
 * cron.json usage:
 *   {
 *     "name": "analyze-failures",
 *     "type": "job",
 *     "handler": "run-agent-task",
 *     "agent": "bob",
 *     "message": "[cron:analyze-failures] ...",
 *     "handlerConfig": { "maxTurns": 30, "timeoutMs": 600000 }
 *   }
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig || {}) as {
    /** Maximum time to wait for the agent session (default: 10 min). */
    timeoutMs?: number;
    /** Whether to wait for the session to complete (default: true). */
    waitForCompletion?: boolean;
  };

  const agentName = entry.agent || "may";
  const timeoutMs = config.timeoutMs ?? 600_000; // 10 min default
  const waitForCompletion = config.waitForCompletion !== false;

  return async () => {
    const message = entry.message || `[cron:${entry.name}] Execute your task.`;

    ctx.log(`[run-agent-task:${entry.name}] Starting ${agentName} session...`);

    const sessionId = ctx.manager.run(agentName, message, {
      source: "cron",
    });

    ctx.log(`[run-agent-task:${entry.name}] Started ${agentName} session: ${sessionId}`);

    if (!waitForCompletion) {
      ctx.log(`[run-agent-task:${entry.name}] Fire-and-forget mode — not waiting.`);
      return;
    }

    // Wait for completion with timeout
    const result = await Promise.race([
      ctx.manager.waitFor(sessionId).catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error(`Agent session failed: ${errMsg}`);
      }),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout after ${timeoutMs}ms`));
        }, timeoutMs);
        // Don't hold the process open
        if (timer.unref) timer.unref();
      }),
    ]).catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);

      // On timeout, cancel the session so it doesn't run forever
      if (errMsg.includes("Timeout")) {
        ctx.log(`[run-agent-task:${entry.name}] ⚠️ ${agentName} timed out after ${timeoutMs}ms — cancelling session ${sessionId}`);
        try {
          ctx.manager.cancel(sessionId);
        } catch {
          // Session may have already finished between timeout and cancel
        }
      }

      throw new Error(`[run-agent-task:${entry.name}] ${agentName} failed: ${errMsg}`);
    });

    ctx.log(`[run-agent-task:${entry.name}] ${agentName} completed: ${result.status}`);
  };
};

// ── Named export for direct programmatic use ──────────────────────────

/**
 * Run an agent task directly (outside cron).
 * Mirrors the cron handler logic for use by other handlers or one-off calls.
 */
export async function runAgentTask(
  ctx: HandlerContext,
  params: {
    agent: string;
    message: string;
    timeoutMs?: number;
    waitForCompletion?: boolean;
  },
): Promise<{ sessionId: string; status: string }> {
  const { agent, message, timeoutMs = 600_000, waitForCompletion = true } = params;

  const sessionId = ctx.manager.run(agent, message, { source: "handler" });
  ctx.log(`[runAgentTask] Started ${agent} session: ${sessionId}`);

  if (!waitForCompletion) {
    return { sessionId, status: "started" };
  }

  const result = await Promise.race([
    ctx.manager.waitFor(sessionId),
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
      if (timer.unref) timer.unref();
    }),
  ]).catch((err: unknown) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("Timeout")) {
      try { ctx.manager.cancel(sessionId); } catch { /* already done */ }
    }
    throw new Error(`runAgentTask(${agent}) failed: ${errMsg}`);
  });

  return { sessionId, status: result.status };
}


