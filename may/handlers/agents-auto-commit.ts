/**
 * agents-auto-commit — Auto-commit changes in the agents/ git sub-repo.
 *
 * Runs every 10 minutes to prevent data loss from uncommitted agent
 * config/workspace/knowledge changes. Stages all changes and commits
 * with a timestamp message.
 *
 * Exports create() conforming to HandlerModule.
 */

import { execSync } from "node:child_process";
import { resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsDir = resolve(ctx.projectRoot, "agents");

  return async () => {
    try {
      // Check for changes (tracked + untracked)
      const status = execSync("git status --porcelain", {
        cwd: agentsDir,
        encoding: "utf-8",
        timeout: 10_000,
      }).trim();

      if (!status) {
        // Nothing to commit
        return;
      }

      // Stage all changes
      execSync("git add -A", {
        cwd: agentsDir,
        timeout: 10_000,
      });

      // Build commit message with timestamp
      const timestamp = new Date().toISOString().replace(/T/, " ").replace(/\.\d+Z$/, " UTC");
      const diffStat = execSync("git diff --cached --stat", {
        cwd: agentsDir,
        encoding: "utf-8",
        timeout: 10_000,
      }).trim();

      const lastLine = diffStat.split("\n").pop() ?? "changes";

      execSync(
        `git commit -m "auto: ${lastLine}" -m "Timestamp: ${timestamp}" --no-verify`,
        {
          cwd: agentsDir,
          timeout: 15_000,
        },
      );

      ctx.log(`[agents-auto-commit] Committed: ${lastLine}`);
    } catch (err) {
      // git commit exits non-zero if nothing to commit (after add -A with only ignored files)
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("nothing to commit")) {
        ctx.log(`[agents-auto-commit] ⚠️ ${msg}`);
      }
    }
  };
};
