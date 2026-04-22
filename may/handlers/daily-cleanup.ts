/**
 * daily-cleanup — Combined handler for daily file maintenance.
 *
 * Runs every 24 hours. Sequentially executes:
 *   1. workspace-compaction (archive stale workspace files 7+ days)
 *   2. memory-trimmer (trim memory .jsonl files)
 *   3. lessons-graduation (trim oversized LESSONS.md files)
 *
 * All are file trimming/cleanup operations. Sequential is safe.
 * Consolidates 3 cron entries into 1.
 *
 * Pure JS — no LLM calls, no cost.
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";
import { create as createWorkspaceCompaction } from "./workspace-compaction.js";
import { create as createMemoryTrimmer } from "./memory-trimmer.js";
import { create as createLessonsGraduation } from "./lessons-graduation.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const runWorkspaceCompaction = createWorkspaceCompaction(ctx, entry);
  const runMemoryTrimmer = createMemoryTrimmer(ctx, entry);
  const runLessonsGraduation = createLessonsGraduation(ctx, entry);

  return async () => {
    ctx.log("[daily-cleanup] Starting combined cleanup run");

    try {
      await runWorkspaceCompaction();
    } catch (err) {
      ctx.log(`[daily-cleanup] workspace-compaction failed: ${err}`);
    }

    try {
      await runMemoryTrimmer();
    } catch (err) {
      ctx.log(`[daily-cleanup] memory-trimmer failed: ${err}`);
    }

    try {
      await runLessonsGraduation();
    } catch (err) {
      ctx.log(`[daily-cleanup] lessons-graduation failed: ${err}`);
    }

    ctx.log("[daily-cleanup] Combined cleanup run complete");
  };
};
