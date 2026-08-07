import type {
  ProjectAppTaskHandlerResult,
  ProjectAppTaskVerificationContext,
  ProjectAppTaskVerificationResult,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";
import {
  reconcileSpecLive,
  verifySpecLiveResult,
} from "./spec-live-reconciliation.js";

export const name = "master-validation-route-verification";
export const description =
  "Run the shared finite spec live-reconciliation process from a main-based workspace for a master-validation claim that requires a non-aggregate target; an exact accepted pass proves behavior only, while source-bearing acceptance continues through non-draft review-ready PR handoff and explicit current-main integration readback.";
export const workspace = { kind: "task", baseBranch: "main" } as const;
export const reconciliationOptions = {
  targetBranch: "main",
  allowTerminalDisposition: false,
} as const;

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  return reconcileSpecLive(ctx, reconciliationOptions);
}

export async function verify(
  context: ProjectAppTaskVerificationContext,
  result: ProjectAppTaskHandlerResult,
): Promise<ProjectAppTaskVerificationResult> {
  return verifySpecLiveResult(
    context,
    result,
    reconciliationOptions.targetBranch,
  );
}
