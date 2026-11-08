import type { TaskFundingConstraint } from "../state/task-budget-admission.js";
import type { TaskAcceptanceBasis } from "@may-agent/sdk";
import type { AppTaskClaim } from "./app-task-reconciler.js";
import type { PreparedTaskWorkspace } from "./workspace.js";
import {
  admitTaskReconcileResult as admitAppTaskHandlerResult,
  type TaskAction as AppTaskAction,
  type Condition as AppTaskConditionSpec,
  type TaskAppRequest,
  type TaskCondition,
  type TaskCommunication,
  type TaskVerifier as AppTaskVerifier,
} from "@may-agent/sdk";
import type { ConversationTaskProposal } from "../state/conversation-task-turns.js";

export type TaskCapabilityRun = {
  handlerResult: NormalizedTaskHandlerResult;
  runId: string | null;
  /** Live Task events incorporated into this attempt's candidate result. */
  acceptedLiveEventIds?: number[];
  verifier?: { name: string; sourcePath: string; verify: AppTaskVerifier };
  unavailable?: boolean;
  executionFailed?: boolean;
  /** A managed operation did not start; preserve work without execution failure. */
  funding?: TaskFundingConstraint;
  /** The workflow reported a blocker; retain its diagnosis for the next reconciliation. */
  handlerBlocked?: true;
  workspacePreparationFailed?: boolean;
  conversation?: ConversationTaskProposal;
};

/** Execution is over; retry only the fenced effects, never the executor. */
export type PendingTaskSettlement = {
  claim: Omit<AppTaskClaim, "settlement">;
  report: Pick<TaskCapabilityRun, "handlerResult" | "runId" | "conversation" | "acceptedLiveEventIds">;
  acceptanceBasis: TaskAcceptanceBasis;
  workspace?: PreparedTaskWorkspace;
};

export type NormalizedTaskHandlerResult = {
  /** `error` is an attempt/runtime outcome, never a valid handler decision. */
  state: "converged" | "waiting" | "incomplete" | "error";
  /** A rejected contract needs correction, not a transport retry. Host-only. */
  resultRejected?: true;
  inputKeys?: string[];
  summary: string;
  response?: string;
  report?: true;
  continue?: true;
  result?: Record<string, unknown>;
  reviewAt?: number;
  facts: string[];
  actions: AppTaskAction[];
  conditions?: TaskCondition[];
  requests?: TaskAppRequest[];
  communication?: TaskCommunication[];
};

export function normalizeTaskHandlerResult(
  output: unknown,
  fallback: { type: "done" | "blocked"; summary: string; runId: string | null },
  options: {
    validateAction?: (action: AppTaskAction) => string | null;
    validateCondition?: (condition: AppTaskConditionSpec) => string | null;
  } = {},
): NormalizedTaskHandlerResult {
  if (output === undefined && fallback.type === "blocked") {
    return {
      state: "error",
      summary: fallback.summary,
      facts: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  const admission = admitAppTaskHandlerResult(output);
  if (!admission.ok) {
    return {
      state: "error",
      resultRejected: true,
      summary: `Handler result was rejected: ${admission.error}`,
      facts: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  const actions = admission.result.actions ?? [];
  if (options.validateAction) {
    for (let index = 0; index < actions.length; index += 1) {
      const problem = options.validateAction(actions[index]!);
      if (problem) {
        return {
          state: "error",
          resultRejected: true,
          summary: `Handler result was rejected: actions[${index}] ${problem}`,
          facts: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
          actions: [],
        };
      }
    }
  }
  const conditions = admission.result.conditions ?? [];
  if (options.validateCondition) {
    for (let index = 0; index < conditions.length; index += 1) {
      const condition = conditions[index]!;
      if ("requestId" in condition) continue; // Host-owned request completion, not an App observation.
      const problem = options.validateCondition(condition);
      if (problem) {
        return {
          state: "error",
          resultRejected: true,
          summary: `Handler result was rejected: conditions[${index}] ${problem}`,
          facts: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
          actions: [],
        };
      }
    }
  }
  return {
    ...admission.result,
    actions,
  };
}
