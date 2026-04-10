/**
 * Verification-Depth Guard — beforeToolCall hook.
 *
 * Intercepts `finish(status: "success")` and checks whether the session
 * transcript contains *meaningful* verification — not just any verification.
 *
 * Addresses residual FM-3.3 from EXP-110 where 35% of post-guard FM-3.3
 * remains unrecovered because agents perform superficial verification:
 * - Git commands on gitignored paths (agents/) that return nothing
 * - No post-write verification at all
 * - Fabricated verification evidence referencing non-existent transcript steps
 *
 * Detection is transcript-based (no filesystem access). Same pattern as
 * completeness-guard.ts and commit-guard.ts.
 *
 * Policy: FAIL-OPEN — if detection logic throws, allow the call through.
 * Source: EXP-123 via Coach.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/**
 * Options for the verification-depth guard.
 */
export interface VerificationDepthGuardOptions {
  /**
   * Which agent(s) this guard applies to. If undefined, applies to all agents.
   * If a string, matches exactly. If an array, matches any.
   */
  agents?: string | string[];

  /**
   * Whether to block the finish call (true) or just warn (false).
   * Default: true
   */
  block?: boolean;

  /**
   * Optional callback invoked when the guard fires (for logging/metrics).
   */
  onBlock?: (agentName: string, sessionId: string, reason: string) => void;
}

// ──────────────────────────────────────────────────────────────────────
// Internal types for transcript analysis
// ──────────────────────────────────────────────────────────────────────

interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  index: number; // position in the transcript (for ordering)
}

/**
 * Extract all tool calls from the transcript messages.
 * Returns them in order with their index for temporal analysis.
 */
function extractToolCalls(
  messages: BeforeToolCallContext["context"]["messages"],
): ToolCallRecord[] {
  const calls: ToolCallRecord[] = [];
  let index = 0;

  for (const msg of messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (
        !block ||
        typeof block !== "object" ||
        !("type" in block) ||
        block.type !== "toolCall" ||
        !("name" in block)
      ) {
        continue;
      }

      const name = (block as { name: string }).name;
      const rawArgs = "arguments" in block
        ? (block as { arguments: unknown }).arguments
        : undefined;

      let args: Record<string, unknown> = {};
      if (typeof rawArgs === "string") {
        try { args = JSON.parse(rawArgs); } catch { /* ignore */ }
      } else if (rawArgs && typeof rawArgs === "object") {
        args = rawArgs as Record<string, unknown>;
      }

      calls.push({ name, args, index: index++ });
    }
  }

  return calls;
}

/**
 * Check if a bash command is a git command targeting agents/ paths.
 *
 * Detects: git diff, git status, git show, git log, git ls-files, git add,
 * git commit — all operating on paths under agents/
 */
function isGitOnAgentsPath(command: string): boolean {
  // Must contain both a git command and an agents/ path reference
  const gitCommandPattern = /\bgit\s+(diff|status|show|log|ls-files|add|commit|check-ignore)\b/;
  const agentsPathPattern = /\bagents\//;

  return gitCommandPattern.test(command) && agentsPathPattern.test(command);
}

/**
 * Check if a tool call is a "write" operation (creates or modifies files).
 */
function isWriteCall(call: ToolCallRecord): boolean {
  if (call.name === "write" || call.name === "edit") return true;

  if (call.name === "bash") {
    const cmd = String(call.args.command ?? "");
    // Detect bash writes: redirects, tee, sed -i, etc.
    if (/(?:>\s*[^\s]|>>\s*[^\s]|\btee\b|\bsed\s+-i\b|\bcat\s*>)/.test(cmd)) return true;
  }

  return false;
}

/**
 * Check if a tool call is a verification operation (reads, tests, checks).
 */
function isVerificationCall(call: ToolCallRecord): boolean {
  if (call.name === "read") return true;

  if (call.name === "bash") {
    const cmd = String(call.args.command ?? "");

    // Git commands on agents/ paths are NOT verification
    if (isGitOnAgentsPath(cmd)) return false;

    // Test runners, grep/diff, node execution, etc. = verification
    const verificationPatterns = [
      /\btest\b/i,           // test runners
      /\bgrep\b/,            // searching for content
      /\bdiff\b/,            // comparing content (non-git)
      /\bnode\b/,            // running scripts
      /\bnpx\b/,             // running tools
      /\bbun\b/,             // running bun
      /\bcat\b/,             // reading files (when not redirecting)
      /\bls\b/,              // listing files
      /\bwc\b/,              // counting
      /\bhead\b|\btail\b/,   // reading file parts
    ];

    // But only if NOT redirecting (which would be a write)
    if (/(?:>\s*[^\s]|>>\s*[^\s]|\btee\b)/.test(cmd)) return false;

    return verificationPatterns.some(p => p.test(cmd));
  }

  return false;
}

/**
 * Get paths referenced by a tool call.
 */
function getReferencedPaths(call: ToolCallRecord): string[] {
  const paths: string[] = [];

  if (call.name === "read" || call.name === "write" || call.name === "edit") {
    const p = call.args.path;
    if (typeof p === "string") paths.push(p);
  }

  return paths;
}

// ──────────────────────────────────────────────────────────────────────
// Detection Rules
// ──────────────────────────────────────────────────────────────────────

interface DetectionResult {
  rule: string;
  detected: boolean;
  message: string;
}

/**
 * Rule 1: Git commands on gitignored agents/ paths as sole "verification".
 *
 * If the session contains git commands targeting agents/ AND no other
 * meaningful verification after the last write, flag it.
 */
