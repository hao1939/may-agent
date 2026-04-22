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

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";
import { EditGuard, validateBashCommand, enforceNoHallucinatedPaths } from "../../shared/agent-sdk.js";
import { create as createConventionCheck } from "./convention-check.js";
import { create as createStandingOrdersCheck } from "./standing-orders-check.js";

/**
 * Create a getDb function that opens .state/may.db on demand.
 * Uses its own connection (same pattern as session-sync) because
 * ctx.getDb is not provided by the runtime for JS handlers.
 */
function makeGetDb(persistDir: string) {
  let db: Database | null = null;
  return () => {
    if (!db) {
      const dbPath = join(persistDir, "may.db");
      if (!existsSync(dbPath)) {
        throw new Error(`Database not found at ${dbPath}`);
      }
      db = new Database(dbPath, { readonly: true });
    }
    return db;
  };
}

/**
 * Run guard self-tests to verify they're functional.
 * This is a lightweight smoke test run each compliance cycle.
 */
function runGuardSmokeTests(ctx: HandlerContext): void {
  const guard = new EditGuard();

  // Verify edit-guard catches unread files
  const badEdit = guard.validateEdit("some-file.ts");
  if (badEdit.valid) {
    ctx.log("[compliance-check] WARN: EditGuard failed to catch unread file edit");
  }

  // Verify edit-guard allows read files
  guard.recordRead("some-file.ts");
  const goodEdit = guard.validateEdit("some-file.ts");
  if (!goodEdit.valid) {
    ctx.log("[compliance-check] WARN: EditGuard rejected a previously-read file");
  }

  // Verify path-guard catches /home/ paths
  const badPath = validateBashCommand("cat /home/user/.bashrc");
  if (badPath.valid) {
    ctx.log("[compliance-check] WARN: validateBashCommand missed /home/ path");
  }

  // Verify path-guard allows clean commands
  const goodPath = validateBashCommand("cat README.md");
  if (!goodPath.valid) {
    ctx.log("[compliance-check] WARN: validateBashCommand rejected clean command");
  }

  // Verify enforceNoHallucinatedPaths
  const hallucinatedCheck = enforceNoHallucinatedPaths(["/home/agent/file.txt"]);
  if (hallucinatedCheck.valid) {
    ctx.log("[compliance-check] WARN: enforceNoHallucinatedPaths missed /home/ path");
  }

  ctx.log("[compliance-check] Guard smoke tests passed");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  // Augment ctx with getDb if not already provided by the runtime
  const augmentedCtx = {
    ...ctx,
    getDb: ctx.getDb ?? makeGetDb(ctx.persistDir ?? ".state"),
    notify: ctx.notify ?? ((msg: string) => ctx.log(`[compliance-check:notify] ${msg}`)),
    emit: ctx.emit ?? ((_event: unknown) => { /* no-op when runtime doesn't provide emit */ }),
    triggerNow: ctx.triggerNow ?? ((_name: string) => { /* no-op */ }),
  } as HandlerContext;

  const runConventionCheck = createConventionCheck(augmentedCtx, entry);
  const runStandingOrdersCheck = createStandingOrdersCheck(augmentedCtx, entry);

  return async () => {
    ctx.log("[compliance-check] Starting combined compliance run");

    // Run guard smoke tests to verify guards are functional
    try {
      runGuardSmokeTests(ctx);
    } catch (err) {
      ctx.log(`[compliance-check] guard smoke tests failed: ${err}`);
    }

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
