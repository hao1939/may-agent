/**
 * daily-reports — Combined handler for daily report generation.
 *
 * Runs every 24 hours. Sequentially executes:
 *   1. daily-brief (system metrics summary → Telegram)
 *   2. daily-digest (progress digest for human review)
 *   3. analyze-failures (failure analysis report)
 *   4. coaching-report (per-agent quality scores + trends)
 *
 * All generate reports from read-only DB queries. No conflicts.
 * Consolidates 4 cron entries into 1.
 *
 * Pure JS — no LLM calls, no cost.
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import { create as createDailyBrief } from "./daily-brief.js";
import { create as createDailyDigest } from "./daily-digest.js";
import { create as createAnalyzeFailures } from "./analyze-failures.js";
import { create as createCoachingReport } from "./coaching-report.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const runDailyBrief = createDailyBrief(ctx, entry);
  const runDailyDigest = createDailyDigest(ctx, entry);
  const runAnalyzeFailures = createAnalyzeFailures(ctx, entry);
  const runCoachingReport = createCoachingReport(ctx, entry);

  return async () => {
    ctx.log("[daily-reports] Starting combined reports run");

    try {
      await runDailyBrief();
    } catch (err) {
      ctx.log(`[daily-reports] daily-brief failed: ${err}`);
    }

    try {
      await runDailyDigest();
    } catch (err) {
      ctx.log(`[daily-reports] daily-digest failed: ${err}`);
    }

    try {
      await runAnalyzeFailures();
    } catch (err) {
      ctx.log(`[daily-reports] analyze-failures failed: ${err}`);
    }

    try {
      await runCoachingReport();
    } catch (err) {
      ctx.log(`[daily-reports] coaching-report failed: ${err}`);
    }

    ctx.log("[daily-reports] Combined reports run complete");
  };
};
