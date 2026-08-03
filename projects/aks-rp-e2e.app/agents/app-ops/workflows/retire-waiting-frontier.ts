import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "retire-waiting-frontier";
export const description =
  "Drain the fixed children of the retired waiting-frontier resource, then converge it.";

export const waitingFrontierTaskId = "runtime/waiting-frontier-review";

type TaskState = {
  resources?: Record<
    string,
    {
      spec?: { parentId?: string };
    }
  >;
};

export function waitingFrontierChildIds(state: TaskState): string[] {
  return Object.entries(state.resources ?? {})
    .filter(([, resource]) => resource.spec?.parentId === waitingFrontierTaskId)
    .map(([taskId]) => taskId)
    .sort();
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) throw new Error("retire-waiting-frontier requires appDir");
  const state = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as TaskState;
  const children = waitingFrontierChildIds(state);

  if (children.length > 0) {
    const summary = `Waiting for ${children.length} existing waiting-frontier children to finish; no new recovery work was created.`;
    return ctx.done(summary, {
      state: "waiting",
      summary,
      evidence: children.slice(0, 16).map((taskId) => `live-child:${taskId}`),
      actions: [],
    });
  }

  const summary =
    "All existing waiting-frontier children finished; the retired recovery scheduler can leave the live graph.";
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["retirement:waiting-frontier-drained"],
    actions: [],
  });
}
