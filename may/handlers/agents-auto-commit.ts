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
import { resolve, join } from "node:path";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync, copyFileSync, renameSync } from "node:fs";
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

// ── Instance config (federation file ownership) ──────────────────────

interface InstanceConfig {
  local: { agents: string[] };
  k3s: { agents: string[] };
}

/** Default ownership when no config file exists. */
const DEFAULT_CONFIG: InstanceConfig = {
  local: { agents: ["may", "bob", "tech-lead", "coder", "optimizer", "qa", "evaluator"] },
  k3s: { agents: ["scout", "coach", "amy", "amy-kimi"] },
};

/**
 * Load instance config from agents/shared/federation/instance-config.json.
 * Falls back to hardcoded defaults if the file doesn't exist.
 */
function loadInstanceConfig(agentsDir: string): InstanceConfig {
  const configPath = join(agentsDir, "shared", "federation", "instance-config.json");
  try {
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, "utf-8")) as InstanceConfig;
    }
  } catch {
    // Malformed config — fall back to defaults
  }
  return DEFAULT_CONFIG;
}

/**
 * Determine which instance this is by checking which agents exist locally
 * in cron.json files (agents that are actively scheduled here).
 */
function detectInstance(agentsDir: string, config: InstanceConfig): "local" | "k3s" | "unknown" {
  // Check which instance's agents have cron.json files here
  let localScore = 0;
  let k3sScore = 0;

  for (const agent of config.local.agents) {
    if (existsSync(join(agentsDir, agent, "cron.json"))) localScore++;
  }
  for (const agent of config.k3s.agents) {
    if (existsSync(join(agentsDir, agent, "cron.json"))) k3sScore++;
  }

  // The instance that owns MORE of its expected agents is likely where we're running
  if (localScore > k3sScore) return "local";
  if (k3sScore > localScore) return "k3s";
  return "unknown";
}

/**
 * Determine the owning instance for a file path.
 * Returns "local", "k3s", or "shared" (jointly owned).
 */
function getFileOwner(filePath: string, config: InstanceConfig): "local" | "k3s" | "shared" {
  const topDir = filePath.split("/")[0];
  if (!topDir) return "shared";

  // Check if top directory is an agent name owned by an instance
  if (config.local.agents.includes(topDir)) return "local";
  if (config.k3s.agents.includes(topDir)) return "k3s";

  // shared/, gym/, scripts/, etc. are jointly owned
  return "shared";
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
  // Build per-agent detail lines (used for both single-line and multi-line)
  const perAgent: string[] = [];

  for (const ac of changes) {
    const sorted = [...ac.categories.entries()].sort((a, b) => b[1] - a[1]);
    const descs = sorted.slice(0, 2).map(([cat, cnt]) => describeCategory(cat, cnt));

    if (ac.files.length === 1) {
      const filename = ac.files[0].split("/").pop() ?? ac.files[0];
      perAgent.push(`${ac.agent}: update ${filename}`);
    } else {
      perAgent.push(`${ac.agent}: ${descs.join(", ")}`);
    }
  }

  // Try single-line first (ideal for ≤2 agents)
  const oneLine = perAgent.join(" | ");
  if (oneLine.length <= 120) return oneLine;

  // Multi-line: summary first line + per-agent body
  // Build a summary from top categories across ALL agents
  const globalCats = new Map<string, number>();
  for (const ac of changes) {
    for (const [cat, cnt] of ac.categories) {
      globalCats.set(cat, (globalCats.get(cat) ?? 0) + cnt);
    }
  }
  const topCats = [...globalCats.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, cnt]) => describeCategory(cat, cnt));

  const totalFiles = changes.reduce((s, c) => s + c.files.length, 0);
  const agentNames = changes.map(c => c.agent);

  // First line: concise summary (under 72 chars ideally)
  let subject = `${agentNames.length} agents, ${totalFiles} files: ${topCats.join(", ")}`;
  if (subject.length > 72) {
    subject = `${agentNames.length} agents, ${totalFiles} files: ${topCats[0]}`;
  }

  // Body: per-agent breakdown
  const body = perAgent.map(line => `- ${line}`).join("\n");

  return `${subject}\n\n${body}`;
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

/** Commit with a message that may contain newlines. Uses a temp file to avoid shell escaping. */
function gitCommit(agentsDir: string, message: string): void {
  const msgFile = join(agentsDir, ".git", "AUTOCOMMIT_MSG");
  try {
    writeFileSync(msgFile, `chore(auto): ${message}`, "utf-8");
    git(`git commit -F "${msgFile}" --no-verify`, { cwd: agentsDir, timeout: 15_000 });
  } finally {
    try { unlinkSync(msgFile); } catch {}
  }
}

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
 * Pull from remote. Commit any local changes first (including untracked)
 * to avoid conflicts with incoming files, then rebase onto remote.
 * Best-effort — failures are logged but don't block.
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

    // Commit everything first — prevents untracked file conflicts during rebase
    const hasChanges = git("git status --porcelain", {
      cwd: agentsDir,
      timeout: 5_000,
    }).trim();

    if (hasChanges) {
      git("git add -A", { cwd: agentsDir, timeout: 10_000 });
      try {
        git('git commit -m "chore(auto): commit before sync" --no-verify', {
          cwd: agentsDir,
          timeout: 15_000,
        });
      } catch {
        // nothing to commit
      }
    }

    // Rebase onto remote — keeps history linear
    try {
      git(`git rebase ${remote}/main`, {
        cwd: agentsDir,
        timeout: 30_000,
      });
      log(`[agents-auto-commit] rebased onto ${remote} (${behind} commits)`);
    } catch {
      // Rebase conflict — abort and fall back to merge
      try { git("git rebase --abort", { cwd: agentsDir, timeout: 5_000 }); } catch {}
      try {
        git(`git merge -X ours ${remote}/main --no-edit`, { cwd: agentsDir, timeout: 30_000 });
        log(`[agents-auto-commit] rebase conflict, fell back to merge`);
      } catch {
        try { git("git merge --abort", { cwd: agentsDir, timeout: 5_000 }); } catch {}
        log(`[agents-auto-commit] sync failed — will retry next cycle`);
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

    // Load federation config for ownership-aware conflict resolution
    const config = loadInstanceConfig(agentsDir);
    const instanceId = detectInstance(agentsDir, config);

    // Pull from remote to pick up changes from other instances
    if (remote) tryPull(agentsDir, remote, ctx.log, instanceId, config);

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
            gitCommit(agentsDir, msg);
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
        gitCommit(agentsDir, msg);
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
