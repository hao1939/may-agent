import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { SubagentManager } from "./manager.js";
import { readSessionMessages, historyDir } from "./persistence.js";

// ── Types ──────────────────────────────────────────────────────────────

/** Aggregated token usage and cost for a session. */
export interface UsageSummary {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  cost: number; // total cost in dollars
  turns: number; // number of assistant messages
}

export interface EvaluationScores {
  efficiency: number;
  quality: number;
  pattern_detected: boolean;
  pattern_name: string | null;
  total_tool_calls: number;
  productive_calls: number;
  wasted_calls: number;
  verdict: "good" | "acceptable" | "needs_improvement";
}

export interface EvaluationResult {
  scores: EvaluationScores;
  usage: UsageSummary;
  lessons: string | null;
  workflowCode: string | null;
  workflowName: string | null;
  failureChains: FailureChain[];
  raw: string;
}

export interface MaintainAgentOptions {
  manager: SubagentManager;
  agentName: string;        // which agent to maintain
  knowledgeDir: string;     // path to agent's knowledge/
  persistDir: string;       // path to .state/ (reserved for future performance tracking)
  workflowDir?: string;     // path to agent's workflows/ (reserved for future tool health checks)
}

export interface MaintenanceResult {
  lessonsPruned: number;        // how many lessons were consolidated/removed
  suggestions: string[];        // suggested changes for domain.md (human reviews)
  staleItems: string[];         // stale knowledge detected
  toolIssues: string[];         // broken/missing tools detected
}

// ── Usage extraction ───────────────────────────────────────────────────

function extractUsage(messages: AgentMessage[]): UsageSummary {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let totalTokens = 0;
  let cost = 0;
  let turns = 0;

  for (const msg of messages) {
    if ("role" in msg && msg.role === "assistant") {
      const am = msg as AssistantMessage;
      if (am.usage) {
        inputTokens += am.usage.input ?? 0;
        outputTokens += am.usage.output ?? 0;
        cacheReadTokens += am.usage.cacheRead ?? 0;
        cacheWriteTokens += am.usage.cacheWrite ?? 0;
        totalTokens += am.usage.totalTokens ?? 0;
        cost += am.usage.cost?.total ?? 0;
      }
      turns++;
    }
  }

  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens, cost, turns };
}

// ── JSONL helpers ──────────────────────────────────────────────────────

/** Read messages from a JSONL file, skipping corrupted lines. */
function readJsonlMessages(filePath: string): AgentMessage[] {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, "utf-8");
  if (!raw.trim()) return [];
  const messages: AgentMessage[] = [];
  for (const line of raw.trim().split("\n")) {
    try {
      messages.push(JSON.parse(line) as AgentMessage);
    } catch {
      console.warn(`[evaluator] Skipping corrupted JSONL line in ${filePath}`);
    }
  }
  return messages;
}

// ── Failure chain extraction ───────────────────────────────────────────

/** A single step in a failure chain: a tool call and its result. */
export interface FailureStep {
  tool: string;
  args: string;      // compact JSON of arguments
  result: string;    // first 200 chars of result text
  isError: boolean;
}

/** A causal failure chain: trigger error → recovery attempts → eventual resolution. */
export interface FailureChain {
  trigger: FailureStep;       // the tool call that started the chain
  recovery: FailureStep[];    // subsequent attempts to recover
  resolution: FailureStep | null;  // the call that finally succeeded (null if never resolved)
  wastedCalls: number;        // number of calls wasted in this chain
  rootCause: string;          // short description of why the chain started
}

