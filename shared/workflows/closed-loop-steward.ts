/// <reference path="../../types/workflow-defs.d.ts" />

import type { WorkflowContext, WorkflowResult } from "../../../src/lib/workflow.js";

export const name = "closed-loop-steward";

export const description =
  "Run May's recurring closed-loop audit from workflow context so handler code remains a bridge.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const result = await ctx.runAgent("may", ctx.task);
  const status = result.status ?? "done";
  if (status === "error") {
    return ctx.escalate("May closed-loop audit session failed", {
      sessionId: result.sessionId,
      summary: result.lastAssistantText,
    });
  }
  return ctx.done(`May closed-loop audit completed in ${result.sessionId}.`);
}
