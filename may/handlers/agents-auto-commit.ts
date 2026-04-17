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
 * Pull from remote with ownership-aware conflict resolution.
 *
 * Strategy:
 * 1. Commit all local changes (including untracked) BEFORE pull
 * 2. Fetch + rebase onto remote/main
 * 3. On conflict:
 *    - Files in OUR agent dirs → keep ours
 *    - Files in THEIR agent dirs → keep theirs
 *    - Files in shared/ → attempt auto-merge; if fails → keep both (rename conflict file)
 * 4. If rebase still fails after resolution → abort, try merge with same strategy
 * 5. If all else fails → abort, log error, don't lose data, retry next cycle
 *
 * NEVER uses `-X ours` on shared files (that's how data loss happened before).
 */
function tryPull(
  agentsDir: string,
  remote: string,
  log: (msg: string) => void,
  instanceId: "local" | "k3s" | "unknown",
  config: InstanceConfig,
): void {
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
      // SAFETY: Abort if mass deletions detected
      const delCount = hasChanges.split("\n").filter(l => l.trimStart().startsWith("D")).length;
      if (delCount > 50) {
        log(`[agents-auto-commit] ⚠️ ABORT pre-sync commit: ${delCount} deletions detected`);
        return;
      }
      git("git add -A", { cwd: agentsDir, timeout: 10_000 });
      try {
        git('git commit -m "chore(auto): commit before sync" --no-verify', {
          cwd: agentsDir,
          timeout: 15_000,
        });
      } catch {
        // nothing to commit (all changes already committed)
      }
    }

    // Try rebase onto remote — keeps history linear
    try {
      git(`git rebase ${remote}/main`, {
        cwd: agentsDir,
        timeout: 30_000,
      });
      log(`[agents-auto-commit] rebased onto ${remote} (${behind} commits)`);
    } catch {
      // Rebase conflict — try ownership-aware resolution
      const resolved = resolveConflicts(agentsDir, instanceId, config, log);

      if (resolved) {
        log(`[agents-auto-commit] rebased with ownership-aware conflict resolution`);
      } else {
        // Rebase couldn't be resolved — abort and try merge
        try { git("git rebase --abort", { cwd: agentsDir, timeout: 5_000 }); } catch {}

        try {
          git(`git merge ${remote}/main --no-edit --no-ff`, { cwd: agentsDir, timeout: 30_000 });
          log(`[agents-auto-commit] rebase failed, merged instead`);
        } catch {
          // Merge also has conflicts — try ownership-aware resolution on merge
          const mergeResolved = resolveConflicts(agentsDir, instanceId, config, log);
          if (mergeResolved) {
            log(`[agents-auto-commit] merged with ownership-aware conflict resolution`);
          } else {
            // Give up — abort merge, don't lose data, retry next cycle
            try { git("git merge --abort", { cwd: agentsDir, timeout: 5_000 }); } catch {}
            log(`[agents-auto-commit] ⚠️ sync failed — conflicts unresolvable, will retry next cycle`);
          }
        }
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`[agents-auto-commit] pull failed (non-fatal): ${errMsg.split("\n")[0]}`);
  }
}

/**
 * Resolve git conflicts using file ownership rules.
 *
 * For each conflicted file:
 * - If it's in our agent directory → keep ours (we're the owner)
 * - If it's in their agent directory → keep theirs (they're the owner)
 * - If it's in shared/ → try auto-merge; if fails → keep both versions
 *
 * Returns true if all conflicts were resolved, false if resolution failed.
 */
