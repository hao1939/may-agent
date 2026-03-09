/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "coaching-session";

export const description: string =
  "Coach one agent. Understand (read SOUL), evaluate (compare behavior vs intent), " +
  "coach (design exercises, spawn coachee, observe), report (assessment, scores, questions).";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Understand + Evaluate — read SOUL, read evals, assess gaps
  const assessment = await ctx.runAgent("coach",
    `Assess an agent before coaching.\n\n` +
    `## Target\n${ctx.task}\n\n` +
    `## Instructions\n` +
    `1. Read the agent's SOUL.md — understand identity, mission, values, constraints\n` +
    `2. Read the agent's DOMAIN.md and TOOLS.md — understand how it operates\n` +
    `3. Read evaluation data (.state/evaluations/) and memory (.state/memory/) for this agent\n` +
    `4. Read agents/coach/workspace/COACHEES.md for coaching history\n` +
    `5. Compare actual behavior (from evals) vs intended behavior (from SOUL)\n` +
    `6. Identify gaps — where does behavior diverge from design intent?\n` +
    `7. For each gap: is this coachable, or a config/tooling problem?\n` +
    `8. If design intent is unclear, note the question\n` +
    `9. Write assessment to agents/coach/workspace/sessions/<agent>-assessment-<date>.md\n` +
    `10. Report: gaps found, whether coaching is warranted, any questions about design intent`
  );
  if (assessment.status === "error") {
    return ctx.escalate("assessment failed", { error: assessment.error });
  }

  // Step 2: Plan + Execute exercises targeting the gaps
  const session = await ctx.runAgent("coach",
    `Run coaching exercises based on your assessment.\n\n` +
    `## Assessment Summary\n${ctx.summarize(assessment)}\n\n` +
    `## Instructions\n` +
    `1. Design 1-3 exercises that target the gaps from your assessment\n` +
    `2. For each exercise: define what good behavior looks like (from SOUL/DOMAIN) and what bad behavior looks like (from eval evidence)\n` +
    `3. Spawn the target agent as a detached session: subagents.run({ agent, task, mode: "detached" })\n` +
    `4. Find the socket path from .state/instances/ and connect via socket_watch\n` +
    `5. Send each exercise as a task via socket input command\n` +
    `6. Observe — let the agent work, intervene only when clearly off-track\n` +
    `7. After each exercise: verify results independently (read files, run checks)\n` +
    `8. Score each exercise: PASS / PARTIAL / FAIL with evidence\n` +
    `9. Clean up: disconnect socket_watch, cancel the detached session\n` +
    `10. Report: exercise results, observations, interventions made`
  );
  if (session.status === "error") {
    return ctx.escalate("coaching execution failed", { error: session.error });
  }

  // Step 3: Final report + tracking updates
  const report = await ctx.runAgent("coach",
    `Write the coaching report and update tracking.\n\n` +
    `## Session Results\n${ctx.summarize(session)}\n\n` +
    `## Instructions\n` +
    `1. Write the full coaching report to agents/coach/workspace/sessions/<agent>-<date>.md\n` +
    `2. Include: assessment (design intent vs actual), exercise results, findings, questions\n` +
    `3. Append findings to agents/coach/workspace/journal.md\n` +
    `4. Update agents/coach/workspace/COACHEES.md with new scores and pass streak\n` +
    `5. Report: summary of findings, scores, recommendations, open questions`
  );
  if (report.status === "error") {
    return ctx.escalate("coaching report failed", { error: report.error });
  }

  return ctx.done(
    `Coaching session completed.\n\n` +
    `## Assessment\n${assessment.lastAssistantText}\n\n` +
    `## Results\n${session.lastAssistantText}\n\n` +
    `## Report\n${report.lastAssistantText}`
  );
}
