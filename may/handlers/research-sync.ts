/**
 * research-sync — Periodically syncs markdown research artifacts into SQLite.
 *
 * Reads knowledge entries, hypotheses, and experiments from their markdown
 * files in agents/shared/knowledge/ and upserts them into the DB tables
 * (knowledge_entries, hypotheses, experiments) via syncAll().
 *
 * Emits a `research_sync` event on the EventBus with sync counts.
 *
 * Usage in cron.json:
 *   {
 *     "name": "research-sync",
 *     "type": "job",
 *     "handler": "research-sync",
 *     "intervalMs": 1800000,
 *     "enabled": true,
 *     "description": "Sync research artifacts (knowledge, hypotheses, experiments) into SQLite every 30min"
 *   }
 */

import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import { syncAll } from "../../../src/lib/research-db.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const basePath = `${ctx.projectRoot}/agents/shared/knowledge`;
    const db = ctx.getDb();

    const results = syncAll(db, basePath);

    const totalSynced =
      results.knowledgeEntries.synced +
      results.hypotheses.synced +
      results.experiments.synced;

    const allErrors = [
      ...results.knowledgeEntries.errors,
      ...results.hypotheses.errors,
      ...results.experiments.errors,
    ];

    ctx.log(
      `[research-sync] Synced ${totalSynced} artifacts ` +
      `(KE: ${results.knowledgeEntries.synced}, H: ${results.hypotheses.synced}, EXP: ${results.experiments.synced})` +
      (allErrors.length > 0 ? ` — ${allErrors.length} errors` : ""),
    );

    if (allErrors.length > 0) {
      ctx.log(`[research-sync] Errors: ${allErrors.slice(0, 5).join("; ")}`);
    }

    // Emit research_sync event on EventBus
    ctx.emit({
      type: "research_sync",
      knowledgeEntries: results.knowledgeEntries.synced,
      hypotheses: results.hypotheses.synced,
      experiments: results.experiments.synced,
      errors: allErrors.length,
    });
  };
};
