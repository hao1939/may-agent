import { resolve } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk/legacy";
import { observeEvaluationPipeline } from "../../../watchers/evaluation-pipeline.js";

export const name = "evaluation-pipeline";
export const description =
  "Sample deterministic evaluation pipeline health and emit only changed anomaly state.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const appDir = ctx.appDir ?? "/app/projects/evaluation.app";
  const result = (await observeEvaluationPipeline({
    query: ctx.query,
    appPath: (path: string) => resolve(appDir, path),
    emit: (event: Record<string, unknown>) => {
      ctx.emit(event as { type: string });
      return event;
    },
    noop: (reason: string) => ({ reason }),
  } as never)) as Record<string, unknown> | undefined;
  const summary =
    typeof result?.reason === "string"
      ? result.reason
      : "Evaluation pipeline state changed and its owner-review fact was emitted.";
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["evaluation-pipeline:sampled"],
    actions: [],
  });
}
