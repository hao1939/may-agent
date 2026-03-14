/**
 * Failure chain extraction — pure functions for detecting causal error chains
 * in agent tool-call sequences.
 *
 * Extracted from evaluator.ts for maintainability.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { extractHallucinatedRelPath } from "./tools/may-utils.js";

// ── Failure chain extraction ───────────────────────────────────────────

/** A single step in a failure chain: a tool call and its result. */
export interface FailureStep {
  tool: string;
  args: string; // compact JSON of arguments
  result: string; // first 200 chars of result text
  isError: boolean;
}

/** A causal failure chain: trigger error → recovery attempts → eventual resolution. */
export interface FailureChain {
  trigger: FailureStep; // the tool call that started the chain
  recovery: FailureStep[]; // subsequent attempts to recover
  resolution: FailureStep | null; // the call that finally succeeded (null if never resolved)
  wastedCalls: number; // number of calls wasted in this chain
  rootCause: string; // short description of why the chain started
}

/**
 * Detect `find` or `locate` commands that returned empty AND targeted a
 * hallucinated or clearly wrong path — a sign the agent is guessing paths.
 *
 * Only flags empty finds when the search path is outside the project or matches
 * a hallucinated-root pattern (e.g., /home/user, /Users/jdoe/project, /app).
 * Finds starting from `.`, `./`, or the actual project root that return empty
 * are just "file not found" — normal exploration, not an error.
 *
 * This prevents false-positive failure chains from legitimate checks like
 * `find . -name "vitest.config.ts"` (file simply doesn't exist) while still
 * catching `find /home/user -name "*.ts"` (hallucinated path, real problem).
 */
function isFindWithNoResults(toolName: string, args: Record<string, unknown>, resultText: string): boolean {
  if (toolName !== "exec") return false;
  const cmd = typeof args.command === "string" ? args.command : "";
  if (!/\b(find|locate)\b/.test(cmd)) return false;

  // Strip the CWD echo line if present
  const cleaned = resultText.replace(/^CWD:[^\n]*\n?/, "").trim();
  const isEmpty = cleaned === "" || cleaned === "(no output)";
  if (!isEmpty) return false;

  // Extract the search path from the command.
  // Matches: find <path> ..., locate ..., cd <dir> && find <path> ...
  const stripped = cmd.replace(/^\s*cd\s+\S+\s*(?:&&|;)\s*/, "");
  const pathMatch = stripped.match(/\b(?:find|locate)\s+(?:["']([^"']+)["']|(\S+))/);
  const searchPath = pathMatch?.[1] ?? pathMatch?.[2] ?? "";

  // Relative paths (., ./, src/, test/) are local exploration — not errors.
  if (!searchPath || searchPath === "." || searchPath.startsWith("./") || !searchPath.startsWith("/")) {
    return false;
  }

  // Absolute paths that match hallucinated patterns are real problems.
  if (extractHallucinatedRelPath(searchPath) !== null) {
    return true;
  }

  // Other absolute paths outside common project roots are suspicious.
  // e.g., /home/example-user (not /home/example-user/may-agent), /tmp, /var
  // But we can't know the project root here, so flag any absolute path
  // that doesn't match the CWD from the output.
  const cwdMatch = resultText.match(/^CWD:\s*(\S+)/);
  if (cwdMatch) {
    const cwd = cwdMatch[1];
    // If search path starts with the CWD, it's within the project — not an error.
    if (searchPath === cwd || searchPath.startsWith(cwd + "/")) {
      return false;
    }
  }

  // Absolute path outside project/CWD with no results — likely wrong path.
  return true;
}

/**
 * Check if a command is a test runner, type checker, or build tool.
 *
 * When agents run these tools and they exit with code 1, it's part of the
 * normal development cycle: write code → run tests/build → see failures →
 * fix → re-run. This is productive work, not a failure chain.
 *
 * Matches:
 * - Test runners: vitest, jest, mocha, pytest, npm test, npx test
 * - Type checkers: tsc, npx tsc
 * - Build tools: npm run build, npx build
 * - Linters: eslint, prettier --check
 */
