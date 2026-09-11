import type { AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { validateToolArguments, type TSchema, type ToolCall } from "@earendil-works/pi-ai";
import { classifyError } from "./classify-error.js";
import { isRetryableEmptyAssistantFailure } from "./manager-utils.js";

export const WORKFLOW_BOUNDED_FINISH_TOOL_CALL_THRESHOLD = 24;
export const WORKFLOW_BOUNDED_FINISH_DEFAULT_WINDOW_MS = 300_000;
export const RESPONSES_STREAM_TERMINAL_ERROR = "OpenAI Responses stream ended before a terminal response event";

export function validateOperationAllowance(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new TypeError("operationAllowance must be a finite positive integer");
  }
  return value;
}

export function shouldAttemptWorkflowFinishRecovery(reason: string | undefined): boolean {
  if (!reason) return false;
  return (
    reason === RESPONSES_STREAM_TERMINAL_ERROR ||
    isRetryableEmptyAssistantFailure(reason) ||
    classifyError(reason) === "infra"
  );
}

export function shouldRequestBoundedWorkflowFinish(
  requireFinish: boolean,
  toolCalls: number,
  alreadyRequested: boolean,
  timing?: { admittedTimeoutMs?: number; elapsedMs?: number; operationAllowance?: number },
): boolean {
  const operationAllowance = validateOperationAllowance(timing?.operationAllowance);
  const threshold = operationAllowance ?? WORKFLOW_BOUNDED_FINISH_TOOL_CALL_THRESHOLD;
  if (!requireFinish || alreadyRequested || toolCalls < threshold) return false;
  // An explicit allowance is the operation boundary. Timeout only governs elapsed runtime.
  if (operationAllowance !== undefined) return true;
  const admittedTimeoutMs = timing?.admittedTimeoutMs;
  if (admittedTimeoutMs === undefined || admittedTimeoutMs <= WORKFLOW_BOUNDED_FINISH_DEFAULT_WINDOW_MS) return true;
  return Math.max(0, timing?.elapsedMs ?? 0) >= admittedTimeoutMs - WORKFLOW_BOUNDED_FINISH_DEFAULT_WINDOW_MS;
}

export function boundedWorkflowFinishPrompt(outputSchema?: TSchema): string {
  return (
    "Bounded completion guardrail: stop expanding the investigation. Use only evidence already gathered and call finish() now with the smallest evidence-honest payload" +
    (outputSchema ? ", including every required schema-validated result field." : ".")
  );
}

export function workflowFinishRecoveryPrompt(outputSchema?: TSchema, reason?: string): string {
  const prefix = shouldAttemptWorkflowFinishRecovery(reason)
    ? "Your last turn ended with a transient runtime/provider failure or no visible answer. "
    : "Your last turn ended with no visible answer. ";
  return (
    prefix +
    "Continue the original bounded assignment within its scope and remaining budget. " +
    "Use the App's instructions and current evidence to choose the next step; inspect current state before repeating an uncertain effect. " +
    "When the evidence supports an outcome, call finish() with all required fields" +
    (outputSchema
      ? ", including the schema-validated result payload. If you are blocked, use finish() with a blocked/partial status and include the required result payload."
      : ".")
  );
}

type RecoveryDisposition = "recovered" | "rejected" | "ineligible" | "already-committed";
export type CapturedFinishRecovery = {
  disposition: RecoveryDisposition;
  toolCallId?: string;
  error?: string;
};

const recoveriesInFlight = new Map<string, Promise<CapturedFinishRecovery>>();

function matchingToolResult(messages: any[], id: string): any | undefined {
  return messages.find((message) => message?.role === "toolResult" && message.toolCallId === id);
}

function capturedAbortedFinish(messages: any[], reason: string | undefined): ToolCall | null {
  if (reason !== RESPONSES_STREAM_TERMINAL_ERROR) return null;
  const assistant = [...messages].reverse().find((message: any) => message?.role === "assistant") as any;
  if (assistant?.stopReason !== "aborted" || assistant.errorMessage !== reason) return null;
  const calls = Array.isArray(assistant.content)
    ? assistant.content.filter((block: any) => block?.type === "toolCall" && block.name === "finish")
    : [];
  if (calls.length !== 1 || typeof calls[0].id !== "string" || !calls[0].id) return null;
  const raw = calls[0].arguments ?? calls[0].args;
  if (raw === undefined) return null;
  try {
    const args = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!args || typeof args !== "object" || Array.isArray(args)) return null;
    return { type: "toolCall", id: calls[0].id, name: "finish", arguments: args } as ToolCall;
  } catch {
    return null;
  }
}

/**
 * Commit a complete finish call captured by the exact Responses aborted-terminal
 * failure. Validation deliberately uses Pi's normal schema validator followed by
 * the real workflow finish tool, whose execute path performs semantic checks.
 */
export async function recoverCapturedWorkflowFinish(options: {
  sessionId: string;
  messages: AgentMessage[];
  tools: AgentTool[];
  reason?: string;
}): Promise<CapturedFinishRecovery> {
  const call = capturedAbortedFinish(options.messages as any[], options.reason);
  if (!call) return { disposition: "ineligible" };
  if (matchingToolResult(options.messages as any[], call.id)) {
    return { disposition: "already-committed", toolCallId: call.id };
  }
  const identity = `${options.sessionId}:${call.id}`;
  const existing = recoveriesInFlight.get(identity);
  if (existing) return existing;

  const recovery = (async (): Promise<CapturedFinishRecovery> => {
    const finish = options.tools.find((tool) => tool.name === "finish");
    if (!finish) return { disposition: "rejected", toolCallId: call.id, error: "finish tool unavailable" };
    let result: Awaited<ReturnType<AgentTool["execute"]>>;
    try {
      const params = validateToolArguments(finish, call);
      result = await finish.execute(call.id, params);
    } catch (cause) {
      const error = `Captured finish recovery validation failed: ${cause instanceof Error ? cause.message : String(cause)}`;
      options.messages.push({
        role: "toolResult",
        toolCallId: call.id,
        toolName: "finish",
        content: [{ type: "text", text: error }],
        isError: true,
        timestamp: Date.now(),
      } as any);
      return { disposition: "rejected", toolCallId: call.id, error };
    }

    const semanticError = result.content.find(
      (block: any) =>
        block?.type === "text" &&
        String(block.text ?? "")
          .trimStart()
          .startsWith("finish() error:"),
    );
    options.messages.push({
      role: "toolResult",
      toolCallId: call.id,
      toolName: "finish",
      content: result.content,
      isError: Boolean(semanticError),
      timestamp: Date.now(),
    } as any);
    return semanticError
      ? { disposition: "rejected", toolCallId: call.id, error: String((semanticError as any).text) }
      : { disposition: "recovered", toolCallId: call.id };
  })();
  recoveriesInFlight.set(identity, recovery);
  try {
    return await recovery;
  } finally {
    recoveriesInFlight.delete(identity);
  }
}
