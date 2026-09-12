/**
 * finish() Commit Guard — beforeToolCall hook.
 *
 * Intercepts `finish()` calls (any status) and checks for uncommitted changes
 * matching this session's deliverables or direct write/edit tool calls. If found,
 * emits a guard signal and tells the agent which files still need commit/revert review.
 *
 * This is L5 structural enforcement to fix the 74% auto-commit problem.
 * Agents must commit their own work with descriptive messages instead of
 * relying on the auto-commit safety net.
 *
 * Policy: Guards are fail-open — git errors or timeouts allow finish through.
 * Source: SPEC-commit-guard.md via May → Tech Lead
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/** Timeout for git commands (ms). git status should complete in <100ms. */
const GIT_TIMEOUT_MS = 5_000;

function normalizeStatusPath(line: string): string {
  const porcelain = line.match(/^.. (.+)$/);
  if (porcelain) return porcelain[1].trim();
  return line.replace(/^[ MARCUD?!]{1,2}\s+/, "").trim();
}

type RepoLayout = "app" | "legacy-agents";

function isGeneratedRuntimePath(path: string, agentName: string, layout: RepoLayout): boolean {
  const agentPrefix = layout === "app" ? `agents/${agentName}` : agentName;
  return path === `${agentPrefix}/last-session.md` || path === `${agentPrefix}/last-eval.md`;
}