function isTestOrBuildRunner(command: string): boolean {
  // Strip leading cd ... && or cd ...; prefix to get the actual command
  const actual = command.replace(/^\s*cd\s+\S+\s*(?:&&|;)\s*/, "");

  // Test runners
  if (/\b(vitest|jest|mocha|pytest|playwright)\b/.test(actual)) return true;

  // npx-invoked test/build tools: npx vitest, npx tsc, npx jest, etc.
  if (/\bnpx\s+(vitest|jest|tsc|mocha)\b/.test(actual)) return true;

  // npm/yarn/pnpm test or build scripts
  if (/\b(npm|yarn|pnpm)\s+(test|run\s+(test|build|check|lint|typecheck))\b/.test(actual)) return true;

  // Direct tsc invocation
  if (/\btsc\b/.test(actual) && /--noEmit|--build/.test(actual)) return true;

  return false;
}

/**
 * Check if a command is an existence/availability check.
 *
 * Agents commonly check if a command or package is available before using it.
 * These commands exit 1 when the target is not found — this is informational,
 * not an error:
 * - `which python3` → exit 1 (not installed)
 * - `command -v pip` → exit 1 (not available)
 * - `type node` → exit 1 (not found)
 * - `hash git` → exit 1 (not hashed/available)
 */
function isExistenceCheck(command: string): boolean {
  const actual = command.replace(/^\s*cd\s+\S+\s*(?:&&|;)\s*/, "");
  return /^\s*(which|command\s+-v|type|hash)\s+/.test(actual);
}

/**
 * Check whether an exec command with a non-zero exit code is actually
 * expected behavior, not a real error.
 *
 * Many Unix commands use non-zero exit codes for normal results:
 * - `grep` exits 1 when no lines match (normal "not found" result)
 * - `git diff` exits 1 when differences exist (the diff output IS the result)
 * - Commands with `2>/dev/null` that exit 1 (intentional error suppression)
 * - Pipe chains ending in `grep` (exit 1 = final grep found nothing)
 *
 * Without this, the evaluator creates false-positive failure chains for
 * perfectly normal tool usage, inflating wasted-call counts and skewing
 * efficiency scores.
 */
function isExpectedNonZeroExit(command: string, exitCode: string, resultText: string): boolean {
  const code = parseInt(exitCode, 10);

  // grep exits 1 when no lines match — this is normal, not an error.
  // Exit code 1 = "no match found" (informational). Exit code 2 = actual error.
  // This applies whether grep is the main command, in a pipe, or in an && chain.
  // Agents frequently use grep to search for patterns that may or may not exist;
  // treating "not found" as an error creates massive false-positive failure chains.
  if (code === 1 && /\bgrep\b/.test(command)) {
    return true;
  }

  // git diff exits 1 when there ARE differences — the diff output is the result.
  if (code === 1 && /\bgit\s+diff\b/.test(command)) {
    if (resultText.includes("diff --git") || resultText.includes("--- a/")) return true;
  }

  // Commands with 2>/dev/null that exit 1 with empty output are intentional.
  if (code === 1 && /2>\/dev\/null/.test(command)) {
    const output = resultText
      .replace(/^CWD:[^\n]*\n?/, "")
      .replace(/^Exit code \d+\n?/, "")
      .trim();
    if (output === "") return true;
  }

  // Test/build runners exit 1 when tests fail or builds fail — this is the
  // agent's normal development cycle (write code → run tests → see failures →
  // fix → re-run). Flagging these as failure chains would inflate wasted-call
  // counts and penalize productive iterative development behavior.
  if (code === 1 && isTestOrBuildRunner(command)) {
    return true;
  }

  // Existence-check commands: which, command -v, type, hash all exit 1 when
  // the command is not found. This is normal exploration ("is X installed?"),
  // not an error. The agent is gathering information, not failing.
  if (code === 1 && isExistenceCheck(command)) {
    return true;
  }

  // diff (non-git) exits 1 when files differ — the diff output IS the result.
  // This is the standard Unix convention: 0 = identical, 1 = different, 2 = error.
  if (code === 1 && /\bdiff\b/.test(command) && !/\bgit\b/.test(command)) {
    return true;
  }

  // ls/stat with glob patterns exit 2 when no files match the glob.
  // e.g., `ls agents/*/domain.md` exits 2 if no agent has domain.md.
  // This is normal exploration, not an error worth chaining.
  if (code === 2 && /\bls\b/.test(command) && /[*?\[\]]/.test(command)) {
    return true;
  }

  // git add with nothing to add (exit 1) and git commit with nothing to commit
  // (exit 1) are normal workflow outcomes, not errors.
  if (code === 1 && /\bgit\s+(add|commit)\b/.test(command)) {
    return true;
  }

  // wc on non-existent files or wc piped through failing commands — exit 1
  // is informational (0 count), not a real error.
  if (code === 1 && /\bwc\b/.test(command)) {
    return true;
  }

  return false;
}

