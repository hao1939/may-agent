import { resolve } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk/legacy";
import { projectEvaluationFeedback } from "../../../watchers/feedback-projection.js";

export const name = "evaluation-feedback-projection";
export const description =
  "Maintain generated last-eval feedback files from recent evaluation records.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const appDir = ctx.appDir ?? "/app/projects/evaluation.app";
  const result = projectEvaluationFeedback({
    query: ctx.query,
    appPath: (path: string) => resolve(appDir, path),
    noop: (reason: string) => ({ reason }),
  } as never) as Record<string, unknown> | undefined;
  const summary =
    typeof result?.reason === "string"
      ? result.reason
      : "Evaluation feedback projections are current.";
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["evaluation-feedback:projected"],
    actions: [],
  });
}
