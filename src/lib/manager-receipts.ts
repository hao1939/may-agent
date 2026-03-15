/**
 * manager-receipts.ts — HMAC tool receipt signing, verification, and tool wrapping.
 *
 * Extracted from manager.ts for maintainability. Contains:
 * - HMAC signing/verification (P84)
 * - Tool wrapping with receipt signing, OpBudget enforcement (P85),
 *   Tool Pivot Heuristic (P110), and Turn Budget Warning
 * - verify_receipt built-in tool
 * - Operation usage query
 */

import { randomUUID, createHmac } from "node:crypto";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import {
  isToolError,
  computeToolArgsKey,
  STATE_CHANGING_TOOLS,
  TOOL_PIVOT_LIMIT,
} from "./manager-utils.js";
import type { ActiveSession } from "./manager-utils.js";
import { sessionDir } from "./persistence.js";
import { ConcurrencyGate, HIGH_IMPACT_TOOLS } from "./concurrency-gate.js";

/** Runtime-generated HMAC secret for tool receipt signing.
 *  Generated once per process — receipts are verifiable within the same runtime.
 *  For cross-process verification, replace with a persisted secret. */
const RUNTIME_RECEIPT_SECRET = randomUUID();

/** P113: Cost Signal thresholds — inject cost metadata when exceeded. */
export const COST_SIGNAL_DURATION_MS = 2000;
export const COST_SIGNAL_BYTES = 10000;

/**
 * Sign a tool output string with HMAC-SHA256.
 *
 * Algorithm (from spec):
 *   1. Generate `timestamp` (Unix epoch seconds).
 *   2. Compute `H = HMAC_SHA256(output + timestamp, RUNTIME_RECEIPT_SECRET)`.
 *   3. Truncate `H` to 8 hex chars.
 *   4. Return `output + "\n[SIG: <timestamp>:<H>]"`.
 *
 * The secret never leaves the runtime — agents see only the signature tag.
 */
export function signToolOutput(output: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const hmac = createHmac("sha256", RUNTIME_RECEIPT_SECRET)
    .update(output + timestamp)
    .digest("hex")
    .slice(0, 8);
  return `${output}\n[SIG: ${timestamp}:${hmac}]`;
}

/**
 * Verify a tool output signature.
 *
 * @param content   - The exact text content (everything before the `[SIG: ...]` tag).
 * @param signature - The `timestamp:hash` string extracted from the `[SIG: ...]` tag.
 * @returns `true` if the signature is valid, `false` otherwise.
 */
export function verifyToolOutput(content: string, signature: string): boolean {
  const sepIdx = signature.indexOf(":");
  if (sepIdx === -1) return false;
  const timestamp = signature.slice(0, sepIdx);
  const hash = signature.slice(sepIdx + 1);
  if (!timestamp || !hash) return false;

  const expected = createHmac("sha256", RUNTIME_RECEIPT_SECRET)
    .update(content + timestamp)
    .digest("hex")
    .slice(0, 8);
  return expected === hash;
}

/**
 * Create the `verify_receipt` built-in tool.
 *
 * Agents (Evaluator, QA, Manager) use this to verify that a tool output
 * is authentic and was not hallucinated. The tool recomputes the HMAC
 * using the process-internal secret and returns "VALID" or "INVALID".
 */
export function createVerifyReceiptTool(): AgentTool {
  const VerifyReceiptParams = Type.Object({
    content: Type.String({ description: "The exact content of the tool output (everything before the [SIG: ...] line)." }),
    signature: Type.String({ description: "The signature string (e.g., '1741789000:a1b2c3d4')." }),
  });

  return {
    name: "verify_receipt",
    label: "Verify Receipt",
    description: "Verify that a tool output is authentic and not hallucinated. Returns VALID or INVALID.",
    parameters: VerifyReceiptParams,
    execute: async (_toolCallId, params) => {
      const { content, signature } = params as { content: string; signature: string };
      const valid = verifyToolOutput(content, signature);
      const text = valid ? "VALID" : "INVALID";
      return {
        content: [{ type: "text", text }],
        details: text,
      };
    },
  };
}

/** Context needed by wrapToolsWithReceipts — injected by SubagentManager. */
export interface ReceiptWrapContext {
  activeSessions: Map<string, ActiveSession>;
  persistDir: string;
  /** Project root for resolving agent paths (P114). */
  projectRoot: string;
  /** P162: Optional concurrency gate for high-impact tools. */
  concurrencyGate?: ConcurrencyGate;
}

