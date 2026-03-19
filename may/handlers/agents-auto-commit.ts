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

// ── Factory ───────────────────────────────────────────────────────────

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

      if (!status) return;

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
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("nothing to commit")) {
        ctx.log(`[agents-auto-commit] ⚠️ ${msg}`);
      }
    }
  };
};
