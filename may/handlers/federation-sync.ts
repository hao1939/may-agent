/**
 * federation-sync — High-frequency bidirectional sync for federated instances.
 *
 * Runs every 10 minutes. Does:
 * 1. git fetch from all remotes
 * 2. rebase local onto remote/main (stash if dirty)
 * 3. git push to all remotes
 *
 * This is separate from agents-auto-commit (which handles committing).
 * This handler ONLY syncs — it assumes commits are already made.
 *
 * Together with agents-auto-commit (2h) and agent self-commits,
 * this ensures both instances see each other's work within ~10 min.
 */

import { execSync, type ExecSyncOptions } from "node:child_process";
import { resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

function git(command: string, opts: ExecSyncOptions): string {
  const result = execSync(command, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
  return typeof result === "string" ? result : result?.toString("utf-8") ?? "";
}

function getRemotes(agentsDir: string): string[] {
  try {
    const out = git("git remote", { cwd: agentsDir, timeout: 5_000 }).trim();
    return out ? out.split("\n").map(r => r.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function getCurrentBranch(agentsDir: string): string {
  try {
    return git("git rev-parse --abbrev-ref HEAD", { cwd: agentsDir, timeout: 5_000 }).trim();
  } catch {
    return "main";
  }
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsDir = resolve(ctx.projectRoot, "agents");

  return async () => {
    const remotes = getRemotes(agentsDir);
    if (remotes.length === 0) {
      ctx.log("[federation-sync] no remotes configured — skipping");
      return;
    }

    const branch = getCurrentBranch(agentsDir);
    let pulled = false;
    let pushed = false;

    // Phase 1: Fetch from all remotes
    for (const remote of remotes) {
      try {
        git(`git fetch ${remote} ${branch}`, { cwd: agentsDir, timeout: 30_000 });
        ctx.log(`[federation-sync] fetched ${remote}/${branch}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
        ctx.log(`[federation-sync] fetch ${remote} failed: ${msg}`);
      }
    }

    // Phase 2: Rebase onto first remote that's ahead
    for (const remote of remotes) {
      try {
        const behind = git(
          `git rev-list --count HEAD..${remote}/${branch}`,
          { cwd: agentsDir, timeout: 5_000 }
        ).trim();

        if (behind === "0") continue;

        // Stash if dirty
        const dirty = git("git status --porcelain", { cwd: agentsDir, timeout: 5_000 }).trim();
        if (dirty) {
          git("git stash --include-untracked", { cwd: agentsDir, timeout: 10_000 });
        }

        try {
          git(`git rebase ${remote}/${branch}`, { cwd: agentsDir, timeout: 30_000 });
          ctx.log(`[federation-sync] rebased onto ${remote}/${branch} (${behind} commits)`);
          pulled = true;
        } catch {
          git("git rebase --abort", { cwd: agentsDir, timeout: 5_000 });
          // Fallback: merge instead of rebase
          try {
            git(`git merge --no-edit ${remote}/${branch}`, { cwd: agentsDir, timeout: 30_000 });
            ctx.log(`[federation-sync] merged ${remote}/${branch} (rebase failed, used merge)`);
            pulled = true;
          } catch {
            git("git merge --abort", { cwd: agentsDir, timeout: 5_000 });
            ctx.log(`[federation-sync] ⚠️ both rebase and merge failed for ${remote} — skipping`);
          }
        }

        // Pop stash
        if (dirty) {
          try {
            git("git stash pop", { cwd: agentsDir, timeout: 10_000 });
          } catch {
            // Stash conflict — keep working tree, drop stash
            git("git checkout -- .", { cwd: agentsDir, timeout: 5_000 });
            git("git stash drop", { cwd: agentsDir, timeout: 5_000 });
            ctx.log(`[federation-sync] stash pop conflict — dropped stash`);
          }
        }

        break; // Only rebase onto one remote
      } catch (err) {
        const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
        ctx.log(`[federation-sync] rebase check failed for ${remote}: ${msg}`);
      }
    }

    // Phase 3: Push to all remotes
    for (const remote of remotes) {
      try {
        const ahead = git(
          `git rev-list --count ${remote}/${branch}..HEAD`,
          { cwd: agentsDir, timeout: 5_000 }
        ).trim();

        if (ahead === "0") continue;

        git(`git push ${remote} ${branch}`, { cwd: agentsDir, timeout: 30_000 });
        ctx.log(`[federation-sync] pushed ${ahead} commit(s) to ${remote}`);
        pushed = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
        ctx.log(`[federation-sync] push ${remote} failed: ${msg}`);
      }
    }

    if (!pulled && !pushed) {
      ctx.log("[federation-sync] already in sync");
    }
  };
};
