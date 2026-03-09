/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "convention-review";

export const description: string =
  "Review the agent system's conventions by reading source code, docs, and " +
  "agent configurations. Identify patterns worth codifying, inconsistencies " +
  "across agents, and gaps in shared knowledge. Output: updated convention " +
  "docs and actionable findings.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Survey current state — read code, docs, configs
  const survey = await ctx.runAgent("coach",
    `Survey the agent system's current conventions.\n\n` +
    `## Focus\n${ctx.task}\n\n` +
    `## Instructions\n` +
    `1. Read docs/agent-convention.md for current documented conventions\n` +
    `2. Read agents/shared/ for shared knowledge and skills\n` +
    `3. Sample 3-4 agent directories — read their SOUL.md, DOMAIN.md, agent.json\n` +
    `4. Check for inconsistencies: do agents follow the documented conventions?\n` +
    `5. Read relevant source code (src/manager.ts auto-load logic, src/skills.ts)\n` +
    `6. Read docs/design.md and any docs referenced by the focus area\n` +
    `7. Report: what you found, patterns observed, inconsistencies, gaps`
  );
  if (survey.status === "error") {
    return ctx.escalate("convention survey failed", { error: survey.error });
  }

  // Step 2: Synthesize findings into actionable output
  const synthesis = await ctx.runAgent("coach",
    `Synthesize your convention review findings into actionable output.\n\n` +
    `## Survey Results\n${ctx.summarize(survey)}\n\n` +
    `## Instructions\n` +
    `1. For patterns worth codifying: draft a skill or update existing docs\n` +
    `2. For inconsistencies: list which agents need fixes and what specifically\n` +
    `3. For gaps: propose what's missing and where it should go\n` +
    `4. Write findings to agents/coach/workspace/sessions/convention-review-<date>.md\n` +
    `5. If you created or updated skills, validate them\n` +
    `6. Report: changes made, recommendations for follow-up`
  );
  if (synthesis.status === "error") {
    return ctx.escalate("convention synthesis failed", { error: synthesis.error });
  }

  return ctx.done(
    `Convention review completed.\n\n` +
    `## Survey\n${survey.lastAssistantText}\n\n` +
    `## Output\n${synthesis.lastAssistantText}`
  );
}
