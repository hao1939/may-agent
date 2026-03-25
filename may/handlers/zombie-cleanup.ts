/**
 * Zombie Session Cleanup — periodic cleanup of orphaned sessions.
 *
 * cleanupZombieSessions() only runs at startup. Between restarts, sessions
 * stuck in "running" status accumulate. This handler runs it periodically
 * (every 60 min) to prevent unbounded zombie growth.
 *
 * Pure JS — no LLM calls, no cost.
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const archived = ctx.manager.cleanupZombieSessions();
    if (archived > 0) {
      ctx.log(`[zombie-cleanup] Archived ${archived} zombie session(s)`);
    }
  };
};
