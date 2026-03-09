/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "coaching-session";

export const description: string =
  "Run a coaching session for one agent. " +
  "Reads evaluation data, designs exercises, spawns the coachee in a " +
  "detached process, runs exercises via socket, verifies results, " +
  "and writes a report. Coach observes and steers; coachee does the work.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Coach plans the session — reads data, designs exercises
  const plan = await ctx.runAgent("coach",
    `Plan a coaching session.\n\n` +
    `## Target\n${ctx.task}\n\n` +
    `## Instructions\n` +
    `1. Read evaluation data (.state/evaluations/) and memory (.state/memory/) for the target agent\n` +
    `2. Read the target agent's DOMAIN.md and LESSONS.md to understand its role\n` +
    `3. Read agents/coach/workspace/COACHEES.md for coaching history\n` +
    `4. Identify the highest-impact weakness\n` +
    `5. Design 1-3 exercises that target it\n` +
    `6. Write the plan to agents/coach/workspace/sessions/<agent>-plan-<date>.md\n` +
    `7. Report: agent name, weakness targeted, exercises designed`
  );
  if (plan.status === "error") {
    return ctx.escalate("coaching plan failed", { error: plan.error });
  }

  // Step 2: Coach executes the exercises — spawns coachee, observes, steers
  const session = await ctx.runAgent("coach",
    `Execute the coaching plan you just created.\n\n` +
    `## Plan Summary\n${ctx.summarize(plan)}\n\n` +
    `## Instructions\n` +
    `1. Spawn the target agent as a detached session: subagents.run({ agent, task, mode: "detached" })\n` +
    `2. Find the socket path from .state/instances/ and connect via socket_watch\n` +
    `3. Send each exercise as a task via socket input command\n` +
    `4. Observe the event stream — let the agent work, intervene only when clearly off-track\n` +
    `5. After each exercise: verify results independently (read files, run checks)\n` +
    `6. Score each exercise: PASS / PARTIAL / FAIL with evidence\n` +
    `7. Clean up: disconnect socket_watch, cancel the detached session\n` +
    `8. Report: exercise results, observations, interventions made`
  );
  if (session.status === "error") {
    return ctx.escalate("coaching execution failed", { error: session.error });
  }

  // Step 3: Coach writes the final report
  const report = await ctx.runAgent("coach",
    `Write the coaching report and update tracking.\n\n` +
    `## Session Results\n${ctx.summarize(session)}\n\n` +
    `## Instructions\n` +
    `1. Write the full coaching report to agents/coach/workspace/sessions/<agent>-<date>.md\n` +
    `2. Append findings to agents/coach/workspace/journal.md\n` +
    `3. Update agents/coach/workspace/COACHEES.md with new scores and pass streak\n` +
    `4. If you found patterns worth codifying, note them for follow-up\n` +
    `5. Report: summary of findings, scores, recommendations`
  );
  if (report.status === "error") {
    return ctx.escalate("coaching report failed", { error: report.error });
  }

  return ctx.done(
    `Coaching session completed.\n\n` +
    `## Plan\n${plan.lastAssistantText}\n\n` +
    `## Results\n${session.lastAssistantText}\n\n` +
    `## Report\n${report.lastAssistantText}`
  );
}
