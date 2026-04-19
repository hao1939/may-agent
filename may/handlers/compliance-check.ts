/**
 * compliance-check — Combined handler for rule compliance scanning.
 *
 * Runs every 30 minutes. Sequentially executes:
 *   1. convention-check (sessions vs CONVENTIONS.md)
 *   2. standing-orders-check (sessions vs standing orders)
 *
 * Both scan recent sessions for rule violations with similar inputs.
 * Consolidates 2 cron entries into 1.
 *
 * Pure JS — no LLM calls, no cost.
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import { create as createConventionCheck } from "./convention-check.js";
import { create as createStandingOrdersCheck } from "./standing-orders-check.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const runConventionCheck = createConventionCheck(ctx, entry);
  const runStandingOrdersCheck = createStandingOrdersCheck(ctx, entry);

  return async () => {
    ctx.log("[compliance-check] Starting combined compliance run");

    try {
      await runConventionCheck();
    } catch (err) {
      ctx.log(`[compliance-check] convention-check failed: ${err}`);
    }

    try {
      await runStandingOrdersCheck();
    } catch (err) {
      ctx.log(`[compliance-check] standing-orders-check failed: ${err}`);
    }

    ctx.log("[compliance-check] Combined compliance run complete");
  };
};
