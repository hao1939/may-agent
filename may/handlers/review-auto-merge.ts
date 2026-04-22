/**
 * review-auto-merge — Auto-merge review/* branches that pass checks.
 *
 * Runs every 30 minutes. For each review/* branch:
 * 1. Checkout the branch
 * 2. Run tsc --noEmit and vitest --run
 * 3. If both pass, merge to main (fast-forward or merge commit)
 * 4. Delete the branch
 * 5. If checks fail, log the failure and leave branch for manual review
 *
 * This prevents review/* branches from accumulating after the review gate
 * forces agents to commit to them instead of main.
 *
 * Exports create() conforming to HandlerModule.
 */

import { execSync } from "node:child_process";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

const TSC_TIMEOUT_MS = 60_000;
const VITEST_TIMEOUT_MS = 120_000;

function git(cmd: string, cwd: string): string {
  return execSync(`git ${cmd}`, {
    cwd,
    timeout: 30_000,
    stdio: "pipe",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).toString().trim();
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const cwd = ctx.projectRoot;

    // Get list of review/* branches
    let branches: string[];
    try {
      const raw = git("branch --list 'review/*'", cwd);
      if (!raw) {
        ctx.log("[review-auto-merge] No review/* branches found.");
        return;
      }
      branches = raw.split("\n").map(b => b.trim().replace(/^\*\s*/, "")).filter(Boolean);
    } catch {
      ctx.log("[review-auto-merge] Failed to list branches.");
      return;
    }

    if (branches.length === 0) {
      ctx.log("[review-auto-merge] No review/* branches found.");
      return;
    }

    ctx.log(`[review-auto-merge] Found ${branches.length} review branch(es): ${branches.join(", ")}`);

    // Save current branch to restore later
    let originalBranch: string;
    try {
      originalBranch = git("symbolic-ref --short HEAD", cwd);
    } catch {
      originalBranch = "main";
    }

    // Stash any uncommitted changes
    let stashed = false;
    try {
      const status = git("status --porcelain", cwd);
      if (status) {
        git("stash push -m 'review-auto-merge: temp stash'", cwd);
        stashed = true;
      }
    } catch {
      // ignore
    }

    let merged = 0;
    let failed = 0;

    for (const branch of branches) {
      try {
        ctx.log(`[review-auto-merge] Checking ${branch}...`);

        // Checkout the branch
        git(`checkout ${branch}`, cwd);

        // Run tsc
        let tscPass = false;
        try {
          execSync("node_modules/.bin/tsc --noEmit 2>&1", {
            cwd,
            timeout: TSC_TIMEOUT_MS,
            stdio: "pipe",
          });
          tscPass = true;
        } catch (err: any) {
          const output = (err.stdout?.toString() || "").slice(0, 500);
          ctx.log(`[review-auto-merge] ❌ ${branch}: tsc FAILED\n${output}`);
        }

        if (!tscPass) {
          failed++;
          continue;
        }

        // Run vitest
        let vitestPass = false;
        try {
          execSync("node_modules/.bin/vitest --run 2>&1", {
            cwd,
            timeout: VITEST_TIMEOUT_MS,
            stdio: "pipe",
          });
          vitestPass = true;
        } catch (err: any) {
          const output = (err.stdout?.toString() || "").slice(0, 500);
          ctx.log(`[review-auto-merge] ❌ ${branch}: vitest FAILED\n${output}`);
        }

        if (!vitestPass) {
          failed++;
          continue;
        }

        // Both checks pass — merge to main
        ctx.log(`[review-auto-merge] ✅ ${branch}: checks pass. Merging to main...`);
        git("checkout main", cwd);

        // Try fast-forward first, fall back to merge commit
        try {
          git(`merge --ff-only ${branch}`, cwd);
        } catch {
          git(`merge --no-edit ${branch}`, cwd);
        }

        // Delete the branch
        git(`branch -d ${branch}`, cwd);
        merged++;
        ctx.log(`[review-auto-merge] ✅ ${branch}: merged and deleted.`);

      } catch (err: any) {
        ctx.log(`[review-auto-merge] ⚠️ Error processing ${branch}: ${err.message?.slice(0, 200)}`);
        failed++;
        // Try to get back to a clean state
        try { git("merge --abort", cwd); } catch { /* ignore */ }
        try { git("checkout main", cwd); } catch { /* ignore */ }
      }
    }

    // Restore original branch
    try {
      git(`checkout ${originalBranch}`, cwd);
    } catch {
      try { git("checkout main", cwd); } catch { /* ignore */ }
    }

    // Restore stash
    if (stashed) {
      try { git("stash pop", cwd); } catch { /* ignore */ }
    }

    ctx.log(`[review-auto-merge] Done. Merged: ${merged}, Failed: ${failed}, Remaining: ${branches.length - merged}`);
  };
};