/** Detect `find` or `ls` commands that returned empty — a sign the agent is searching blindly. */
function isFindWithNoResults(toolName: string, args: Record<string, unknown>, resultText: string): boolean {
  if (toolName !== "exec") return false;
  const cmd = typeof args.command === "string" ? args.command : "";
  if (!/\b(find|locate)\b/.test(cmd)) return false;
  // Strip the CWD echo line if present
  const cleaned = resultText.replace(/^CWD:[^\n]*\n?/, "").trim();
  return cleaned === "" || cleaned === "(no output)";
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
  // Also catches: grep -c (outputs "0"), grep -l, grep -r, egrep, fgrep
  // and pipe chains ending in grep (e.g., "cat file | grep pattern")
  if (code === 1) {
    // Direct grep invocation or pipe ending in grep
    if (/\bgrep\b/.test(command)) {
      // Strip CWD prefix and exit code line to get actual output
      const output = resultText.replace(/^CWD:[^\n]*\n?/, "").replace(/^Exit code \d+\n?/, "").trim();
      // grep exit 1 with empty output or just "0" (from grep -c) = no match, not error
      if (output === "" || output === "0") return true;
    }
  }

  // git diff exits 1 when there ARE differences — the diff output is the result.
  // Only exit code 1, not higher codes which indicate actual errors.
  if (code === 1 && /\bgit\s+diff\b/.test(command)) {
    // If the output contains actual diff content, this is success not failure
    if (resultText.includes("diff --git") || resultText.includes("--- a/")) return true;
  }

  // Commands with 2>/dev/null that exit 1 with empty output are intentional
  // "try and see" patterns (e.g., "cat file1 2>/dev/null || cat file2").
  // The agent deliberately suppressed errors, so don't treat as failure.
  if (code === 1 && /2>\/dev\/null/.test(command)) {
    const output = resultText.replace(/^CWD:[^\n]*\n?/, "").replace(/^Exit code \d+\n?/, "").trim();
    if (output === "") return true;
  }

  return false;
}

/**
 * Check if a tool result represents the tool's OWN error output format,
 * as opposed to data content that happens to contain error-like strings.
 *
 * This is a fallback heuristic for when `tr.isError` is not set. The tools
 * in this codebase (`createReadTool`, `createExecTool`) handle errors
 * internally and return error text without setting `isError: true`, so we
 * need to detect their specific error output formats.
 *
 * When `tr.isError` IS set (e.g., by the agent framework when a tool throws),
 * it takes precedence — see the `isError` classification in `extractFailureChains`.
 *
 * This avoids false positives when:
 * - `read` successfully reads a file containing "ENOENT" in its source code
 * - `exec` runs `git diff` and the diff contains "Error reading file" or "Exit code 1"
 * - `exec` runs tests whose names contain error strings
 * - `grep` returns exit 1 (no matches — normal behavior)
 * - `git diff` returns exit 1 (differences found — the output IS the result)
 *
 * The key distinction: tool errors appear at the START of the result text
 * (the tool's own output format), not embedded in data content.
 */
function isToolOwnError(toolName: string, resultText: string, args?: Record<string, unknown>): boolean {
  // read tool error format: "Error reading file: ENOENT: ..."
  // Only match when the result STARTS with this prefix — if the read tool
  // successfully returned file content that happens to contain "ENOENT",
  // the result will NOT start with "Error reading file:".
  if (toolName === "read") {
    return resultText.startsWith("Error reading file:");
  }

  // exec tool error format: the exec tool outputs "Exit code <status>\n..."
  // either at the very start of its result or after a "CWD: <path>\n" prefix
  // (when echoCwd is enabled). Both success and error output may include the
  // CWD prefix, so we strip it before checking for the error pattern.
  //
  // Note: the exec tool does not set `tr.isError` on non-zero exit codes
  // (it catches the error internally and returns text), so this heuristic
  // is the primary detection mechanism for exec failures when `tr.isError`
  // is false.
  if (toolName === "exec") {
    // Strip optional CWD prefix line before checking
    const stripped = resultText.replace(/^CWD:[^\n]*\n/, "");
    const exitMatch = stripped.match(/^Exit code (\S+)/);
    if (!exitMatch) return false;

    const exitCode = exitMatch[1];
    // Exit code 0 is success
    if (exitCode === "0") return false;

    // Check for known non-error exit codes (grep no-match, git diff, etc.)
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
  // Build a flat list of (toolCall, toolResult) pairs in order
  type CallPair = { tool: string; args: Record<string, unknown>; resultText: string; isError: boolean };
  const pairs: CallPair[] = [];

  // Collect tool calls from assistant messages, then match with results
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
      const tr = msg as { toolCallId: string; toolName: string; content?: Array<{ type: string; text?: string }>; isError: boolean };
      const call = pendingCalls.get(tr.toolCallId);
      const toolName = call?.name ?? tr.toolName;
      const callArgs = call?.arguments ?? {};
      const resultText = tr.content
        ?.map((c) => c.type === "text" ? (c.text ?? "") : "")
        .join("")
        .slice(0, 500) ?? "";
      pairs.push({
        tool: toolName,
        args: callArgs,
        resultText,
        isError: tr.isError                                    // Primary: trust the tool's own error flag
          || isToolOwnError(toolName, resultText, callArgs)    // Fallback: tool-specific error output formats
          || isFindWithNoResults(toolName, callArgs, resultText),
      });
      if (call) pendingCalls.delete(tr.toolCallId);
    }
  }

  // Now scan pairs for failure chains
  const chains: FailureChain[] = [];
  let i = 0;

  while (i < pairs.length) {
    const p = pairs[i];
    if (!p.isError) { i++; continue; }

    // Start a chain from this error
    const trigger = pairToStep(p);
    const recovery: FailureStep[] = [];
    let resolution: FailureStep | null = null;
    let j = i + 1;

    // Determine what the agent was trying to do (read a file? run a command?)
    const originalIntent = detectIntent(p);

    // Follow recovery attempts
    while (j < pairs.length) {
      const next = pairs[j];
      // Is this a recovery attempt? (searching for files, checking paths, pwd)
      if (isRecoveryAttempt(next, originalIntent)) {
        if (!next.isError && matchesOriginalIntent(next, originalIntent)) {
          // Found the resolution
          resolution = pairToStep(next);
          j++;
          break;
        }
        recovery.push(pairToStep(next));
        j++;
      } else {
        // Agent moved on to something else — chain ends unresolved
        break;
      }
    }

    const wastedCalls = 1 + recovery.length; // trigger + recovery (resolution is productive)
    const rootCause = diagnoseRootCause(trigger, recovery, resolution);

    chains.push({ trigger, recovery, resolution, wastedCalls, rootCause });
    i = j;
  }

  return chains;
}

