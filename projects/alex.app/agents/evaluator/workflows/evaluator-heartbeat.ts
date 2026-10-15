import {
  admitTaskReconcileResult,
  taskAgentResultSchema,
  type ExecutionResult,
  type TaskReconcileResult,
  type TaskReconciliationContext,
  type WorkflowContext,
} from "@may-agent/sdk";
import { taskEmissionKey } from "./lib/task-emission.js";

export const name = "evaluator-heartbeat";
export const description =
  "Review the evaluator's bounded task frontier in Alex without creating a private work tree.";

type OwnerReviewInput = { scope?: string; reason?: string };
type AgentResult = TaskReconcileResult;

function incompleteResult(summary: string, facts: string[]): AgentResult {
  return {
    state: "incomplete",
    summary,
    facts: [facts[0] ?? summary, ...facts.slice(1, 32)],
  };
}

export function normalizeAgentResult(
  output: unknown,
  reconciliation: TaskReconciliationContext<OwnerReviewInput>,
): AgentResult {
  const admission = admitTaskReconcileResult(output);
  if (admission.ok === false) {
    return incompleteResult(
      `Owner review returned an invalid structured result; preserving current desired state. ${admission.error}`,
      [`owner-result-rejected:${admission.error.slice(0, 400)}`],
    );
  }
  const result = admission.result as AgentResult;
  const live = new Map(
    reconciliation.children.live.map((child) => [child.taskId, child]),
  );
  const actions = (result.actions ?? []).filter((action) => {
    if (action.kind === "retire-condition") return true;
    const target = live.get(action.taskId);
    return (
      !action.taskId.startsWith("runtime/") &&
      Boolean(target) &&
      target?.generation === action.expectedGeneration &&
      (target.status === "waiting" || target.status === "attention")
    );
  });
  if (actions.length === (result.actions ?? []).length) return result;
  return incompleteResult(
    `Filtered ${(result.actions ?? []).length - actions.length} stale or out-of-scope unblock action(s); ${result.summary}`,
    [...result.facts, "owner-actions:filtered"],
  );
}

function ownerPrompt(
  input: OwnerReviewInput,
  reconciliation: TaskReconciliationContext<OwnerReviewInput>,
): string {
  return [
    "Review the supplied evaluator reliability work in Alex; evaluated Tasks retain their own owners.",
    "Use only this bounded packet. Do not query global state, create work, edit files, or evaluate Evaluation's own quality.",
    "Return a justified no-op unless one supplied waiting child can safely be unblocked.",
    "Unknown or missing evidence is a visible gap, never healthy coverage or a target failure.",
    "Use facts (not evidence) in the current Task result contract.",
    `Schema: ${JSON.stringify(taskAgentResultSchema)}`,
    `Packet: ${JSON.stringify({ appId: reconciliation.appId, taskId: reconciliation.taskId, generation: reconciliation.generation, resourceVersion: reconciliation.resourceVersion, outcome: reconciliation.outcome, acceptance: reconciliation.acceptance, input, latestEvent: reconciliation.events.items.at(-1)?.event ?? null, children: reconciliation.children, taskSnapshot: reconciliation.taskSnapshot })}`,
  ].join("\n\n");
}

export async function execute(
  ctx: WorkflowContext<OwnerReviewInput>,
): Promise<ExecutionResult> {
  const reconciliation = ctx.reconciliation;
  if (!reconciliation)
    return ctx.blocked(
      "evaluator-heartbeat requires canonical reconciliation context",
    );
  await ctx.events.emit({
    type: "evaluation.owner_review_started",
    localKey: taskEmissionKey(ctx, "owner-review-started"),
    data: {
      taskId: reconciliation.taskId,
      generation: reconciliation.generation,
    },
    target: { appId: "alex" },
  });
  const execution = await ctx.agents.call(
    reconciliation.agent,
    ownerPrompt(ctx.input, reconciliation),
    { schema: taskAgentResultSchema },
  );
  const result =
    execution.status === "done"
      ? normalizeAgentResult(execution.output, reconciliation)
      : incompleteResult(
          `Owner review execution ${execution.id} ended ${execution.status}; preserving current desired state.`,
          [`execution:${execution.id}`, `execution-status:${execution.status}`],
        );
  await ctx.events.emit({
    type:
      execution.status === "done"
        ? "evaluation.owner_reviewed"
        : "evaluation.owner_review_failed",
    localKey: taskEmissionKey(ctx, "owner-reviewed"),
    data: {
      taskId: reconciliation.taskId,
      generation: reconciliation.generation,
      state: result.state,
    },
    target: { appId: "alex" },
  });
  return ctx.done(result.summary, result);
}
