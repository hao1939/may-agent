/**
 * finish() Commit Guard — beforeToolCall hook.
 *
 * Intercepts `finish()` calls (any status) and checks for uncommitted changes
 * in the agent's `agents/<name>/` directory. If found, blocks finish and tells
 * the agent to commit their work first.
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
 * `<agentName>/`. If uncommitted changes exist, blocks the finish() call
 * with instructions to commit.
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
      // Check for uncommitted changes in agent's directory.
      // git status --porcelain shows everything: staged (M/A in col 1),
      // unstaged (M in col 2), and untracked (??) files.
      // --untracked-files=all shows individual files instead of just the directory.
      const statusOutput = await runGit(
        ["status", "--porcelain", "--untracked-files=all", "--", `${agentName}/`],
        agentsDir,
        GIT_TIMEOUT_MS,
      );

      const changedFiles = statusOutput.trim();

      if (!changedFiles) return undefined; // No uncommitted changes — allow finish

      // Count changed files
      const fileLines = changedFiles.split("\n").filter((line) => line.trim());
      const fileCount = fileLines.length;

      // Format the file list (indent each line)
      const fileList = fileLines.map((line) => `  ${line}`).join("\n");

      return {
        block: true,
        reason:
          `finish() blocked [uncommitted changes]: You have ${fileCount} uncommitted file(s) in agents/${agentName}/:\n` +
          `${fileList}\n\n` +
          `Commit them with a descriptive message before calling finish():\n` +
          `  cd ${projectRoot}/agents && git add ${agentName}/ && git commit -m "${agentName}: <describe what you did>"\n\n` +
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