function pairToStep(p: { tool: string; args: Record<string, unknown>; resultText: string; isError: boolean }): FailureStep {
  return {
    tool: p.tool,
    args: JSON.stringify(p.args).slice(0, 200),
    result: p.resultText.slice(0, 200),
    isError: p.isError,
  };
}

/** What was the agent trying to do when it failed? */
function detectIntent(p: { tool: string; args: Record<string, unknown>; resultText: string }): { type: string; path?: string } {
  if (p.tool === "read" && typeof p.args.path === "string") {
    return { type: "read-file", path: p.args.path };
  }
  if (p.tool === "exec" && typeof p.args.command === "string") {
    return { type: "exec-command" };
  }
  return { type: "unknown" };
}

/** Is this call a recovery attempt related to the original failure? */
function isRecoveryAttempt(p: { tool: string; args: Record<string, unknown> }, intent: { type: string; path?: string }): boolean {
  const cmd = typeof p.args.command === "string" ? p.args.command : "";
  const path = typeof p.args.path === "string" ? p.args.path : "";

  // find, ls, pwd are almost always recovery/discovery
  if (p.tool === "exec" && /\b(find|locate|which|pwd|ls)\b/.test(cmd)) return true;

  // Reading the same file at a different path
  if (p.tool === "read" && intent.type === "read-file" && intent.path) {
    const origFile = intent.path.split("/").pop() ?? "";
    const newFile = path.split("/").pop() ?? "";
    if (origFile && origFile === newFile) return true;
  }

  return false;
}

/** Does this call achieve what the original trigger was trying to do? */
function matchesOriginalIntent(p: { tool: string; args: Record<string, unknown>; isError: boolean }, intent: { type: string; path?: string }): boolean {
  if (p.isError) return false;

  if (intent.type === "read-file" && p.tool === "read" && intent.path) {
    const origFile = intent.path.split("/").pop() ?? "";
    const newPath = typeof p.args.path === "string" ? p.args.path : "";
    const newFile = newPath.split("/").pop() ?? "";
    return origFile === newFile;
  }

  return false;
}

