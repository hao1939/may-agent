/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "skill-development";

export const description: string =
  "Create or refine a skill based on observed patterns, conventions, or " +
  "coaching findings. Validates the skill works by testing it in a " +
  "detached agent session. Output: a tested SKILL.md file.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Research and draft the skill
  const draft = await ctx.runAgent("coach",
    `Research and draft a skill.\n\n` +
    `## Target\n${ctx.task}\n\n` +
    `## Instructions\n` +
    `1. Read relevant source code, docs, and existing skills to understand the domain\n` +
    `2. Check agents/shared/skills/ and agents/*/skills/ for related existing skills\n` +
    `3. Read src/skills.ts to understand skill format (YAML frontmatter with name, description)\n` +
    `4. Draft the SKILL.md — it should be concrete and actionable, not abstract\n` +
    `5. Include: when to use it, step-by-step procedure, examples, common pitfalls\n` +
    `6. Write it to the appropriate skills/ directory\n` +
    `7. Report: skill name, location, what it teaches`
  );
  if (draft.status === "error") {
    return ctx.escalate("skill drafting failed", { error: draft.error });
  }

  // Step 2: Test the skill — spawn an agent and see if it helps
  const test = await ctx.runAgent("coach",
    `Test the skill you just created.\n\n` +
    `## Draft Summary\n${ctx.summarize(draft)}\n\n` +
    `## Instructions\n` +
    `1. Spawn a detached agent session for an agent that would use this skill\n` +
    `2. Connect via socket_watch\n` +
    `3. Give the agent a task that should trigger the skill\n` +
    `4. Observe: does the agent find and use the skill? Does it help?\n` +
    `5. Clean up the detached session\n` +
    `6. Report: did the skill help, what needs refinement, test observations`
  );
  if (test.status === "error") {
    // Test failure means the skill doesn't work yet — escalate, don't mask as success
    return ctx.escalate(
      `Skill drafted but test failed — needs manual review.\n\n` +
      `## Draft\n${draft.lastAssistantText}\n\n` +
      `## Test Error\n${test.error}`
    );
  }

  // Step 3: Refine based on test results
  const refine = await ctx.runAgent("coach",
    `Refine the skill based on test results.\n\n` +
    `## Test Results\n${ctx.summarize(test)}\n\n` +
    `## Instructions\n` +
    `1. If the test showed problems, update the SKILL.md\n` +
    `2. If the skill description didn't trigger skill loading, improve it\n` +
    `3. If the content was confusing to the agent, simplify it\n` +
    `4. Write final version\n` +
    `5. Report: changes made, final assessment`
  );
  if (refine.status === "error") {
    return ctx.escalate("skill refinement failed", { error: refine.error });
  }

  return ctx.done(
    `Skill development completed.\n\n` +
    `## Draft\n${draft.lastAssistantText}\n\n` +
    `## Test\n${test.lastAssistantText}\n\n` +
    `## Final\n${refine.lastAssistantText}`
  );
}
