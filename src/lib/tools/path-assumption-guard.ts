/**
 * Path Assumption Guard — beforeToolCall hook.
 *
 * Blocks tool calls that reference paths outside the working environment (/app).
 * Agents repeatedly use paths like /Users/jk/..., /home/user/..., ~/... which
 * don't exist and waste tool calls with ENOENT errors.
 *
 * This guard catches the FM-1.1/ENV_PATH_ASSUMPTION failure mode that appeared
 * in 6+ evaluations (2026-03-24/25). Instead of letting the tool fail, we
 * return a helpful error that redirects the agent to the correct path.
 *
 * Checked tools: bash, read, edit, write
 * Blocked patterns: /Users/*, /home/*, ~/*, /root/*, /tmp/* (configurable)
 * Allowed: /app/*, relative paths, /usr/bin/*, /bin/*, /etc/* (system reads)
 *
 * Source: Optimizer ENV_PATH_ASSUMPTION pattern analysis 2026-03-25.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/**
 * Absolute path prefixes that are almost certainly wrong in this environment.
 * These indicate the LLM is hallucinating a different filesystem layout.
 */
const INVALID_PATH_PREFIXES = [
  "/Users/",
  "/home/",
  "/root/",
  "~/",
];

/**
 * System paths that are legitimate to reference (read-only system tools, etc.).
 * bash commands like `which node` → `/usr/bin/node` are fine.
 */
const ALLOWED_SYSTEM_PREFIXES = [
  "/app/",
  "/app",
  "/usr/",
  "/bin/",
  "/sbin/",
  "/etc/",
  "/proc/",
  "/dev/",
  "/tmp/",  // tmp is valid for transient work
];

/**
 * Check if a path string contains an invalid path assumption.
 * Returns the offending path prefix if found, null otherwise.
 */
function findInvalidPath(pathStr: string): string | null {
  for (const prefix of INVALID_PATH_PREFIXES) {
    if (pathStr.includes(prefix)) {
      return prefix;
    }
  }
  return null;
}

/**
 * For bash commands, extract cd targets and other path references.
 * We check the whole command string for invalid path prefixes.
 */
function checkBashCommand(command: string): string | null {
  return findInvalidPath(command);
}

/**
 * Check if a file path argument (for read/edit/write) starts with an invalid prefix.
 * Relative paths are always allowed — they resolve relative to /app.
 */
function checkFilePath(filePath: string): string | null {
  // Relative paths are fine
  if (!filePath.startsWith("/") && !filePath.startsWith("~")) return null;

  // Check if it's an allowed system path
  for (const allowed of ALLOWED_SYSTEM_PREFIXES) {
    if (filePath.startsWith(allowed)) return null;
  }

  // Check for known bad prefixes
  return findInvalidPath(filePath);
}

/**
 * Create a beforeToolCall hook that blocks tool calls with invalid path assumptions.
 */
export function createPathAssumptionGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    const toolName = ctx.toolCall.name;
    const args = ctx.args ?? {};

    // ── bash commands: check the full command string ──
    if (toolName === "bash") {
      const command = args.command;
      if (typeof command === "string") {
        const invalidPrefix = checkBashCommand(command);
        if (invalidPrefix) {
          return {
            block: true,
            reason:
              `🚫 PATH_ASSUMPTION: bash() command references "${invalidPrefix}" which does not exist ` +
              `in this environment. The working directory is /app.\n` +
              `Fix: Use relative paths (e.g., "src/...", "agents/...") or absolute paths starting with /app/.\n` +
              `Example: Instead of "cd /Users/jk/project && ls", use "ls src/" or "cd /app && ls".`,
          };
        }
      }
      return undefined;
    }

    // ── read/edit/write: check the path argument ──
    if (toolName === "read" || toolName === "edit" || toolName === "write") {
      const filePath = args.path;
      if (typeof filePath === "string") {
        const invalidPrefix = checkFilePath(filePath);
        if (invalidPrefix) {
          // Try to suggest a corrected path
          let suggestion = filePath;
          for (const prefix of INVALID_PATH_PREFIXES) {
            if (filePath.includes(prefix)) {
              // Extract the part after the home directory
              // e.g., /Users/jk/aijudge/src/foo.ts → src/foo.ts
              const parts = filePath.split("/");
              // Skip /Users/username/project/ (first 4 segments)
              // or /home/user/ (first 3 segments)
              const skipCount = prefix === "/Users/" ? 4 : 3;
              if (parts.length > skipCount) {
                suggestion = parts.slice(skipCount).join("/");
              }
              break;
            }
          }

          return {
            block: true,
            reason:
              `🚫 PATH_ASSUMPTION: ${toolName}() references "${filePath}" which does not exist ` +
              `in this environment. The working directory is /app.\n` +
              `Fix: Use a relative path instead.\n` +
              `Suggestion: ${toolName}({ path: "${suggestion}" })`,
          };
        }
      }
      return undefined;
    }

    return undefined;
  };
}
