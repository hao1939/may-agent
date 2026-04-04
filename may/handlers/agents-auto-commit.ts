/**
 * agents-auto-commit — Safety-net auto-commit for the agents/ git sub-repo.
 *
 * Agents are expected to commit their own work (C13.1 in common-sense.md).
 * Smart agents (Scout, optimizer) already do this well. This handler is
 * the safety net for agents that don't — it runs every 2h and commits
 * any orphaned uncommitted changes with descriptive messages.
 *
 * Unlike the old dumb handler (which ran every 10min and produced garbage
 * like "auto: 5 files changed, 791 insertions(+)"), this one:
 * - Groups changes by agent directory
 * - Classifies file types (workspace, knowledge, config, code, skills)
 * - Produces messages like "bob: workspace updates | coach: new skill"
 * - Commits per-agent when possible for cleaner history
 * - Pulls from and pushes to the first configured git remote (if any)
 *
 * Exports create() conforming to HandlerModule.
 */

import { execSync, type ExecSyncOptions } from "node:child_process";
import { resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

/**
 * execSync wrapper that detaches stdin. Prevents SSH/git prompts from
 * sending SIGTTIN to the process group (which freezes everything under supervisord).
 */
function git(command: string, opts: ExecSyncOptions): string {
  const result = execSync(command, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
  return typeof result === "string" ? result : result?.toString("utf-8") ?? "";
}

// ── File classification ───────────────────────────────────────────────

function classifyFile(path: string): string {
  if (path.includes("/workspace/archive/")) return "archive";
  if (path.includes("/workspace/")) return "workspace";
  if (path.includes("/knowledge/library/")) return "knowledge";
  if (path.includes("/knowledge/")) return "knowledge";
  if (path.includes("/skills/")) return "skills";
  if (path.includes("/workflows/")) return "code";
  if (path.includes("/handlers/")) return "code";
  if (path.endsWith("/heartbeat.md")) return "config";
  if (path.endsWith("/SOUL.md")) return "config";
  if (path.endsWith("/TOOLS.md")) return "config";
  if (path.endsWith("/DOMAIN.md")) return "config";
  if (path.endsWith("/agent.json")) return "config";
  if (path.endsWith("/cron.json")) return "config";
  if (path.endsWith("/LESSONS.md")) return "knowledge";
  if (path.endsWith("/CONVENTIONS.md")) return "docs";
  if (path.includes("gym/scenarios/")) return "gym";
  if (path.includes("may-agent-docs/")) return "docs";
  if (path.endsWith(".ts") || path.endsWith(".js")) return "code";
  if (path.endsWith(".md")) return "docs";
  return "other";
}

function describeCategory(category: string, count: number): string {
  switch (category) {
    case "workspace": return count === 1 ? "workspace update" : "workspace updates";
    case "knowledge": return count === 1 ? "knowledge update" : "knowledge updates";
    case "skills": return count === 1 ? "skill update" : "skill updates";
    case "code": return count === 1 ? "code change" : "code changes";
    case "config": return count === 1 ? "config change" : "config changes";
    case "gym": return count === 1 ? "gym scenario" : "gym scenarios";
    case "docs": return count === 1 ? "doc update" : "doc updates";
    case "archive": return "archive";
    default: return count === 1 ? "update" : "updates";
  }
}

// ── Message building ──────────────────────────────────────────────────

interface AgentChanges {
  agent: string;
  files: string[];
  categories: Map<string, number>;
}

function buildCommitMessage(changes: AgentChanges[]): string {
  const parts: string[] = [];

  for (const ac of changes) {
    // Sort categories by count descending, take top 2
    const sorted = [...ac.categories.entries()].sort((a, b) => b[1] - a[1]);
    const descs = sorted.slice(0, 2).map(([cat, cnt]) => describeCategory(cat, cnt));

    // For single-file changes, be specific
    if (ac.files.length === 1) {
      const filename = ac.files[0].split("/").pop() ?? ac.files[0];
      parts.push(`${ac.agent}: update ${filename}`);
    } else {
      parts.push(`${ac.agent}: ${descs.join(", ")}`);
    }
  }

  let msg = parts.join(" | ");

  // Git commit messages should be under ~72 chars for the first line
  // If too long, summarize
  if (msg.length > 120) {
    const agentNames = changes.map(c => c.agent).join(", ");
    const totalFiles = changes.reduce((s, c) => s + c.files.length, 0);
    msg = `${agentNames}: ${totalFiles} uncommitted files`;
  }

  return msg;
}

function groupByAgent(files: string[]): AgentChanges[] {
  const agentMap = new Map<string, AgentChanges>();

  for (const file of files) {
    const parts = file.split("/");
    // First directory is the agent name (bob/, coach/, shared/, may/, gym/)
    const agent = parts[0] || "root";
    const category = classifyFile(file);

    let ac = agentMap.get(agent);
    if (!ac) {
      ac = { agent, files: [], categories: new Map() };
      agentMap.set(agent, ac);
    }
    ac.files.push(file);
    ac.categories.set(category, (ac.categories.get(category) ?? 0) + 1);
  }

  // Sort by file count descending
  return [...agentMap.values()].sort((a, b) => b.files.length - a.files.length);
}

// ── Git remote helpers ────────────────────────────────────────────────

/** Returns the name of the first configured remote, or null. */
function getRemote(agentsDir: string): string | null {
  try {
    const out = git("git remote", {
      cwd: agentsDir,
      timeout: 5_000,
    }).trim();
    return out ? out.split("\n")[0]! : null;
  } catch {
    return null;
  }
}

/**
 * Pull from remote before committing. Picks up changes pushed from other
 * instances (e.g. local dev machine). Uses stash + rebase to stay linear.
 * Best-effort — failures are logged but don't block the commit.
 */
function tryPull(agentsDir: string, remote: string, log: (msg: string) => void): void {
  try {
    git(`git fetch ${remote} main`, {
      cwd: agentsDir,
      timeout: 15_000,
    });

    const behind = git(`git rev-list --count HEAD..${remote}/main`, {
      cwd: agentsDir,
      timeout: 5_000,
    }).trim();

    if (behind === "0") return;

    const hasChanges = git("git status --porcelain", {
      cwd: agentsDir,
      timeout: 5_000,
    }).trim();

    if (hasChanges) {
      git("git stash --include-untracked", { cwd: agentsDir, timeout: 10_000 });
    }

    try {
      git(`git rebase ${remote}/main`, {
        cwd: agentsDir,
        timeout: 30_000,
      });
      log(`[agents-auto-commit] pulled ${behind} commit(s) from ${remote}`);
    } catch {
      git("git rebase --abort", { cwd: agentsDir, timeout: 5_000 });
      log(`[agents-auto-commit] rebase conflict during pull — skipped`);
    }

    if (hasChanges) {
      try {
        git("git stash pop", { cwd: agentsDir, timeout: 10_000 });
      } catch {
        // Stash pop conflict — drop it, the files are already on disk
        git("git checkout -- .", { cwd: agentsDir, timeout: 5_000 });
        git("git stash drop", { cwd: agentsDir, timeout: 5_000 });
        log(`[agents-auto-commit] stash pop conflict — dropped stash`);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`[agents-auto-commit] pull failed (non-fatal): ${errMsg.split("\n")[0]}`);
  }
}

/**
 * Push local commits to remote. Best-effort — if the push fails, the
 * commits are still local and will be pushed next run.
 */
function tryPush(agentsDir: string, remote: string, log: (msg: string) => void): void {
  try {
    git(`git push ${remote} main`, {
      cwd: agentsDir,
      timeout: 30_000,
    });
    log(`[agents-auto-commit] pushed to ${remote}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`[agents-auto-commit] push failed (non-fatal): ${errMsg.split("\n")[0]}`);
  }
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsDir = resolve(ctx.projectRoot, "agents");

  return async () => {
    const remote = getRemote(agentsDir);
    let committed = false;

    // Pull from remote to pick up changes from other instances
    if (remote) tryPull(agentsDir, remote, ctx.log);

    try {
      // Check for changes (tracked + untracked)
      const status = git("git status --porcelain", {
        cwd: agentsDir,
        timeout: 10_000,
      }).trim();

      if (!status) {
        // Nothing to commit — still push in case previous commits are unpushed
        if (remote) tryPush(agentsDir, remote, ctx.log);
        return;
      }

      // Parse changed files from porcelain output
      const changedFiles = status
        .split("\n")
        .map(line => line.slice(3).trim()) // Remove status prefix (e.g., " M ", "?? ")
        .filter(f => f && !f.endsWith(".bak")); // Skip .bak files

      if (changedFiles.length === 0) return;

      // Group by agent
      const groups = groupByAgent(changedFiles);

      // If changes span ≤2 agents, commit per-agent for cleaner history
      // If more, batch into one commit (avoid 10 tiny commits)
      if (groups.length <= 2) {
        for (const group of groups) {
          try {
            // Stage only this agent's files
            for (const file of group.files) {
              git(`git add -- "${file}"`, {
                cwd: agentsDir,
                timeout: 5_000,
              });
            }

            // Check if anything was actually staged
            const staged = git("git diff --cached --name-only", {
              cwd: agentsDir,
              timeout: 5_000,
            }).trim();

            if (!staged) continue;

            const msg = buildCommitMessage([group]);
            git(
              `git commit -m "chore(auto): ${msg}" --no-verify`,
              { cwd: agentsDir, timeout: 15_000 },
            );
            ctx.log(`[agents-auto-commit] ${msg}`);
            committed = true;
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (!errMsg.includes("nothing to commit")) {
              ctx.log(`[agents-auto-commit] ⚠️ Per-agent commit failed for ${group.agent}: ${errMsg}`);
            }
          }
        }
      } else {
        // Batch commit — many agents changed
        git("git add -A", {
          cwd: agentsDir,
          timeout: 10_000,
        });

        const msg = buildCommitMessage(groups);
        git(
          `git commit -m "chore(auto): ${msg}" --no-verify`,
          { cwd: agentsDir, timeout: 15_000 },
        );
        ctx.log(`[agents-auto-commit] ${msg}`);
        committed = true;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("nothing to commit")) {
        ctx.log(`[agents-auto-commit] ⚠️ ${msg}`);
      }
    }

    // Push after committing
    if (remote && committed) {
      tryPush(agentsDir, remote, ctx.log);
    }
  };
};
