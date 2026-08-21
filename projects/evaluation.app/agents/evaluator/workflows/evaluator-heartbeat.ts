import {
  admitTaskReconcileResult,
  taskOwnerResultSchema,
  type ExecutionResult,
  type TaskAction,
  type TaskReconcileResult,
  type TaskReconciliationContext,
  type WorkflowContext,
} from "@may-agent/sdk";
import { taskEmissionKey } from "./lib/task-emission.js";

export const name = "evaluator-heartbeat";
export const description =
  "Review evaluation.app's bounded reconciliation state and propose typed child-task changes.";

type OwnerReviewInput = {
  scope?: string;
};

type OwnerResult = Exclude<TaskReconcileResult, { state: "needs-owner" }>;

function truncate(value: unknown, max = 600): string {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function fallbackResult(summary: string, evidence: string[]): OwnerResult {
  return {
    state: "converged",
    summary,
    evidence: evidence.slice(0, 32),
    actions: [],
  };
}

function allowedExistingTarget(
  action: Exclude<TaskAction, { kind: "create-task" }>,
  reconciliation: TaskReconciliationContext<OwnerReviewInput>,
): string | null {
  if (action.taskId.startsWith("runtime/")) {
    return `${action.kind} cannot mutate reconciler-owned task ${action.taskId}`;
  }
  const target = reconciliation.children.live.find(
    (child) => child.taskId === action.taskId,
  );
  if (!target) {
    return `${action.kind} ${action.taskId} does not target a live direct child`;
  }
  if (action.expectedGeneration !== target.generation) {
    return `${action.kind} ${action.taskId} expected generation ${action.expectedGeneration} but current generation is ${target.generation}`;
  }
  if (
    (action.kind === "update-task" || action.kind === "unblock-task") &&
    target.status !== "waiting" &&
    target.status !== "attention"
  ) {
    return `${action.kind} ${action.taskId} requires waiting or attention, not ${target.status}`;
  }
  return null;
}

function actionRejection(
  action: TaskAction,
  reconciliation: TaskReconciliationContext<OwnerReviewInput>,
): string | null {
  if (action.kind === "create-task") {
    if (action.id.startsWith("runtime/")) {
      return `create-task cannot create reconciler-owned task ${action.id}`;
    }
    if (action.parentId !== reconciliation.taskId) {
      return `create-task ${action.id} must remain under ${reconciliation.taskId}`;
    }
    return null;
  }
  return allowedExistingTarget(action, reconciliation);
}

export function normalizeOwnerResult(
  output: unknown,
  reconciliation: TaskReconciliationContext<OwnerReviewInput>,
): OwnerResult {
  const admission = admitTaskReconcileResult(output, {
    allowNeedsOwner: false,
    defaultParentId: reconciliation.taskId,
    rootParentAliases: ["evaluation", "evaluation.app"],
  });
  if (admission.ok === false) {
    return fallbackResult(
      `Owner review returned an invalid structured result; preserving current desired state. ${admission.error}`,
      [`owner-result-rejected:${truncate(admission.error, 400)}`],
    );
  }

  const admitted = admission.result as OwnerResult;
  if (
    admitted.state === "waiting" &&
    (!admitted.conditions || admitted.conditions.length === 0)
  ) {
    return fallbackResult(
      `Owner review returned waiting without an exact Condition; preserving current desired state. ${admitted.summary}`,
      [
        ...admitted.evidence,
        "owner-result-rejected:waiting requires at least one exact Condition",
      ],
    );
  }
  const rejected = (admitted.actions ?? [])
    .map((action) => ({
      action,
      reason: actionRejection(action, reconciliation),
    }))
    .filter(
      (entry): entry is { action: TaskAction; reason: string } =>
        entry.reason !== null,
    );
  if (rejected.length === 0) return admitted;

  const rejectedActions = new Set(rejected.map((entry) => entry.action));
  return {
    ...admitted,
    summary: `Filtered ${rejected.length} out-of-scope or stale child-task action(s); ${admitted.summary}`,
    evidence: [
      ...admitted.evidence,
      ...rejected.map((entry) => `filtered-action:${entry.reason}`),
    ].slice(0, 32),
    actions: (admitted.actions ?? []).filter(
      (action) => !rejectedActions.has(action),
    ),
  };
}

function ownerPacket(
  input: OwnerReviewInput,
  reconciliation: TaskReconciliationContext<OwnerReviewInput>,
): Record<string, unknown> {
  return {
    appId: reconciliation.appId,
    taskId: reconciliation.taskId,
    generation: reconciliation.generation,
    resourceVersion: reconciliation.resourceVersion,
    owner: reconciliation.owner,
    mode: reconciliation.mode,
    outcome: reconciliation.outcome,
    acceptance: reconciliation.acceptance,
    input,
    trigger: reconciliation.trigger ?? null,
    children: reconciliation.children,
  };
}

function ownerPrompt(packet: Record<string, unknown>): string {
  return [
    "You are the accountable owner of evaluation.app.",
    "Review only the supplied reconciliation facts and return one structured task result.",
    "Do not query global task state, inspect runtime SQL, edit files, send messages, or dispatch work.",
    "Create child work only for evaluation.app's own audit-system responsibility.",
    "Findings about another project belong in that project's owner-facing delivery path, not evaluator remediation tasks.",
    "Existing child mutations must use the exact supplied generation.",
    "Never create or mutate task IDs beginning with runtime/.",
    "Use waiting only with exact Conditions. Every Condition subject must use the canonical typed-subject form <type>:<id> (for example task:child-id, session:s_123, event:5011463, or project:evaluation); an unprefixed subject is invalid.",
    "If desired state is already represented, return converged with no actions.",
    "Finish with result matching this JSON schema:",
    JSON.stringify(taskOwnerResultSchema),
    "Reconciliation packet:",
    JSON.stringify(packet, null, 2),
  ].join("\n\n");
}

export async function execute(
  ctx: WorkflowContext<OwnerReviewInput>,
): Promise<ExecutionResult> {
  const reconciliation = ctx.reconciliation;
  if (!reconciliation) {
    return ctx.blocked(
      "evaluator-heartbeat requires canonical task reconciliation context",
    );
  }

  const triggerType = reconciliation.trigger?.type ?? null;
  await ctx.events.emit({
    type: "evaluation.owner_review_started",
    localKey: taskEmissionKey(ctx, "owner-review-started"),
    data: {
      taskId: reconciliation.taskId,
      generation: reconciliation.generation,
      triggerType,
    },
    target: { appId: "evaluation" },
  });

  const execution = await ctx.agents.call(
    reconciliation.owner,
    ownerPrompt(ownerPacket(ctx.input, reconciliation)),
    { schema: taskOwnerResultSchema },
  );

  let ownerResult: OwnerResult;
  if (execution.status !== "done") {
    ownerResult = fallbackResult(
      `Owner review execution ${execution.id} ended ${execution.status}; preserving current desired state for the next exact wake.`,
      [
        `execution:${execution.id}`,
        `execution-status:${execution.status}`,
        `execution-summary:${truncate(execution.summary)}`,
      ],
    );
    await ctx.events.emit({
      type: "evaluation.owner_review_failed",
      localKey: taskEmissionKey(ctx, "owner-review-failed"),
      data: {
        taskId: reconciliation.taskId,
        generation: reconciliation.generation,
        triggerType,
        failure: "agent-execution-not-done",
      },
      target: { appId: "evaluation" },
    });
  } else {
    ownerResult = normalizeOwnerResult(execution.output, reconciliation);
  }

  await ctx.events.emit({
    type: "evaluation.owner_reviewed",
    localKey: taskEmissionKey(ctx, "owner-reviewed"),
    data: {
      taskId: reconciliation.taskId,
      generation: reconciliation.generation,
      triggerType,
      state: ownerResult.state,
      proposedActions: ownerResult.actions ?? [],
    },
    target: { appId: "evaluation" },
  });

  return ctx.done(ownerResult.summary, ownerResult);
}
