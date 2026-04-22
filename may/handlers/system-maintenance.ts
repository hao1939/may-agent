/**
 * system-maintenance — Combined handler for hourly maintenance tasks.
 *
 * Runs every 60 minutes. Sequentially executes:
 *   1. zombie-cleanup (archive orphaned stuck sessions)
 *   2. task-watchdog (escalation ladder for stale requests)
 *   3. metrics-snapshot (snapshot all active metrics)
 *
 * All are maintenance operations with no conflicts.
 * Consolidates 3 cron entries into 1.
 *
 * Pure JS — no LLM calls, no cost.
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";
import { create as createZombieCleanup } from "./zombie-cleanup.js";
import { create as createTaskWatchdog } from "./task-watchdog.js";
import { create as createMetricsSnapshot } from "./metrics-snapshot.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const runZombieCleanup = createZombieCleanup(ctx, entry);
  const runTaskWatchdog = createTaskWatchdog(ctx, entry);
  const runMetricsSnapshot = createMetricsSnapshot(ctx, entry);

  return async () => {
    ctx.log("[system-maintenance] Starting combined maintenance run");

    try {
      await runZombieCleanup();
    } catch (err) {
      ctx.log(`[system-maintenance] zombie-cleanup failed: ${err}`);
    }

    try {
      await runTaskWatchdog();
    } catch (err) {
      ctx.log(`[system-maintenance] task-watchdog failed: ${err}`);
    }

    try {
      await runMetricsSnapshot();
    } catch (err) {
      ctx.log(`[system-maintenance] metrics-snapshot failed: ${err}`);
    }

    ctx.log("[system-maintenance] Combined maintenance run complete");
  };
};
