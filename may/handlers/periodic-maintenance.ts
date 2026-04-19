/**
 * periodic-maintenance — Combined handler for bi-hourly maintenance.
 *
 * Runs every 2 hours. Sequentially executes:
 *   1. agents-auto-commit (safety-net git commit for agents/)
 *   2. audit-requests (reconcile request lifecycle, auto-expire)
 *
 * Both are maintenance operations with no conflicts.
 * Consolidates 2 cron entries into 1.
 *
 * Pure JS — no LLM calls, no cost.
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import { create as createAgentsAutoCommit } from "./agents-auto-commit.js";
import { create as createAuditRequests } from "./audit-requests.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const runAgentsAutoCommit = createAgentsAutoCommit(ctx, entry);
  const runAuditRequests = createAuditRequests(ctx, entry);

  return async () => {
    ctx.log("[periodic-maintenance] Starting combined maintenance run");

    try {
      await runAgentsAutoCommit();
    } catch (err) {
      ctx.log(`[periodic-maintenance] agents-auto-commit failed: ${err}`);
    }

    try {
      await runAuditRequests();
    } catch (err) {
      ctx.log(`[periodic-maintenance] audit-requests failed: ${err}`);
    }

    ctx.log("[periodic-maintenance] Combined maintenance run complete");
  };
};
