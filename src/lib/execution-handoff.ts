import type { ExecutionResult } from "@may-agent/sdk";
import type { TaskResult } from "./types.js";
import type { WorkflowToolResult } from "./workflow.js";
import { cliCallFacts } from "./tools/run-cli-agent.js";

/** Project execution evidence for callers; never accepts the owning Task. */
export function agentExecutionResult(result: TaskResult): ExecutionResult {
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
    ...(result.type === "done" && result.output !== undefined ? { output: result.output } : {}),
    ...(result.type === "blocked" && result.context !== undefined ? { facts: result.context } : {}),
  };
}