function detectGitOnGitignored(calls: ToolCallRecord[]): DetectionResult {
  const gitOnAgentsCalls = calls.filter(c => {
    if (c.name !== "bash") return false;
    const cmd = String(c.args.command ?? "");
    return isGitOnAgentsPath(cmd);
  });

  if (gitOnAgentsCalls.length === 0) {
    return { rule: "T1-git-gitignored", detected: false, message: "" };
  }

  // Find last write call
  const writeCalls = calls.filter(isWriteCall);
  if (writeCalls.length === 0) {
    return { rule: "T1-git-gitignored", detected: false, message: "" };
  }

  const lastWriteIndex = Math.max(...writeCalls.map(c => c.index));

  // Check if there's any REAL verification after the last write
  // (verification that isn't git on agents/)
  const postWriteVerification = calls.filter(c =>
    c.index > lastWriteIndex &&
    isVerificationCall(c) &&
    !(c.name === "bash" && isGitOnAgentsPath(String(c.args.command ?? "")))
  );

  if (postWriteVerification.length === 0 && gitOnAgentsCalls.length >= 2) {
    return {
      rule: "T1-git-gitignored",
      detected: true,
      message:
        `Found ${gitOnAgentsCalls.length} git commands targeting agents/ paths (gitignored) ` +
        `but NO meaningful post-edit verification.\n` +
        `Files under agents/ are gitignored — git diff/status/show return nothing.\n` +
        `Instead: use read() to check file contents, or bash('grep ...') to verify specific content.`,
    };
  }

  return { rule: "T1-git-gitignored", detected: false, message: "" };
}

/**
 * Rule 2: No post-write verification at all.
 *
 * If the session has write/edit calls but NO verification calls after the
 * last write, the agent didn't verify its work.
 */
function detectNoPostWriteVerification(calls: ToolCallRecord[]): DetectionResult {
  const writeCalls = calls.filter(isWriteCall);
  if (writeCalls.length === 0) {
    // No writes → nothing to verify (e.g., analysis-only session)
    return { rule: "T2-no-post-write-verification", detected: false, message: "" };
  }

  const lastWriteIndex = Math.max(...writeCalls.map(c => c.index));

  // Any verification call after the last write?
  const postWriteVerification = calls.filter(c =>
    c.index > lastWriteIndex && isVerificationCall(c)
  );

  if (postWriteVerification.length === 0) {
    // Get the paths of what was written
    const writtenPaths = writeCalls.flatMap(getReferencedPaths);
    const pathList = writtenPaths.length > 0
      ? writtenPaths.slice(0, 3).join(", ") + (writtenPaths.length > 3 ? "..." : "")
      : "(bash-written files)";

    return {
      rule: "T2-no-post-write-verification",
      detected: true,
      message:
        `You wrote/edited files (${pathList}) but performed NO verification after your last edit.\n` +
        `Before finishing, verify your work:\n` +
        `• read() the modified files to confirm changes took effect\n` +
        `• Run tests if available (bash('node test.js') or bash('bun test'))\n` +
        `• grep for expected content (bash('grep "expected" file.md'))`,
    };
  }

  return { rule: "T2-no-post-write-verification", detected: false, message: "" };
}

// ──────────────────────────────────────────────────────────────────────
// Guard Factory
// ──────────────────────────────────────────────────────────────────────

/**
 * Create a beforeToolCall hook that enforces verification depth before
 * finish(status: "success").
 *
 * Design:
 * - Transcript-based: scans tool call history for verification patterns
 * - No filesystem access, no async IO
 * - Fail-open: any error in detection → allow through
 * - Composable: slots into composeGuards() alongside existing guards
 *
 * @param agentName - The current agent's name (passed from manager.ts)
 * @param options - Configuration options
 */
export function createVerificationDepthGuard(
  agentName: string,
  options: VerificationDepthGuardOptions = {},
): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  const targetAgents = options.agents
    ? (Array.isArray(options.agents) ? options.agents : [options.agents])
    : undefined; // undefined = all agents
  const shouldBlock = options.block !== false; // default true
  const onBlock = options.onBlock;

  // Pre-check: is this agent targeted?
  const isTargeted = targetAgents ? targetAgents.includes(agentName) : true;

  return async (
    ctx: BeforeToolCallContext,
  ): Promise<BeforeToolCallResult | undefined> => {
    try {
      // Env-var kill switch: DISABLE_VERIFICATION_DEPTH_GUARD=1 disables entirely
      // Used for A/B experiments (baseline runs)
      if (process.env.DISABLE_VERIFICATION_DEPTH_GUARD === "1") return undefined;

      // Only applies to targeted agents
      if (!isTargeted) return undefined;

      // Only intercept finish() calls
      if (ctx.toolCall.name !== "finish") return undefined;

      // Only guard success
      const args = ctx.args as { status?: string };
      if (args.status !== "success") return undefined;

      // Extract tool calls from transcript
      const calls = extractToolCalls(ctx.context.messages);

      // Run detection rules
      const results: DetectionResult[] = [
        detectGitOnGitignored(calls),
        detectNoPostWriteVerification(calls),
      ];

      // Find first detection that triggered
      const triggered = results.find(r => r.detected);
      if (!triggered) return undefined;

      // Fire callback if provided
      if (onBlock) {
        try {
          onBlock(agentName, ctx.toolCall.id, triggered.rule);
        } catch {
          // Callback errors don't block the guard
        }
      }

      const reason =
        `🔍 VERIFICATION DEPTH: finish(status: "success") blocked — superficial verification detected.\n\n` +
        `**Rule violated**: ${triggered.rule}\n` +
        `${triggered.message}\n\n` +
        `Verify your deliverables meaningfully, then call finish() again.`;

      return {
        block: shouldBlock,
        reason,
      };
    } catch {
      // Fail-open: if anything throws, allow the call through
      return undefined;
    }
  };
}
