/**
 * fast-sync — Combined handler for high-frequency DB sync tasks.
 *
 * Runs every 5 minutes. Sequentially executes:
 *   1. session-sync (filesystem → may.db session metadata)
 *   2. evaluation-sync (heuristic evaluations for unevaluated sessions)
 *
 * Both are pure DB sync operations with no side effects on each other.
 * Consolidates 2 cron entries into 1.
 *
 * Pure JS — no LLM calls, no cost.
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import { create as createSessionSync } from "./session-sync.js";
import { create as createEvaluationSync } from "./evaluation-sync.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const runSessionSync = createSessionSync(ctx, entry);
  const runEvaluationSync = createEvaluationSync(ctx, entry);

  return async () => {
    ctx.log("[fast-sync] Starting combined sync run");

    try {
      await runSessionSync();
    } catch (err) {
      ctx.log(`[fast-sync] session-sync failed: ${err}`);
    }

    try {
      await runEvaluationSync();
    } catch (err) {
      ctx.log(`[fast-sync] evaluation-sync failed: ${err}`);
    }

    ctx.log("[fast-sync] Combined sync run complete");
  };
};
