import {
  admitTaskReconcileResult as admitAppTaskHandlerResult,
  type TaskAction as AppTaskAction,
  type Condition as AppTaskConditionSpec,
  type TaskAppDependency,
  type TaskVerifier as AppTaskVerifier,
} from "@may-agent/sdk";

export type TaskCapabilityRun = {
  handlerResult: NormalizedTaskHandlerResult;
  runId: string | null;
  /** Live Task events incorporated into this attempt's candidate result. */
  acceptedLiveEventIds?: number[];
  verifier?: { name: string; sourcePath: string; verify: AppTaskVerifier };
  unavailable?: boolean;
  executionFailed?: boolean;
  /** The workflow reported a blocker; retain its diagnosis for the next reconciliation. */
  handlerBlocked?: true;
  workspacePreparationFailed?: boolean;
};

export type NormalizedTaskHandlerResult = {
  /** `error` is an attempt/runtime outcome, never a valid handler decision. */
  state: "converged" | "waiting" | "needs-agent" | "stopped" | "error";
  /** A rejected contract needs correction, not a transport retry. Host-only. */
  resultRejected?: true;
  summary: string;
  response?: string;
  result?: Record<string, unknown>;
  evidence: string[];
  actions: AppTaskAction[];
  conditions?: AppTaskConditionSpec[];
  dependencies?: TaskAppDependency[];
};

export function normalizeTaskHandlerResult(
  output: unknown,
  fallback: { type: "done" | "blocked"; summary: string; runId: string | null },
  options: {
    allowNeedsAgent?: boolean;
    defaultParentId?: string;
    rootParentAliases?: string[];
    validateAction?: (action: AppTaskAction) => string | null;
    validateCondition?: (condition: AppTaskConditionSpec) => string | null;
  } = {},
): NormalizedTaskHandlerResult {
  if (output === undefined && fallback.type === "blocked") {
    return {
      state: "error",
      summary: fallback.summary,
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  const admission = admitAppTaskHandlerResult(output, {
    allowNeedsAgent: options.allowNeedsAgent ?? true,
    defaultParentId: options.defaultParentId ?? "project",
    rootParentAliases: options.rootParentAliases,
  });
  if (!admission.ok) {
    return {
      state: "error",
      resultRejected: true,
      summary: `Handler result was rejected: ${admission.error}`,
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
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
          evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
          actions: [],
        };
      }
    }
  }
  const conditions = admission.result.conditions ?? [];
  if (options.validateCondition) {
    for (let index = 0; index < conditions.length; index += 1) {
      const problem = options.validateCondition(conditions[index]!);
      if (problem) {
        return {
          state: "error",
          resultRejected: true,
          summary: `Handler result was rejected: conditions[${index}] ${problem}`,
          evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
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