function resolveConflicts(
  agentsDir: string,
  instanceId: "local" | "k3s" | "unknown",
  config: InstanceConfig,
  log: (msg: string) => void,
  depth: number = 0,
): boolean {
  // Guard: unknown instance can't do ownership-based resolution (would drop all local files)
  if (instanceId === "unknown") {
    log("[agents-auto-commit] ⚠️ unknown instance — skipping ownership resolution");
    return false;
  }

  // Guard: prevent unbounded recursion during multi-commit rebase
  if (depth > 50) {
    log("[agents-auto-commit] ⚠️ conflict resolution exceeded max depth (50)");
    return false;
  }

  try {
    // Get list of conflicted files
    const conflictOutput = git("git diff --name-only --diff-filter=U", {
      cwd: agentsDir,
      timeout: 5_000,
    }).trim();

    if (!conflictOutput) {
      // No conflicts (maybe the rebase failed for another reason)
      return false;
    }

    const conflictedFiles = conflictOutput.split("\n").filter(f => f.trim());
    let allResolved = true;

    for (const file of conflictedFiles) {
      const owner = getFileOwner(file, config);

      if (owner === instanceId) {
        // We own this file — keep ours
        git(`git checkout --ours -- "${file}"`, { cwd: agentsDir, timeout: 5_000 });
        git(`git add -- "${file}"`, { cwd: agentsDir, timeout: 5_000 });
        log(`[agents-auto-commit] conflict: ${file} → kept ours (owned)`);
      } else if (owner !== "shared") {
        // They own this file — keep theirs
        git(`git checkout --theirs -- "${file}"`, { cwd: agentsDir, timeout: 5_000 });
        git(`git add -- "${file}"`, { cwd: agentsDir, timeout: 5_000 });
        log(`[agents-auto-commit] conflict: ${file} → kept theirs (their dir)`);
      } else {
        // Shared file — try to keep both versions
        const resolved = resolveSharedConflict(agentsDir, file, instanceId, log);
        if (!resolved) {
          allResolved = false;
        }
      }
    }

    if (!allResolved) return false;

    // Try to continue the rebase/merge
    try {
      // Check if we're in a rebase
      const rebaseDir = join(agentsDir, ".git", "rebase-merge");
      const rebaseApplyDir = join(agentsDir, ".git", "rebase-apply");
      if (existsSync(rebaseDir) || existsSync(rebaseApplyDir)) {
        git("git rebase --continue", { cwd: agentsDir, timeout: 30_000 });
      } else {
        // We're in a merge — commit the resolution
        git('git commit --no-edit --no-verify', { cwd: agentsDir, timeout: 15_000 });
      }
      return true;
    } catch {
      // Continuing failed (maybe more conflicts in subsequent rebase steps)
      // Try resolving again recursively (rebase may have multiple steps)
      try {
        const moreConflicts = git("git diff --name-only --diff-filter=U", {
          cwd: agentsDir,
          timeout: 5_000,
        }).trim();
        if (moreConflicts) {
          return resolveConflicts(agentsDir, instanceId, config, log, depth + 1);
        }
      } catch {}
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Resolve a conflict in a shared file (agents/shared/ or agents/gym/ etc).
 *
 * Strategy:
 * - Try git's built-in merge (it may auto-resolve after --ours/--theirs on other files)
 * - If still conflicted: keep BOTH versions (ours + rename conflict copy)
 * - Never silently discard either side
 *
 * Returns true if resolved, false if not.
 */
function resolveSharedConflict(
  agentsDir: string,
  file: string,
  instanceId: string,
  log: (msg: string) => void,
): boolean {
  try {
    const absFile = join(agentsDir, file);

    // Try to get both versions
    let oursContent: string | null = null;
    let theirsContent: string | null = null;

    try {
      oursContent = git(`git show :2:"${file}"`, { cwd: agentsDir, timeout: 5_000 });
    } catch {}
    try {
      theirsContent = git(`git show :3:"${file}"`, { cwd: agentsDir, timeout: 5_000 });
    } catch {}

    if (oursContent === null && theirsContent === null) {
      // Can't get either version — can't resolve
      return false;
    }

    if (oursContent !== null && theirsContent !== null) {
      // Both versions exist — check if they're identical
      if (oursContent === theirsContent) {
        writeFileSync(absFile, oursContent, "utf-8");
        git(`git add -- "${file}"`, { cwd: agentsDir, timeout: 5_000 });
        log(`[agents-auto-commit] conflict: ${file} → identical content, resolved`);
        return true;
      }

      // For append-only files (.jsonl, INDEX.md, bulletin.md), try concatenation
      if (isAppendOnlyFile(file)) {
        // Attempt to get the base version for a smarter merge
        let baseContent = "";
        try {
          baseContent = git(`git show :1:"${file}"`, { cwd: agentsDir, timeout: 5_000 });
        } catch {}

        const merged = mergeAppendOnly(baseContent, oursContent, theirsContent);
        writeFileSync(absFile, merged, "utf-8");
        git(`git add -- "${file}"`, { cwd: agentsDir, timeout: 5_000 });
        log(`[agents-auto-commit] conflict: ${file} → append-only merge`);
        return true;
      }

      // Non-append-only shared file: keep ours as the main file, save theirs as .conflict-{instance}
      const otherInstance = instanceId === "local" ? "k3s" : "local";
      const conflictPath = `${file}.conflict-${otherInstance}`;
      const absConflictPath = join(agentsDir, conflictPath);

      // Ensure parent directory exists
      const parentDir = resolve(absConflictPath, "..");
      if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });

      writeFileSync(absFile, oursContent, "utf-8");
      writeFileSync(absConflictPath, theirsContent, "utf-8");
      git(`git add -- "${file}" "${conflictPath}"`, { cwd: agentsDir, timeout: 5_000 });
      log(`[agents-auto-commit] ⚠️ conflict: ${file} → kept both versions (${conflictPath} created)`);
      return true;
    }

    // Only one version exists — use whatever we have
    const content = oursContent ?? theirsContent!;
    writeFileSync(absFile, content, "utf-8");
    git(`git add -- "${file}"`, { cwd: agentsDir, timeout: 5_000 });
    log(`[agents-auto-commit] conflict: ${file} → used available version`);
    return true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`[agents-auto-commit] ⚠️ failed to resolve shared conflict: ${file}: ${errMsg.split("\n")[0]}`);
    return false;
  }
}

