/**
 * agents-auto-commit — Commit and sync the agents/ git repo.
 *
 * Runs every 10 minutes:
 * 1. Commit any uncommitted changes
 * 2. Fetch + rebase onto remote (fallback: merge)
 * 3. Push to remote
 */

import { execSync, type ExecSyncOptions } from "node:child_process";
import { resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

function git(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 })
    ?.toString("utf-8") ?? "";
}

function getRemote(cwd: string): string | null {
  try {
    const out = git("git remote", cwd).trim();
    return out ? out.split("\n")[0]! : null;
  } catch { return null; }
}

function tryCommit(cwd: string, log: (msg: string) => void): boolean {
  try {
    if (!git("git status --porcelain", cwd).trim()) return false;
    git("git add -A", cwd);
    const stat = git("git diff --cached --stat", cwd).trim().split("\n").pop() ?? "";
    git(`git commit -m "chore(auto): ${stat}" --no-verify`, cwd);
    log(`[sync] committed: ${stat}`);
    return true;
  } catch { return false; }
}

function tryPull(cwd: string, remote: string, log: (msg: string) => void): void {
  try {
    git(`git fetch ${remote} main`, cwd);
    const behind = git(`git rev-list --count HEAD..${remote}/main`, cwd).trim();
    if (behind === "0") return;

    try {
      git(`git rebase ${remote}/main`, cwd);
      log(`[sync] rebased ${behind} commit(s) from ${remote}`);
    } catch {
      try { git("git rebase --abort", cwd); } catch {}
      try {
        git(`git merge -X ours ${remote}/main --no-edit`, cwd);
        log(`[sync] rebase conflict, merged instead`);
      } catch {
        try { git("git merge --abort", cwd); } catch {}
        log(`[sync] pull failed — will retry`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
    log(`[sync] fetch failed: ${msg}`);
  }
}

function tryPush(cwd: string, remote: string, log: (msg: string) => void): void {
  try {
    const ahead = git(`git rev-list --count ${remote}/main..HEAD`, cwd).trim();
    if (ahead === "0") return;
    git(`git push ${remote} main`, cwd);
    log(`[sync] pushed ${ahead} commit(s) to ${remote}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
    log(`[sync] push failed: ${msg}`);
  }
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const cwd = resolve(ctx.projectRoot, "agents");
  return async () => {
    const remote = getRemote(cwd);
    if (remote) tryPull(cwd, remote, ctx.log);
    tryCommit(cwd, ctx.log);
    if (remote) tryPush(cwd, remote, ctx.log);
  };
};
