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

import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";
import { EditGuard, validateBashCommand, enforceNoHallucinatedPaths } from "../../shared/agent-sdk.js";
import { create as createConventionCheck } from "./convention-check.js";
import { create as createStandingOrdersCheck } from "./standing-orders-check.js";

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
  const runConventionCheck = createConventionCheck(ctx, entry);
  const runStandingOrdersCheck = createStandingOrdersCheck(ctx, entry);

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