/**
 * Check if a file uses append-only protocol (safe to concatenate on conflict).
 */
function isAppendOnlyFile(filePath: string): boolean {
  return (
    filePath.endsWith(".jsonl") ||
    filePath.endsWith("bulletin.md") ||
    filePath.endsWith("INDEX.md") ||
    filePath.includes("federation/claims") ||
    filePath.includes("federation/notifications")
  );
}

/**
 * Merge two versions of an append-only file.
 * Uses base content to find the new lines in each version,
 * then combines them (base + ours_new + theirs_new).
 */
function mergeAppendOnly(base: string, ours: string, theirs: string): string {
  const baseLines = new Set(base.split("\n").map(l => l.trim()).filter(Boolean));

  // Find lines added by each side (not in base)
  const oursNew = ours.split("\n").filter(l => l.trim() && !baseLines.has(l.trim()));
  const theirsNew = theirs.split("\n").filter(l => l.trim() && !baseLines.has(l.trim()));

  // Deduplicate: don't include lines from theirs that ours already added
  const oursNewSet = new Set(oursNew.map(l => l.trim()));
  const uniqueTheirsNew = theirsNew.filter(l => !oursNewSet.has(l.trim()));

  // Combine: base content + ours new + theirs new (deduplicated)
  const result = base.trimEnd();
  const additions = [...oursNew, ...uniqueTheirsNew].filter(Boolean);

  if (!result && additions.length === 0) return "";
  if (!result) return additions.join("\n") + "\n";
  if (additions.length === 0) return result + "\n";
  return result + "\n" + additions.join("\n") + "\n";
}

/**
 * Write an instance heartbeat file for federation health monitoring.
 * Each instance writes to shared/federation/heartbeats/{instanceId}.json.
 * Other instances check staleness to detect downtime.
 */
function writeInstanceHeartbeat(
  agentsDir: string,
  instanceId: "local" | "k3s" | "unknown",
  config: InstanceConfig,
): void {
  if (instanceId === "unknown") return;

  const heartbeatDir = join(agentsDir, "shared", "federation", "heartbeats");
  const heartbeatPath = join(heartbeatDir, `${instanceId}.json`);

  try {
    if (!existsSync(heartbeatDir)) mkdirSync(heartbeatDir, { recursive: true });

    const heartbeat = {
      instance: instanceId,
      last_seen: new Date().toISOString(),
      agents: config[instanceId].agents,
    };

    writeFileSync(heartbeatPath, JSON.stringify(heartbeat, null, 2) + "\n", "utf-8");
  } catch {
    // Non-fatal — heartbeat is informational
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

    // Write instance heartbeat (federation liveness signal)
    writeInstanceHeartbeat(agentsDir, instanceId, config);

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
      const lines = status.split("\n").filter(Boolean);
      const changedFiles = lines
        .map(line => line.slice(3).trim()) // Remove status prefix (e.g., " M ", "?? ")
        .filter(f => f && !f.endsWith(".bak")); // Skip .bak files

      if (changedFiles.length === 0) return;

      // SAFETY: Abort if mass deletions detected (prevents nuking repo from partial checkouts)
      const deletions = lines.filter(line => line.trimStart().startsWith("D")).length;
      if (deletions > 50) {
        ctx.log(`[agents-auto-commit] ⚠️ ABORT: ${deletions} deletions detected — likely partial checkout. Skipping commit.`);
        return;
      }

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
