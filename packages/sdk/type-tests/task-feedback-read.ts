import type { WorkflowContext } from "../src/index.js";

// Compiled by SDK checks and the public declaration regression, never executed.
declare const ctx: WorkflowContext;
const task = await ctx.read.tasks.get("work");
if (task?.currentObligations?.available) {
  for (const wait of task.currentObligations.inputWaits.items) {
    const admission = wait.correlation.admission;
    if (!admission.available) continue;
    const progress: string | undefined = admission.feedback?.progress?.attemptId;
    const failure: number | undefined = admission.feedback?.failure?.revision;
    void [progress, failure];
    // @ts-expect-error Unknown categories are not selected feedback references.
    void admission.feedback?.answer;
  }
}