/**
 * Check if a tool result represents the tool's OWN error output format,
 * as opposed to data content that happens to contain error-like strings.
 */
function isToolOwnError(toolName: string, resultText: string, args?: Record<string, unknown>): boolean {
  if (toolName === "read") {
    return resultText.startsWith("Error reading file:");
  }

  if (toolName === "exec") {
    const stripped = resultText.replace(/^CWD:[^\n]*\n/, "");
    const exitMatch = stripped.match(/^Exit code (\S+)/);
    if (!exitMatch) return false;

    const exitCode = exitMatch[1];
    if (exitCode === "0") return false;

    const command = typeof args?.command === "string" ? args.command : "";
    if (command && isExpectedNonZeroExit(command, exitCode, resultText)) {
      return false;
    }

    return true;
  }

  return false;
}

/**
 * Extract causal failure chains from a message sequence.
 *
 * A failure chain starts when a tool call returns an error (ENOENT, exit code != 0, etc.)
 * and the agent makes follow-up calls to recover (find, pwd, ls to discover paths).
 * The chain ends when a call succeeds at the original intent or the agent moves on.
 *
 * This is pure pattern matching — no LLM needed.
 */
export function extractFailureChains(messages: AgentMessage[]): FailureChain[] {
  type CallPair = { tool: string; args: Record<string, unknown>; resultText: string; isError: boolean };
  const pairs: CallPair[] = [];

  const pendingCalls = new Map<string, { name: string; arguments: Record<string, unknown> }>();

  for (const msg of messages) {
    if (!("role" in msg)) continue;

    if (msg.role === "assistant") {
      const content = msg.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (typeof block === "object" && block !== null && "type" in block && block.type === "toolCall") {
            const tc = block as { id: string; name: string; arguments: Record<string, unknown> };
            pendingCalls.set(tc.id, { name: tc.name, arguments: tc.arguments });
          }
        }
      }
    }

    if (msg.role === "toolResult") {
      const tr = msg as {
        toolCallId: string;
        toolName: string;
        content?: Array<{ type: string; text?: string }>;
        isError: boolean;
      };
      const call = pendingCalls.get(tr.toolCallId);
      const toolName = call?.name ?? tr.toolName;
      const callArgs = call?.arguments ?? {};
      const resultText =
        tr.content
          ?.map((c) => (c.type === "text" ? (c.text ?? "") : ""))
          .join("")
          .slice(0, 500) ?? "";
      pairs.push({
        tool: toolName,
        args: callArgs,
        resultText,
        isError:
          tr.isError ||
          isToolOwnError(toolName, resultText, callArgs) ||
          isFindWithNoResults(toolName, callArgs, resultText),
      });
      if (call) pendingCalls.delete(tr.toolCallId);
    }
  }

  const chains: FailureChain[] = [];
  let i = 0;

  while (i < pairs.length) {
    const p = pairs[i];
    if (!p.isError) {
      i++;
      continue;
    }

    const trigger = pairToStep(p);
    const recovery: FailureStep[] = [];
    let resolution: FailureStep | null = null;
    let j = i + 1;

    const originalIntent = detectIntent(p);

    while (j < pairs.length) {
      const next = pairs[j];
      if (isRecoveryAttempt(next, originalIntent)) {
        if (!next.isError && matchesOriginalIntent(next, originalIntent)) {
          resolution = pairToStep(next);
          j++;
          break;
        }
        recovery.push(pairToStep(next));
        j++;
      } else {
        break;
      }
    }

    const wastedCalls = 1 + recovery.length;
    const rootCause = diagnoseRootCause(trigger, recovery, resolution);

    chains.push({ trigger, recovery, resolution, wastedCalls, rootCause });
    i = j;
  }

  return chains;
}

function pairToStep(p: {
  tool: string;
  args: Record<string, unknown>;
  resultText: string;
  isError: boolean;
}): FailureStep {
  return {
    tool: p.tool,
    args: JSON.stringify(p.args).slice(0, 200),
    result: p.resultText.slice(0, 200),
    isError: p.isError,
  };
}

function detectIntent(p: { tool: string; args: Record<string, unknown>; resultText: string }): {
  type: string;
  path?: string;
} {
  if (p.tool === "read" && typeof p.args.path === "string") {
    return { type: "read-file", path: p.args.path };
  }
  if (p.tool === "exec" && typeof p.args.command === "string") {
    return { type: "exec-command" };
  }
  return { type: "unknown" };
}

