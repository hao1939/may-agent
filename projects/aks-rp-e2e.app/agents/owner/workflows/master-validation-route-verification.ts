import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { reconcileSpecLive } from "./spec-live-reconciliation.js";

export const name = "master-validation-route-verification";
export const description =
  "Run the shared finite spec live-reconciliation process from a main-based workspace for a master-validation claim that requires a non-aggregate target.";
export const workspace = { kind: "task", baseBranch: "main" } as const;

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  return reconcileSpecLive(ctx, { targetBranch: "main" });
}