/** Produce a short root-cause description from the chain. */
function diagnoseRootCause(trigger: FailureStep, recovery: FailureStep[], resolution: FailureStep | null): string {
  // ENOENT on read → path guessing
  if (trigger.tool === "read" && trigger.result.includes("ENOENT")) {
    const guessedPath = trigger.args;
    if (resolution) {
      const resolvedPath = resolution.args;
      return `read tool returned ENOENT for ${guessedPath} with no path hint — agent searched filesystem to find ${resolvedPath}`;
    }
    return `read tool returned ENOENT for ${guessedPath} with no path hint — agent could not find the file`;
  }

  // Exec failure — distinguish find-empty from other exec errors
  if (trigger.tool === "exec") {
    const cmd = trigger.args.slice(0, 80);
    let cmdStr = "";
    try { cmdStr = (JSON.parse(trigger.args) as { command?: string }).command ?? ""; } catch { /* ignore */ }
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

// ── Transcript formatting ──────────────────────────────────────────────

function formatTranscript(messages: AgentMessage[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    if (!("role" in msg)) continue; // skip custom messages
    lines.push(`## ${msg.role}`);

    if (msg.role === "toolResult") {
      const text = msg.content
        ?.map((c) => c.type === "text" ? c.text : "")
        .join("")
        .slice(0, 500) ?? "";
      lines.push(`[tool_result: ${msg.toolName}] ${text}`);
    } else if (typeof msg.content === "string") {
      lines.push(msg.content);
    } else {
      for (const block of msg.content) {
        if (typeof block === "string") {
          lines.push(block);
        } else if (block.type === "text") {
          lines.push(block.text);
        } else if (block.type === "toolCall") {
          const args = JSON.stringify(block.arguments).slice(0, 500);
          lines.push(`[tool_call: ${block.name}] ${args}`);
        } else if (block.type === "thinking") {
          lines.push(`[thinking] ${block.thinking.slice(0, 200)}`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ── Response parsing ───────────────────────────────────────────────────

function parseEvaluation(text: string, usage: UsageSummary): EvaluationResult {
  const result: EvaluationResult = {
    scores: {
      efficiency: 0,
      quality: 0,
      pattern_detected: false,
      pattern_name: null,
      total_tool_calls: 0,
      productive_calls: 0,
      wasted_calls: 0,
      verdict: "needs_improvement",
    },
    usage,
    lessons: null,
    workflowCode: null,
    workflowName: null,
    failureChains: [],
    raw: text,
  };

  // Extract JSON scores block
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.overall && typeof parsed.overall.efficiency === "number") {
        result.scores.efficiency = parsed.overall.efficiency;
        result.scores.quality = parsed.overall.quality;
        result.scores.verdict = parsed.overall.verdict ?? result.scores.verdict;
        if (parsed.agents && typeof parsed.agents === "object") {
          for (const agent of Object.values(parsed.agents) as Array<Record<string, unknown>>) {
            if (typeof agent.productive_calls === "number") result.scores.productive_calls += agent.productive_calls;
            if (typeof agent.wasted_calls === "number") result.scores.wasted_calls += agent.wasted_calls;
          }
          result.scores.total_tool_calls = result.scores.productive_calls + result.scores.wasted_calls;
        }
      }
    } catch {
      // Keep defaults
    }
  }

  // Extract lessons section
  const lessonsMatch = text.match(/### Lessons\s*\n([\s\S]*?)(?=\n### |$)/);
  if (lessonsMatch) {
    const lessons = lessonsMatch[1].trim();
    if (lessons) result.lessons = lessons;
  }

  // Extract workflow code
  const workflowMatch = text.match(/### Workflow Suggestion\s*\n[\s\S]*?```typescript\s*\n([\s\S]*?)\n\s*```/);
  if (workflowMatch) {
    result.workflowCode = workflowMatch[1];
    // Try to extract workflow name from the code
    const nameMatch = result.workflowCode.match(/export const name\s*=\s*["']([^"']+)["']/);
    if (nameMatch) result.workflowName = nameMatch[1];
  }

  return result;
}

// ── Maintenance response parsing ───────────────────────────────────────

function parseMaintenanceResponse(text: string): {
  updatedLessons: string | null;
  report: { lessonsPruned: number; suggestions: string[]; staleItems: string[]; toolIssues: string[] };
} {
  const defaultReport = {
    lessonsPruned: 0,
    suggestions: [] as string[],
    staleItems: [] as string[],
    toolIssues: [] as string[],
  };

  // Extract updated lessons.md content
  let updatedLessons: string | null = null;
  const lessonsMatch = text.match(/###\s+[Uu]pdated\s+lessons\.md\s*\n[\s\S]*?```(?:markdown|md)?\s*\n([\s\S]*?)```/);
  if (lessonsMatch) {
    updatedLessons = lessonsMatch[1].replace(/\n$/, "");
  }

  // Extract maintenance report JSON
  let report = { ...defaultReport };
  const reportMatch = text.match(/###\s+[Mm]aintenance\s+[Rr]eport\s*\n[\s\S]*?```json\s*\n([\s\S]*?)```/);
  if (reportMatch) {
    try {
      const parsed = JSON.parse(reportMatch[1].trim());
      report = { ...defaultReport, ...parsed };
    } catch {
      // Keep defaults
    }
  }

  return { updatedLessons, report };
}

// ── Main function ──────────────────────────────────────────────────────

export interface EvaluateSessionOptions {
  manager: SubagentManager;
  sessionId: string;
  agentName: string;
  workflowUsed: string | null;
  persistDir: string;
  /** Path to the agent's knowledge directory (for appending lessons). */
  knowledgeDir: string;
  /** Path to the agent's workflows directory (for writing suggested workflows). */
  workflowDir?: string;
}

/**
 * Evaluate a completed session using the evaluator agent.
 *
 * 1. Loads the session transcript from JSONL
 * 2. Sends it to the evaluator agent
 * 3. Parses scores, lessons, and workflow suggestions
 * 4. Appends lessons to the agent's knowledge/lessons.md
 * 5. Writes suggested workflow files
 * 6. Saves scores to .state/evaluations/
 */
export async function evaluateSession(opts: EvaluateSessionOptions): Promise<EvaluationResult> {
  const { manager, sessionId, agentName, workflowUsed, persistDir, knowledgeDir, workflowDir } = opts;

  // 1. Load session transcript (check history dir first, then active)
  //    Uses per-line error handling to skip corrupted JSONL lines.
  let messages: AgentMessage[] = [];
  const historyJsonl = join(historyDir(persistDir), sessionId, "session.jsonl");
  messages = readJsonlMessages(historyJsonl);
  if (messages.length === 0) {
    messages = readSessionMessages(persistDir, sessionId);
  }

  if (messages.length === 0) {
    return {
      scores: {
        efficiency: 0, quality: 0, pattern_detected: false, pattern_name: null,
        total_tool_calls: 0, productive_calls: 0, wasted_calls: 0, verdict: "needs_improvement",
      },
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, cost: 0, turns: 0 },
      lessons: null,
      workflowCode: null,
      workflowName: null,
      failureChains: [],
      raw: "(no session transcript found)",
    };
  }

  const transcript = formatTranscript(messages);

  // 2. Extract failure chains (structural, no LLM needed)
  const failureChains = extractFailureChains(messages);
  const failureChainsSection = formatFailureChains(failureChains);

  // 3. Build evaluation prompt
  const prompt = [
    `# Session Evaluation\n`,
    `## Agent: ${agentName}`,
    `## Workflow Used: ${workflowUsed ?? "slow path (no workflow)"}`,
    `## Session ID: ${sessionId}\n`,
    failureChainsSection ? `${failureChainsSection}\n` : "",
    `## Transcript\n${transcript}\n`,
    `## Instructions\nEvaluate this session according to your criteria. Output scores, lessons, and workflow suggestion if applicable.`,
  ].filter(Boolean).join("\n");

  // 4. Run evaluator agent
  const evalSessionId = manager.run("evaluator", prompt);
  const evalResult = await manager.waitFor(evalSessionId);

  const responseText = evalResult?.lastAssistantText ?? "";

  // 5. Compute usage from session messages
  const usage = extractUsage(messages);

  // 6. Parse structured output
  const evaluation = parseEvaluation(responseText, usage);
  evaluation.failureChains = failureChains;

  // 6. Append lessons to agent's knowledge/lessons.md
  if (evaluation.lessons) {
    const lessonsPath = join(knowledgeDir, "lessons.md");
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const header = `\n## Session ${sessionId} (${timestamp})\n`;
    const workflowNote = workflowUsed ? `Workflow: ${workflowUsed}\n` : "";

    if (!existsSync(lessonsPath)) {
      mkdirSync(dirname(lessonsPath), { recursive: true });
      writeFileSync(lessonsPath, `# Lessons\n\nFeedback from evaluator sessions.\n${header}${workflowNote}\n${evaluation.lessons}\n`, "utf-8");
    } else {
      appendFileSync(lessonsPath, `${header}${workflowNote}\n${evaluation.lessons}\n`, "utf-8");
    }
  }

  // 7. Stage workflow if pattern detected (optimizer validates later)
  if (evaluation.workflowCode && evaluation.workflowName) {
    const fileName = evaluation.workflowName.replace(/\s+/g, "-").toLowerCase() + ".ts";
    const stagedDir = join(persistDir, "staged", "workflows");
    mkdirSync(stagedDir, { recursive: true });
    writeFileSync(join(stagedDir, fileName), evaluation.workflowCode, "utf-8");
  }

  // 8. Save scores and usage
  const evalDir = join(persistDir, "evaluations");
  mkdirSync(evalDir, { recursive: true });
  const scoresPath = join(evalDir, `${sessionId}.json`);
  writeFileSync(scoresPath, JSON.stringify({
    ...evaluation.scores,
    usage: evaluation.usage,
    failureChains: evaluation.failureChains,
  }, null, 2), "utf-8");

  return evaluation;
}

// ── Maintenance function ───────────────────────────────────────────────

const DEFAULT_MAINTENANCE_RESULT: MaintenanceResult = {
  lessonsPruned: 0,
  suggestions: [],
  staleItems: [],
  toolIssues: [],
};

/**
 * Prune and consolidate an agent's lessons.md using the evaluator agent.
 *
 * Does NOT modify domain.md — that's human-authored and stable.
 * Instead, returns suggestions for domain.md changes that a human can review.
 *
 * The evaluator:
 * 1. Reads lessons.md (and domain.md for context)
 * 2. Deduplicates, removes obsolete entries
 * 3. Writes pruned lessons.md back
 * 4. Returns suggestions for what should be promoted to domain.md
 */
export async function maintainAgent(opts: MaintainAgentOptions): Promise<MaintenanceResult> {
  const { manager, agentName, knowledgeDir } = opts;

  const lessonsPath = join(knowledgeDir, "lessons.md");
  const domainPath = join(knowledgeDir, "domain.md");

  // Early return if lessons.md doesn't exist or is empty
  if (!existsSync(lessonsPath)) {
    return { ...DEFAULT_MAINTENANCE_RESULT };
  }

  const lessonsContent = readFileSync(lessonsPath, "utf-8");
  if (!lessonsContent.trim()) {
    return { ...DEFAULT_MAINTENANCE_RESULT };
  }

  // Read domain.md for context (read-only — we won't modify it)
  let domainContent = "(no domain.md exists)";
  if (existsSync(domainPath)) {
    domainContent = readFileSync(domainPath, "utf-8");
  }

  // Build maintenance prompt
  const prompt = [
    `# Lessons Maintenance for agent: ${agentName}\n`,
    `## Current domain.md (READ-ONLY — do not rewrite this)\n\`\`\`markdown\n${domainContent}\n\`\`\`\n`,
    `## Current lessons.md (this is what you're pruning)\n\`\`\`markdown\n${lessonsContent}\n\`\`\`\n`,
    [
      `## Instructions`,
      ``,
      `Prune and consolidate the lessons.md for the "${agentName}" agent.`,
      ``,
      `1. Remove duplicate/redundant lessons`,
      `2. Remove lessons already covered in domain.md`,
      `3. Merge similar lessons into single entries`,
      `4. Remove obsolete lessons (references to things that no longer exist)`,
      `5. Keep recent and important lessons`,
      `6. Identify lessons that SHOULD be in domain.md — list as suggestions (human will review)`,
      `7. Check for stale knowledge in domain.md (references to files/APIs that may have changed)`,
      ``,
      `**Do NOT output an updated domain.md.** Domain.md is human-authored.`,
      ``,
      `Respond with exactly these two sections:`,
      ``,
      `### Updated lessons.md`,
      `(fenced markdown block with pruned lessons.md)`,
      ``,
      `### Maintenance Report`,
      `\`\`\`json`,
      `{`,
      `  "lessonsPruned": <number of lessons removed/merged>,`,
      `  "suggestions": ["suggestion for domain.md change", ...],`,
      `  "staleItems": ["stale reference in domain.md", ...],`,
      `  "toolIssues": ["broken/missing tool", ...]`,
      `}`,
      `\`\`\``,
    ].join("\n"),
  ].join("\n");

  // Run evaluator agent
  const evalSessionId = manager.run("evaluator", prompt);
  const evalResult = await manager.waitFor(evalSessionId);

  const responseText = evalResult?.lastAssistantText;
  if (!responseText) {
    return { ...DEFAULT_MAINTENANCE_RESULT };
  }

  // Parse response
  const parsed = parseMaintenanceResponse(responseText);

  // Write pruned lessons.md (only if content was returned)
  if (parsed.updatedLessons !== null) {
    writeFileSync(lessonsPath, parsed.updatedLessons, "utf-8");
  }

  return {
    lessonsPruned: parsed.report.lessonsPruned,
    suggestions: parsed.report.suggestions,
    staleItems: parsed.report.staleItems,
    toolIssues: parsed.report.toolIssues,
  };
}
