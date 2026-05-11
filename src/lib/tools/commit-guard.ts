/**
 * finish() Commit Guard — beforeToolCall hook.
 *
 * Intercepts `finish()` calls (any status) and checks for uncommitted changes
 * matching this session's deliverables or direct write/edit tool calls. If found,
 * blocks finish and tells the agent to commit only those files first.
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

function isGeneratedRuntimePath(path: string, agentName: string): boolean {
  return path === `${agentName}/last-session.md`;
}

function normalizeAgentRepoPath(path: string): string | undefined {
  const normalized = path
    .replace(/^\/app\/agents\//, "")
    .replace(/^\/app\//, "")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");
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

function extractBashWritePaths(command: string): string[] {
  const paths: string[] = [];
  const add = (raw: string | undefined) => {
    if (!raw) return;
    const normalized = normalizeAgentRepoPath(stripShellTokenQuotes(raw));
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

function extractToolWritePaths(messages: BeforeToolCallContext["context"]["messages"]): string[] {
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
        const normalized = normalizeAgentRepoPath(args.path);
        if (normalized) paths.push(normalized);
      }
      if (name === "bash" && typeof args.command === "string") {
        paths.push(...extractBashWritePaths(args.command));
      }
    }
  }
  return paths;
}

function changedPathFromStatusLine(line: string): string {
  return normalizeStatusPath(line);
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
 * Checks `git status --porcelain` in the agents/ sub-repo for files under
 * `<agentName>/`, `shared/`, `.lab/`, and `gym/`. If uncommitted changes
 * exist, blocks the finish() call with instructions to commit.
 *
 * @param agentName - The agent's name (e.g., "bob", "coach"). Empty = skip guard.
 * @param projectRoot - Absolute path to project root (agents/ is a sub-dir).
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

    // Skip if agents sub-repo doesn't exist
    const agentsGitDir = resolve(projectRoot, "agents", ".git");
    if (!existsSync(agentsGitDir)) return undefined;

    const agentsDir = resolve(projectRoot, "agents");

    try {
      // Check broad candidate paths, then narrow to this session's claimed or
      // direct write/edit paths. Shared project files are a common write target,
      // but blocking on all dirty shared/ files pressures agents into committing
      // unrelated work.
      const pathsToCheck = [
        `${agentName}/`,
        "shared/",
        ".lab/",
        "gym/",
      ];

      const statusOutput = await runGit(
        ["status", "--porcelain", "--untracked-files=all", "--", ...pathsToCheck],
        agentsDir,
        GIT_TIMEOUT_MS,
      );

      const changedFiles = statusOutput.trim();

      if (!changedFiles) return undefined; // No uncommitted changes — allow finish

      // Count changed files
      const allFileLines = changedFiles.split("\n").filter((line) => line.trim());
      const ignoredFileLines = allFileLines.filter((line) =>
        isGeneratedRuntimePath(normalizeStatusPath(line), agentName),
      );
      const fileLines = allFileLines.filter((line) =>
        !isGeneratedRuntimePath(normalizeStatusPath(line), agentName),
      );

      if (fileLines.length === 0) return undefined; // Runtime handoff/log churn should not block finish.

      const args = ctx.args as {
        deliverables?: Array<{ path?: string }>;
      };
      const claimedPaths = (args.deliverables ?? [])
        .map((d) => typeof d.path === "string" ? normalizeAgentRepoPath(d.path) : undefined)
        .filter((p): p is string => !!p);
      const touchedPaths = extractToolWritePaths(ctx.context.messages);
      const ownedPaths = new Set([...claimedPaths, ...touchedPaths]);

      const ownedFileLines = ownedPaths.size > 0
        ? fileLines.filter((line) => {
            const changedPath = changedPathFromStatusLine(line);
            return [...ownedPaths].some((ownedPath) => isSameOrChild(changedPath, ownedPath));
          })
        : fileLines.filter((line) => changedPathFromStatusLine(line).startsWith(`${agentName}/`));

      if (ownedFileLines.length === 0) {
        return {
          block: false,
          reason:
            `Uncommitted files exist in agents/, but none match this session's deliverables or write/edit paths. ` +
            `Do not commit unrelated files just to satisfy finish().`,
        };
      }

      const fileCount = ownedFileLines.length;

      // Format the file list (indent each line)
      const fileList = ownedFileLines.map((line) => `  ${line}`).join("\n");

      const addPaths = ownedFileLines.map(changedPathFromStatusLine);

      // If any changed path is under */workspace/*, use `git add -f` because
      // agents/.gitignore ignores workspace/ contents.
      const needsForce = addPaths.some((path) => path.includes("/workspace/") || path.startsWith("shared/projects/"));
      const addCmd = `${needsForce ? "git add -f" : "git add"} -- ${addPaths.map(shellQuote).join(" ")}`;

      return {
        block: true,
        reason:
          `finish() blocked [uncommitted changes]: You have ${fileCount} uncommitted file(s) in agents/:\n` +
          `${fileList}\n\n` +
          `For each listed file: commit it if it is intentional, or restore it if it was accidental. Do not commit accidental changes just to satisfy finish().\n\n` +
          (ignoredFileLines.length > 0
            ? `Ignored generated runtime file(s):\n${ignoredFileLines.map((line) => `  ${line}`).join("\n")}\n\n`
            : "") +
          (ownedFileLines.length < fileLines.length
            ? `Not blocking on unrelated dirty file(s):\n${fileLines.filter((line) => !ownedFileLines.includes(line)).map((line) => `  ${line}`).join("\n")}\n\n`
            : "") +
          `Commit them with a descriptive message before calling finish():\n` +
          `  cd ${projectRoot}/agents && ${addCmd} && git commit -m "${agentName}: <describe what you did>"\n\n` +
          `Good messages: "${agentName}: H-045 Decision Topology hypothesis", "${agentName}: new skill for evidence-first debugging"\n` +
          `Bad messages: "update files", "changes"\n\n` +
          `Then call finish() again.`,
      };
    } catch {
      // Fail-open: guard errors are non-fatal (existing pattern)
      return undefined;
    }
  };
}
