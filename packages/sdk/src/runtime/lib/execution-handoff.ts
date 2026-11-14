import { ExecutionDeferredError, type ExecutionResult } from "@may-agent/sdk";
import type { TaskResult } from "./types.js";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { CliCallFacts } from "@may-agent/sdk";

export function cliCallFacts(sessionId: string, messages: AgentMessage[]): CliCallFacts[] {
  const calls = new Map<string, CliCallFacts>();
  for (const message of messages) {
    if (message.role !== "toolResult" || message.toolName !== "run_cli_agent") continue;
    const call = (message.details as { cliCall?: CliCallFacts } | undefined)?.cliCall;
    if (!call || call.sessionId !== sessionId || call.toolCallId !== message.toolCallId) continue;
    if (!call.taskId || (call.tool !== "codex" && call.tool !== "claude")) continue;
    if (call.status !== "completed" && call.status !== "failed") continue;
    if (!call.resultPath || !call.structuredResultPath || !call.eventsPath) continue;
    calls.set(call.taskId, call);
  }
  return [...calls.values()].slice(-64);
}

export type WorkflowToolResult = (
  | { type: "done"; summary: string; output?: unknown; facts?: unknown }
  | { type: "blocked"; reason: string; context?: unknown; output?: unknown; facts?: unknown }
  | { type: "error"; error: string; partialContext?: string; output?: unknown; facts?: unknown }
  | { type: "interrupted"; steeringMessage: string; output?: unknown; facts?: unknown }
  | { type: "list"; workflows: { name: string; description: string; inputSchema?: Record<string, unknown> }[] }
) & {
  workflowRunId?: string;
  sessionIds?: string[];
};

/** Enforce required finish() and optional schema-backed result payload on workflow prompt steps. */
export function enforceStructuredWorkflowResult(result: TaskResult, expectsPayload: boolean): TaskResult {
  if (result.status !== "done") return result;
  if (!result.finishResult) {
    return {
      ...result,
      status: "error",
      error: "Workflow agent step completed without the required finish() result",
    };
  }
  if (expectsPayload && result.structuredResult === undefined && result.finishResult.result === undefined) {
    return {
      ...result,
      status: "error",
      error: "Workflow agent step completed without the required schema-backed finish().result payload",
    };
  }
  return result;
}

/** Project execution evidence for callers; never accepts the owning Task. */
export function agentExecutionResult(result: TaskResult): ExecutionResult {
  if (!result.sessionId) throw new Error(result.error || result.errorMessage || "Agent call did not start an execution");
  const finish = result.finishResult;
  const status = result.status === "interrupted"
    ? "interrupted"
    : result.status === "error" || finish?.status === "failure"
      ? "error"
      : finish?.status === "blocked" || finish?.status === "partial"
        ? "blocked"
        : "done";
  return {
    id: result.sessionId,
    kind: "agent",
    status,
    summary:
      (result.status === "error" ? result.error?.trim() || result.errorMessage?.trim() : undefined) ||
      finish?.summary?.trim() || result.lastAssistantText?.trim() || result.error?.trim() ||
      `Agent execution ${status}`,
    ...(result.structuredResult !== undefined
      ? { output: result.structuredResult }
      : finish?.result !== undefined ? { output: finish.result } : {}),
    ...(finish ? { facts: finish } : {}),
    cliCalls: cliCallFacts(result.sessionId, result.messages),
  };
}

/** Setup failures have no execution identity. Do not fabricate an evidence link. */
export function workflowExecutionResult(result: WorkflowToolResult): ExecutionResult | undefined {
  if (result.type === "list" || !result.workflowRunId) return undefined;
  return {
    id: result.workflowRunId,
    kind: "workflow",
    status: result.type,
    summary: result.type === "done" ? result.summary
      : result.type === "blocked" ? result.reason
        : result.type === "interrupted" ? result.steeringMessage : result.error,
    ...(result.output !== undefined ? { output: result.output } : {}),
    ...(result.facts !== undefined ? { facts: result.facts }
      : result.type === "blocked" && result.context !== undefined ? { facts: result.context } : {}),
  };
}

/** Model tools expose non-start as data without fabricating a terminal result ID. */
export function deferredExecutionResult(error: ExecutionDeferredError) {
  return {
    status: "deferred" as const,
    started: false as const,
    summary: error.message,
    deferral: error.deferral,
    ...(error.callerExecution ? { callerExecution: error.callerExecution } : {}),
  };
}
