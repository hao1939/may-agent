/**
 * E2E fixture handler: invokes a child agent via sdk.runAgent.
 *
 * Used by e6-agent-call-chain to validate that sdk.runAgent creates a child
 * session row with parentSessionId linkage and kind="call". The child agent
 * (worker) will typically fail at LLM dispatch in the sandbox (no model
 * credentials) — that's expected. The test asserts on the parent/child row
 * plumbing, not on agent outputs.
 *
 * Note: handlers are hot-reloaded on every fire (F4 in findings doc), so
 * module-level state cannot gate dispatches. The handler will re-dispatch
 * on each cron tick; the test just looks for the first qualifying row.
 */
import type { CronEntry, HandlerContext, HandlerModule, EventEnvelope } from "@may-agent/sdk";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (_event?: EventEnvelope) => {
    ctx.sdk.emit(
      "e2e.call-worker.dispatching",
      { caller: entry.name },
      { owner: "agent:may", source: entry.name },
    );
    try {
      // Fire-and-await. Worker will typically fail at LLM dispatch; we don't
      // care about the outcome here, only the session row.
      const result = await ctx.sdk.runAgent("worker", "fixture call chain ping", { timeout: 2_000 });
      ctx.sdk.emit(
        "e2e.call-worker.completed",
        { caller: entry.name, childStatus: result?.status ?? "unknown" },
        { owner: "agent:may", source: entry.name },
      );
    } catch (err) {
      // Surface as event so the test can introspect failures, but do not throw.
      ctx.sdk.emit(
        "e2e.call-worker.error",
        { caller: entry.name, reason: err instanceof Error ? err.message : String(err) },
        { owner: "agent:may", source: entry.name },
      );
    }
  };
};
