import type {
  ExecutionResult,
  TaskReconcileResult,
  WorkflowContext,
} from "@may-agent/sdk";
import { parseApprovalDecision } from "./lib/approval-decision.js";

export const name = "approval-decision";
export const description =
  "Apply one addressed approval reply to its exact declared wait and close the source message.";

type ApprovalDecisionInput = Record<string, unknown> & {
  sourceMessageEventId?: number;
  sourceMessageOwner?: string;
};

type ScopedWorkflowContext = WorkflowContext<ApprovalDecisionInput>;

function result(
  ctx: ScopedWorkflowContext,
  state: TaskReconcileResult["state"],
  summary: string,
  evidence: string[],
): ExecutionResult<TaskReconcileResult> {
  return ctx.done(summary, { state, summary, evidence, actions: [] });
}

export async function execute(
  ctx: ScopedWorkflowContext,
): Promise<ExecutionResult<TaskReconcileResult>> {
  const input = ctx.reconciliation?.input ?? ctx.input;
  const projection = parseApprovalDecision(input);
  if (!projection) {
    return result(
      ctx,
      "needs-owner",
      "Approval reply did not contain one complete bounded AKS approval decision.",
      ["approval-decision:incomplete-correlation"],
    );
  }

  const sourceMessageEventId = Number(input.sourceMessageEventId);
  const idempotencyKey = `approval-decision:${projection.approvalId}:${projection.decision}`;
  await ctx.events.emit({
    type: "project.approval.submitted",
    source: "aks-rp-e2e-app",
    target: { appId: projection.project, project: projection.project },
    data: {
      project: projection.project,
      approvalKind: "approval-packet-dispatch",
      approvalId: projection.approvalId,
      waitId: projection.waitId,
      pathId: projection.pathId,
      decision: projection.decision,
      message: projection.message,
      sourceMessageType: "message.created",
      sourceMessageIntent: "approval-decision",
      sourceMessageOwner: input.sourceMessageOwner,
      ...(Number.isSafeInteger(sourceMessageEventId) && sourceMessageEventId > 0
        ? { sourceMessageEventId }
        : {}),
      ...(projection.packetPath ? { packetPath: projection.packetPath } : {}),
      idempotencyKey,
    },
  });

  if (Number.isSafeInteger(sourceMessageEventId) && sourceMessageEventId > 0) {
    await ctx.events.emit({
      type: "message.resolved",
      source: "aks-rp-e2e-app",
      owner: "agent:app-ops",
      target: { appId: projection.project, project: projection.project },
      data: {
        openEventId: sourceMessageEventId,
        openEventType: "message.created",
        project: projection.project,
        projectId: projection.project,
        disposition: "answered",
        outcome: "fulfilled",
        summary: `Published the ${projection.decision} decision for approval ${projection.approvalId}.`,
        idempotencyKey: `${idempotencyKey}:message-resolved`,
      },
    });
  }

  return result(
    ctx,
    "converged",
    `Published the ${projection.decision} decision for approval ${projection.approvalId}.`,
    [
      `approval:${projection.approvalId}`,
      `wait:${projection.waitId}`,
      `path:${projection.pathId}`,
    ],
  );
}
