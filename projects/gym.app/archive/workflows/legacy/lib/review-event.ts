import { createHash } from "node:crypto";
import type { AppEvent, WorkflowContext } from "@may-agent/sdk";

/**
 * Semantic emissions owned by one admitted review-task reconciliation.
 *
 * The task id and generation identify the reconciliation. The semantic name
 * identifies one effect within it, so retries reuse keys while different
 * effects cannot collide.
 */
export type ReviewEmission =
  | "filtered"
  | "approval-superseded"
  | "approved"
  | "improvement-requested"
  | "declined"
  | "ready"
  | "approval-requested"
  | "human-message";

export function reviewEmissionLocalKey(
  ctx: Pick<WorkflowContext, "reconciliation">,
  emission: ReviewEmission,
): string {
  const taskId = String(ctx.reconciliation?.taskId ?? "").trim();
  const generation = Number(ctx.reconciliation?.generation);
  if (!taskId || !Number.isInteger(generation) || generation < 1) {
    throw new Error("Review emission requires an admitted task identity");
  }
  const reconciliationHash = createHash("sha256")
    .update(`${taskId}\0${generation}`)
    .digest("hex")
    .slice(0, 20);
  return `review-proposal-${reconciliationHash}-${emission}`;
}

export function reviewEvent(
  ctx: Pick<WorkflowContext, "reconciliation">,
  emission: ReviewEmission,
  type: string,
  data: Record<string, unknown>,
  options: Pick<AppEvent, "owner" | "source" | "target"> = {},
): AppEvent<Record<string, unknown>> {
  return {
    type,
    data: { project: "gym", ...data },
    source: options.source ?? "app:gym",
    owner: options.owner ?? "app:gym",
    target: options.target ?? { appId: "gym", project: "gym" },
    localKey: reviewEmissionLocalKey(ctx, emission),
  };
}