/**
 * Wrap an array of tools with HMAC receipt signing.
 *
 * Every tool's execute function is intercepted: after the original tool
 * returns, the text output is signed with `signToolOutput()` which appends
 * `\n[SIG: <timestamp>:<hash>]` to the output. A receipt log entry is also
 * written to `receipts.jsonl` in the session directory (best-effort).
 *
 * The LLM never sees the signing key — only the signature tag.
 *
 * P85: Also enforces operation budgets — state-changing tools (bash, write, edit, commit)
 * are counted and blocked when the budget is exceeded.
 *
 * P84: Tool outputs are wrapped in `<tool_output name="...">...</tool_output>` tags
 * to structurally contain tool output and prevent prompt injection.
 */
export function wrapToolsWithReceipts(
  tools: AgentTool[],
  sessionId: string,
  ctx: ReceiptWrapContext,
): AgentTool[] {
  return tools.map((tool) => ({
    ...tool,
    execute: async (
      toolCallId: string,
      params: any,
      signal?: AbortSignal,
      onUpdate?: any,
    ): Promise<AgentToolResult<any>> => {
      // P85: Operation budget enforcement — check before executing state-changing tools
      const isStateChanging = STATE_CHANGING_TOOLS.has(tool.name);
      if (isStateChanging) {
        const session = ctx.activeSessions.get(sessionId);
        if (session && session.opBudget > 0 && session.opCount >= session.opBudget) {
          console.error(`OpBudgetExceeded: Agent ${session.agentName} consumed ${session.opCount} ops (limit ${session.opBudget}). Stopping.`);
          console.log(JSON.stringify({ type: 'OpBudgetExceeded', agent: session.agentName, sessionId, limit: session.opBudget, opCount: session.opCount }));

          // P85: Mark session as errored so handleCompletion archives it
          // with status "error" instead of "done". This makes OpBudget
          // exhaustion visible in delegation-metrics (ISR/TSR).
          session.error = `OpBudgetExceeded: Limit ${session.opBudget} reached.`;

          return {
            content: [{ type: "text" as const, text: `OpBudgetExceeded: Agent ${session.agentName} consumed ${session.opCount}/${session.opBudget} state-changing operations. Further writes are blocked. Use read-only tools or request re-authorization.` }],
            details: undefined,
          };
        }
      }

      // P110: Tool Pivot Heuristic — block after TOOL_PIVOT_LIMIT identical failures
      const pivotKey = computeToolArgsKey(tool.name, params);
      const session = ctx.activeSessions.get(sessionId);
      if (session) {
        const failCount = session.toolErrorHistory.get(pivotKey) ?? 0;
        if (failCount >= TOOL_PIVOT_LIMIT) {
          const agentName = session.agentName;
          console.error(`E_RETRY_LIMIT: Agent ${agentName} repeated ${tool.name} with identical args ${failCount} times. Blocked.`);
          console.log(JSON.stringify({ type: 'E_RETRY_LIMIT', agent: agentName, sessionId, tool: tool.name, argsHash: pivotKey, attempts: failCount }));
          return {
            content: [{ type: "text" as const, text: `🚫 E_RETRY_LIMIT: This exact tool call (${tool.name}) has failed ${failCount} times with identical arguments. Execution blocked. You MUST use a different approach — change the tool, change the arguments, or change your strategy entirely.` }],
            details: undefined,
          };
        }
      }

      // Execute the original tool (with timing for P113 Cost Signal)
      const execStartMs = Date.now();

      // P162: Concurrency Gate — serialize high-impact tool execution
      const isHighImpact = HIGH_IMPACT_TOOLS.has(tool.name);
      let release: (() => void) | null = null;
      if (isHighImpact && ctx.concurrencyGate) {
        try {
          release = await ctx.concurrencyGate.acquire();
        } catch (e: any) {
          console.error(`P162_GATE_TIMEOUT: ${tool.name} for session ${sessionId}: ${e.message}`);
          return {
            content: [{ type: "text" as const, text: `⏳ System Busy: Another high-impact tool is running. Please retry in a few seconds.` }],
            details: undefined,
          };
        }
      }

      let result: AgentToolResult<any>;
      try {
        result = await tool.execute(toolCallId, params, signal, onUpdate);
      } finally {
        if (release) release();
      }
      const execDurationMs = Date.now() - execStartMs;

      // P85: Increment opCount for state-changing tools after successful execution
      if (isStateChanging) {
        const session = ctx.activeSessions.get(sessionId);
        if (session) {
          session.opCount++;
        }
      }

      // Extract the plain text output from all text blocks
      const outputText = result.content
        .map((block: any) => (block?.type === "text" ? block.text : ""))
        .join("");

      // P110: Tool Pivot Heuristic — track errors and inject critique
      let pivotCritique = "";
      if (session) {
        if (isToolError(outputText)) {
          const currentCount = (session.toolErrorHistory.get(pivotKey) ?? 0) + 1;
          session.toolErrorHistory.set(pivotKey, currentCount);
          session.toolErrorCount++; // P20 Tainted Handoffs: total error count
          if (currentCount < TOOL_PIVOT_LIMIT) {
            pivotCritique = `\n\n⚠️ PIVOT REQUIRED: This exact tool call has failed ${currentCount} time(s). You must change your approach — use a different tool, different arguments, or a different strategy. Do NOT retry the same command.`;
          }
        } else {
          // Success — clear the counter for this key
          session.toolErrorHistory.delete(pivotKey);
        }
      }

      // Sign the output using the spec's HMAC scheme
      const signed = signToolOutput(outputText);

      // The signed string = outputText + "\n[SIG: ts:hash]"
      // Extract just the SIG tag to log it
      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      const signature = sigMatch ? sigMatch[1] : "";

      // Log to receipts.jsonl (best-effort)
      try {
        const receiptEntry = {
          toolName: tool.name,
          toolCallId,
          signature,
          timestamp: new Date().toISOString(),
        };
        const receiptsPath = join(
          sessionDir(ctx.persistDir, sessionId),
          "receipts.jsonl",
        );
        appendFileSync(receiptsPath, JSON.stringify(receiptEntry) + "\n", "utf-8");
      } catch {
        /* best-effort — never block tool execution for logging */
      }

      // P113: Cost Signal — inject cost note when tool is expensive (>2s or >10KB)
      const outputBytes = outputText.length;
      let costSignal = "";
      if (execDurationMs > COST_SIGNAL_DURATION_MS || outputBytes > COST_SIGNAL_BYTES) {
        const kb = (outputBytes / 1024).toFixed(1);
        costSignal = `\n\n<system_note>[COST: ${execDurationMs}ms, ${kb}KB]</system_note>`;
      }

      // P84: Wrap in <tool_output> tags with SIG receipt inside
      const sigTag = signed.slice(outputText.length); // "\n[SIG: ts:hash]"
      const openTag = { type: "text" as const, text: `<tool_output name="${tool.name}">` };
      const receiptSuffix = { type: "text" as const, text: sigTag };
      const critiqueBlock = pivotCritique ? { type: "text" as const, text: pivotCritique } : null;
      const costBlock = costSignal ? { type: "text" as const, text: costSignal } : null;
      const closeTag = { type: "text" as const, text: "</tool_output>" };
      const contentBlocks = [openTag, ...result.content, receiptSuffix];
      if (critiqueBlock) contentBlocks.push(critiqueBlock);
      if (costBlock) contentBlocks.push(costBlock);

      // Turn Budget Warning: inject once when turn count reaches threshold
      if (session && session.turnBudgetWarningAt > 0 && !session.turnBudgetWarned && session.turnCount >= session.turnBudgetWarningAt) {
        session.turnBudgetWarned = true;
        const warningText = `\n\n⚠️ [SYSTEM WARNING: Turn Budget ${session.turnCount}/${session.turnBudgetWarningAt}] You have used ${session.turnCount} turns. Wrap up your current task — summarize progress, write any pending output, and finish. Do NOT start new exploratory work.`;
        contentBlocks.push({ type: "text" as const, text: warningText });
      }

      contentBlocks.push(closeTag);

      return {
        ...result,
        content: contentBlocks,
      };
    },
  }));
}

/**
 * P85: Get current operation usage for a session.
 * Returns { opBudget, opCount } or null if session doesn't exist.
 */
export function getOpUsage(
  activeSessions: Map<string, ActiveSession>,
  sessionId: string,
): { opBudget: number; opCount: number } | null {
  const session = activeSessions.get(sessionId);
  if (!session) return null;
  return { opBudget: session.opBudget, opCount: session.opCount };
}
