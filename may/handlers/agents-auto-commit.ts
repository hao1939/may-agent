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
 *
 * Exports create() conforming to HandlerModule.
 */

import { execSync } from "node:child_process";
import { resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

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

// ── Sync helper ───────────────────────────────────────────────────────

/**
 * Pull from the sync remote before committing. This picks up any changes
 * pushed from the local dev machine (via the host bare repo → sync bare repo
 * chain). Uses rebase to keep the commit history linear.
 *
 * Best-effort — if no remote, no connectivity, or conflicts, we log and
 * continue with the commit. The worst case is a diverged local branch that
 * the next manual merge will fix.
 */
function trySyncPull(agentsDir: string, log: (msg: string) => void): void {
  try {
    const remotes = execSync("git remote", {
      cwd: agentsDir,
      encoding: "utf-8",
      timeout: 5_000,
    }).trim();

    if (!remotes) return;

    const remote = remotes.split("\n")[0]!;
    // Fetch first, then check if there's anything new
    execSync(`git fetch ${remote} main`, {
      cwd: agentsDir,
      timeout: 15_000,
      encoding: "utf-8",
    });

    // Check if remote is ahead
    const behind = execSync(`git rev-list --count HEAD..${remote}/main`, {
      cwd: agentsDir,
      encoding: "utf-8",
      timeout: 5_000,
    }).trim();

    if (behind === "0") return; // Already up to date

    // Stash any uncommitted changes, rebase, then pop
    const hasChanges = execSync("git status --porcelain", {
      cwd: agentsDir,
      encoding: "utf-8",
      timeout: 5_000,
    }).trim();

    if (hasChanges) {
      execSync("git stash --include-untracked", { cwd: agentsDir, timeout: 10_000 });
    }

    try {
      execSync(`git rebase ${remote}/main`, {
        cwd: agentsDir,
        timeout: 30_000,
        encoding: "utf-8",
      });
      log(`[agents-auto-commit] pulled ${behind} commit(s) from ${remote}`);
    } catch {
      // Rebase conflict — abort and continue without the pull
      execSync("git rebase --abort", { cwd: agentsDir, timeout: 5_000 });
      log(`[agents-auto-commit] ⚠️ rebase conflict during pull — skipped`);
    }

    if (hasChanges) {
      execSync("git stash pop", { cwd: agentsDir, timeout: 10_000 }).toString();
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`[agents-auto-commit] pull failed (non-fatal): ${errMsg.split("\n")[0]}`);
  }
}

// ── Push helper ───────────────────────────────────────────────────────

/**
 * Try to push to any configured remote. Best-effort — if no remote exists
 * or the push fails (no SSH key, network down, etc.), we log and move on.
 * The commit is still local, which is better than losing the data entirely.
 */
function tryPush(agentsDir: string, log: (msg: string) => void): void {
  try {
    // List remotes — pick the first one available
    const remotes = execSync("git remote", {
      cwd: agentsDir,
      encoding: "utf-8",
      timeout: 5_000,
    }).trim();

    if (!remotes) return; // No remotes configured — nothing to push to

    const remote = remotes.split("\n")[0]!;
    execSync(`git push ${remote} main`, {
      cwd: agentsDir,
      timeout: 30_000,
      encoding: "utf-8",
    });
    log(`[agents-auto-commit] pushed to ${remote}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // Don't spam logs for expected cases (no remote, no SSH key, etc.)
    if (!errMsg.includes("No configured push destination") &&
        !errMsg.includes("Could not read from remote")) {
      log(`[agents-auto-commit] push failed (non-fatal): ${errMsg.split("\n")[0]}`);
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsDir = resolve(ctx.projectRoot, "agents");

  return async () => {
    let committed = false;

    // Pull any changes pushed from other instances (local dev, other pods)
    trySyncPull(agentsDir, ctx.log);

    try {
      // Check for changes (tracked + untracked)
      const status = execSync("git status --porcelain", {
        cwd: agentsDir,
        encoding: "utf-8",
        timeout: 10_000,
      }).trim();

      if (!status) {
        // Nothing to commit — still try to push in case previous commits
        // were committed but never pushed (e.g. push failed last time).
        tryPush(agentsDir, ctx.log);
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
              execSync(`git add -- "${file}"`, {
                cwd: agentsDir,
                timeout: 5_000,
              });
            }

            // Check if anything was actually staged
            const staged = execSync("git diff --cached --name-only", {
              cwd: agentsDir,
              encoding: "utf-8",
              timeout: 5_000,
            }).trim();

            if (!staged) continue;

            const msg = buildCommitMessage([group]);
            execSync(
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
        execSync("git add -A", {
          cwd: agentsDir,
          timeout: 10_000,
        });

        const msg = buildCommitMessage(groups);
        execSync(
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

    // Push after committing (or if there were unpushed commits from last run)
    if (committed) {
      tryPush(agentsDir, ctx.log);
    }
  };
};