function normalizeAgentRepoPath(path: string, layout: RepoLayout = "legacy-agents"): string | undefined {
  const normalized = path
    .replace(/^\/app\//, "")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");

  if (layout === "app") {
    if (normalized.startsWith("shared/projects/")) return normalized.replace(/^shared\/projects\//, "projects/");
    if (normalized.startsWith("agents/shared/projects/")) return normalized.replace(/^agents\/shared\/projects\//, "projects/");
    if (
      normalized.startsWith("agents/") ||
      normalized.startsWith("shared/") ||
      normalized.startsWith("projects/") ||
      normalized.startsWith(".lab/") ||
      normalized.startsWith("gym/")
    ) {
      return normalized;
    }
    return undefined;
  }

  if (normalized.startsWith("agents/")) return normalized.slice("agents/".length);
  if (
    normalized.startsWith("shared/") ||
    normalized.startsWith(".lab/") ||
    normalized.startsWith("gym/") ||
    /^[^/]+\//.test(normalized)
  ) {
    return normalized;
  }
  return undefined;
}

function shellQuote(path: string): string {
  return `'${path.replace(/'/g, "'\\''")}'`;
}

function stripShellTokenQuotes(token: string): string {
  const trimmed = token.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function extractBashWritePaths(command: string, layout: RepoLayout): string[] {
  const paths: string[] = [];
  const add = (raw: string | undefined) => {
    if (!raw) return;
    const normalized = normalizeAgentRepoPath(stripShellTokenQuotes(raw), layout);
    if (normalized) paths.push(normalized);
  };

  // Common shell write forms:
  //   cat <<EOF > path
  //   echo x >> path
  //   command 1> path
  const redirectPattern = /(?:^|[\s;&|])(?:\d?>|>>)\s*(['"]?)([^'"\s;&|]+)\1/g;
  for (const match of command.matchAll(redirectPattern)) add(match[2]);

  // tee writes to its final path arguments. Keep this conservative and only
  // capture simple non-option path tokens.
  const teePattern = /(?:^|[\s;&|])tee(?:\s+-a)?(?:\s+--)?\s+(['"]?)([^'"\s;&|]+)\1/g;
  for (const match of command.matchAll(teePattern)) add(match[2]);

  // cp/mv write to the destination path.
  const copyMovePattern = /(?:^|[\s;&|])(?:cp|mv)(?:\s+-[A-Za-z0-9]+)*\s+(['"]?)[^'"\s;&|]+\1\s+(['"]?)([^'"\s;&|]+)\2/g;
  for (const match of command.matchAll(copyMovePattern)) add(match[3]);

  // touch writes the named file.
  const touchPattern = /(?:^|[\s;&|])touch(?:\s+-[A-Za-z0-9]+)*\s+(['"]?)([^'"\s;&|]+)\1/g;
  for (const match of command.matchAll(touchPattern)) add(match[2]);

  return [...new Set(paths)];
}

function extractToolWritePaths(messages: BeforeToolCallContext["context"]["messages"], layout: RepoLayout): string[] {
  const paths: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (!block || typeof block !== "object" || !("type" in block) || block.type !== "toolCall" || !("name" in block)) {
        continue;
      }
      const name = (block as { name: string }).name;
      const rawArgs = "arguments" in block ? (block as { arguments: unknown }).arguments : undefined;
      let args: Record<string, unknown> = {};
      if (typeof rawArgs === "string") {
        try { args = JSON.parse(rawArgs); } catch { /* ignore malformed tool args */ }
      } else if (rawArgs && typeof rawArgs === "object") {
        args = rawArgs as Record<string, unknown>;
      }

      if ((name === "write" || name === "edit") && typeof args.path === "string") {
        const normalized = normalizeAgentRepoPath(args.path, layout);
        if (normalized) paths.push(normalized);
      }
      if (name === "bash" && typeof args.command === "string") {
        paths.push(...extractBashWritePaths(args.command, layout));
      }
    }
  }
  return paths;
}

function changedPathFromStatusLine(line: string): string {
  return normalizeStatusPath(line);
}

function resolveAgentRepo(projectRoot: string): { dir: string; layout: RepoLayout; label: string } | null {
  if (existsSync(resolve(projectRoot, ".git"))) {
    return { dir: projectRoot, layout: "app", label: "app repo" };
  }
  const legacyAgentsDir = resolve(projectRoot, "agents");
  if (existsSync(resolve(legacyAgentsDir, ".git"))) {
    return { dir: legacyAgentsDir, layout: "legacy-agents", label: "agents repo" };
  }
  return null;
}

function isSameOrChild(path: string, ownerPath: string): boolean {
  return path === ownerPath || path.startsWith(`${ownerPath.replace(/\/$/, "")}/`);
}

/**
 * Run a git command and return stdout. Rejects on non-zero exit or timeout.
 */
function runGit(args: string[], cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("git", args, { cwd, timeout: timeoutMs, encoding: "utf-8" }, (error, stdout) => {
      if (error) return reject(error);
      resolve(stdout);
    });
    // Safety: kill on timeout (execFile handles this via timeout option)
    void child;
  });
}

/**
 * Create a beforeToolCall hook that guards finish() for uncommitted agent changes.
 *
 * Checks `git status --porcelain` in the app repo for files under
 * `agents/<agentName>/`, `shared/`, `projects/`, `.lab/`, and `gym/`. The
 * legacy `<projectRoot>/agents` repo layout is still accepted during migration.
 * If uncommitted changes
 * exist, emits a signal with instructions to commit or restore them.
 *
 * @param agentName - The agent's name (e.g., "bob", "coach"). Empty = skip guard.
 * @param projectRoot - Absolute path to app root, or a legacy root containing agents/.
 */
export function createCommitGuard(
  agentName: string,
  projectRoot: string,
): (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined> {
  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    // Only intercept finish() calls
    if (ctx.toolCall.name !== "finish") return undefined;

    // Skip if no agent name (chat sessions / non-agent contexts)
    if (!agentName) return undefined;

    const repo = resolveAgentRepo(projectRoot);
    if (!repo) return undefined;
    const agentPathPrefix = repo.layout === "app" ? `agents/${agentName}` : agentName;

    try {
      // Check broad candidate paths, then narrow to this session's claimed or
      // direct write/edit paths. Shared project files are a common write target,
      // but warning on all dirty shared/ files pressures agents into committing
      // unrelated work.
      const pathsToCheck = [
        `${agentPathPrefix}/`,
        "shared/",
        ...(repo.layout === "app" ? ["projects/"] : []),
        ".lab/",
        "gym/",
      ];

      const statusOutput = await runGit(
        ["status", "--porcelain", "--untracked-files=all", "--", ...pathsToCheck],
        repo.dir,
        GIT_TIMEOUT_MS,
      );

      const changedFiles = statusOutput.trim();

      if (!changedFiles) return undefined; // No uncommitted changes — allow finish

      // Count changed files
      const allFileLines = changedFiles.split("\n").filter((line) => line.trim());
      const ignoredFileLines = allFileLines.filter((line) =>
        isGeneratedRuntimePath(normalizeStatusPath(line), agentName, repo.layout),
      );
      const fileLines = allFileLines.filter((line) =>
        !isGeneratedRuntimePath(normalizeStatusPath(line), agentName, repo.layout),
      );

      if (fileLines.length === 0) return undefined; // Runtime handoff/log churn should not warn on finish.

      const args = ctx.args as {
        deliverables?: Array<{ path?: string }>;
      };
      const claimedPaths = (args.deliverables ?? [])
        .map((d) => typeof d.path === "string" ? normalizeAgentRepoPath(d.path, repo.layout) : undefined)
        .filter((p): p is string => !!p);
      const touchedPaths = extractToolWritePaths(ctx.context.messages, repo.layout);
      const ownedPaths = new Set([...claimedPaths, ...touchedPaths]);

      const ownedFileLines = ownedPaths.size > 0
        ? fileLines.filter((line) => {
            const changedPath = changedPathFromStatusLine(line);
            return [...ownedPaths].some((ownedPath) => isSameOrChild(changedPath, ownedPath));
          })
        : fileLines.filter((line) => changedPathFromStatusLine(line).startsWith(`${agentPathPrefix}/`));

      if (ownedFileLines.length === 0) {
        // No session-owned files are dirty — unrelated dirty files in the shared
        // worktree are not this session's responsibility. Return undefined (silent
        // pass-through) to avoid emitting a guard.triggered event for every
        // finish() call when the worktree has unrelated dirty state.
        // KE-2000 Spec 3: this was the #1 source of guard noise (~2000/day).
        return undefined;
      }

      const fileCount = ownedFileLines.length;

      // Format the file list (indent each line)
      const fileList = ownedFileLines.map((line) => `  ${line}`).join("\n");

      const addPaths = ownedFileLines.map(changedPathFromStatusLine);

      // If any changed path is under */workspace/*, use `git add -f` because
      // the app repo ignores workspace/ contents. Project outputs may also be
      // ignored by local app-root policy and should be force-added explicitly.
      const needsForce = addPaths.some((path) =>
        path.includes("/workspace/") ||
        path.startsWith("projects/") ||
        path.startsWith("shared/projects/")
      );
      const addCmd = `${needsForce ? "git add -f" : "git add"} -- ${addPaths.map(shellQuote).join(" ")}`;

      return {
        block: false, // signal-only: guard emits metric but does not block
        reason:
          `finish() guard signal [uncommitted changes]: You have ${fileCount} uncommitted file(s) in the ${repo.label}:\n` +
          `${fileList}\n\n` +
          `For each listed file: commit it if it is intentional, or restore it if it was accidental. Do not commit accidental changes just to satisfy finish().\n\n` +
          (ignoredFileLines.length > 0
            ? `Ignored generated runtime file(s):\n${ignoredFileLines.map((line) => `  ${line}`).join("\n")}\n\n`
            : "") +
          (ownedFileLines.length < fileLines.length
            ? `Unrelated dirty file(s), not part of this signal:\n${fileLines.filter((line) => !ownedFileLines.includes(line)).map((line) => `  ${line}`).join("\n")}\n\n`
            : "") +
          `If these changes are intentional, commit them with a descriptive message:\n` +
          `  cd ${repo.dir} && ${addCmd} && git commit -m "${agentName}: <describe what you did>"\n\n` +
          `Good messages: "${agentName}: H-045 Decision Topology hypothesis", "${agentName}: new skill for facts-first debugging"\n` +
          `Bad messages: "update files", "changes"\n\n` +
          `Finish may continue, but this signal should be reviewed.`,
      };
    } catch {
      // Fail-open: guard errors are non-fatal (existing pattern)
      return undefined;
    }
  };
}