function isRecoveryAttempt(
  p: { tool: string; args: Record<string, unknown> },
  intent: { type: string; path?: string },
): boolean {
  const cmd = typeof p.args.command === "string" ? p.args.command : "";
  const path = typeof p.args.path === "string" ? p.args.path : "";

  // Filesystem discovery commands — agent is trying to find the right path
  if (p.tool === "exec" && /\b(find|locate|which|pwd|ls|tree|stat)\b/.test(cmd)) return true;

  // Content inspection after failure — agent retrying with different path or approach
  if (p.tool === "exec" && /\b(cat|head|tail|wc)\b/.test(cmd) && intent.type === "exec-command") return true;

  // grep/ag/rg to search for patterns after initial command failed
  if (p.tool === "exec" && /\b(grep|ag|rg)\b/.test(cmd) && intent.type === "exec-command") return true;

  if (p.tool === "read" && intent.type === "read-file" && intent.path) {
    const origFile = intent.path.split("/").pop() ?? "";
    const newFile = path.split("/").pop() ?? "";
    if (origFile && origFile === newFile) return true;
  }

  return false;
}

function matchesOriginalIntent(
  p: { tool: string; args: Record<string, unknown>; isError: boolean },
  intent: { type: string; path?: string },
): boolean {
  if (p.isError) return false;

  if (intent.type === "read-file" && p.tool === "read" && intent.path) {
    const origFile = intent.path.split("/").pop() ?? "";
    const newPath = typeof p.args.path === "string" ? p.args.path : "";
    const newFile = newPath.split("/").pop() ?? "";
    return origFile === newFile;
  }

  return false;
}

function diagnoseRootCause(trigger: FailureStep, recovery: FailureStep[], resolution: FailureStep | null): string {
  if (trigger.tool === "read" && trigger.result.includes("ENOENT")) {
    const guessedPath = trigger.args;
    if (resolution) {
      const resolvedPath = resolution.args;
      return `read tool returned ENOENT for ${guessedPath} with no path hint — agent searched filesystem to find ${resolvedPath}`;
    }
    return `read tool returned ENOENT for ${guessedPath} with no path hint — agent could not find the file`;
  }

  if (trigger.tool === "exec") {
    const cmd = trigger.args.slice(0, 80);
    let cmdStr = "";
    try {
      cmdStr = (JSON.parse(trigger.args) as { command?: string }).command ?? "";
    } catch {
      /* ignore */
    }
    if (/\b(find|locate)\b/.test(cmdStr) && (!trigger.result.trim() || trigger.result.includes("(no output)"))) {
      return `blind filesystem search returned empty: ${cmd} — agent is guessing paths instead of using cwd`;
    }
    return `exec failed: ${cmd} — ${trigger.result.slice(0, 80)}`;
  }

  return `${trigger.tool} failed: ${trigger.result.slice(0, 80)}`;
}

/** Format failure chains as a human-readable section for the evaluation prompt. */
export function formatFailureChains(chains: FailureChain[]): string {
  if (chains.length === 0) return "";

  const lines = [`## Failure Chains (auto-extracted)\n`];
  lines.push(`Found ${chains.length} failure chain(s) — sequences where an error triggered recovery attempts.\n`);

  for (let i = 0; i < chains.length; i++) {
    const c = chains[i];
    lines.push(`### Chain ${i + 1} (${c.wastedCalls} wasted call${c.wastedCalls === 1 ? "" : "s"})`);
    lines.push(`**Root cause:** ${c.rootCause}`);
    lines.push(`**Trigger:** \`${c.trigger.tool}(${c.trigger.args})\` → ${c.trigger.result}`);
    for (const r of c.recovery) {
      lines.push(`  → \`${r.tool}(${r.args})\` → ${r.result || "(empty)"}`);
    }
    if (c.resolution) {
      lines.push(`  → **resolved:** \`${c.resolution.tool}(${c.resolution.args})\` → OK`);
    } else {
      lines.push(`  → **unresolved** (agent gave up or moved on)`);
    }
    lines.push("");
  }

  const totalWasted = chains.reduce((sum, c) => sum + c.wastedCalls, 0);
  lines.push(`**Total wasted calls from failure chains: ${totalWasted}**`);
  lines.push(`\nWhen proposing fixes, address the **root cause** of each chain, not the symptoms.`);
  lines.push(`For example, if the root cause is "read tool returned ENOENT with no path hint",`);
  lines.push(`the fix is in the read tool's error message, not in blocking the recovery commands.`);

  return lines.join("\n");
}
