/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Design-Then-Build Workflow
 *
 * Two-phase sequential workflow:
 * 1. Bob reviews and refines a design brief
 * 2. Tech-lead implements the refined design
 *
 * ## Task Format
 *
 * Pass the design brief as the task string. The workflow will:
 * - Send it to Bob for review/refinement
 * - Pass Bob's refined output to tech-lead for implementation
 *
 * ## Trigger
 *
 * Fire-and-forget from May:
 *   agents.run("may", "workflow run design-then-build <task>")
 * Or from May's session:
 *   workflow({ action: "run", name: "design-then-build", task: "<brief>" })
 */

export const name: string = "design-then-build";

export const description: string =
  "Two-phase: Bob reviews/refines a design, then tech-lead implements it. " +
  "Escalates if Bob flags fundamental issues or tech-lead implementation fails twice.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ── Phase 1: Bob reviews and refines the design ──────────────────────

  const reviewTask =
    `## Design Review Task\n\n` +
    `Review and refine this design. Read all referenced source files yourself.\n\n` +
    `**Your job:**\n` +
    `1. Assess the design for correctness, completeness, and feasibility\n` +
    `2. Answer any open design questions\n` +
    `3. Flag any risks or missing considerations\n` +
    `4. Produce a refined spec clear enough for tech-lead to implement from\n\n` +
    `**Output format:** Write your refined design as a clear implementation spec.\n` +
    `Include: what to change, in which files, with what behavior.\n` +
    `If the design is fundamentally flawed, say so clearly.\n\n` +
    `## Design Brief\n\n${ctx.task}`;

  const bobResult = await ctx.runAgent("bob", reviewTask);

  if (bobResult.status === "error") {
    return ctx.escalate("Bob failed during design review", { error: bobResult.error });
  }

  const bobOutput = bobResult.lastAssistantText ?? "";

  // Check if Bob rejected the design
  const bobLower = bobOutput.toLowerCase();
  if (
    bobLower.includes("fundamentally flawed") ||
    bobLower.includes("should not proceed") ||
    bobLower.includes("reject this design") ||
    bobLower.includes("do not implement")
  ) {
    return ctx.escalate(
      "Bob rejected the design — requires rethinking before implementation",
      { bobFeedback: bobOutput },
    );
  }

  // ── Phase 2: Tech-lead implements the refined design ─────────────────

  const buildTask =
    `## Implementation Task\n\n` +
    `Implement this design that has been reviewed and refined by Bob.\n\n` +
    `**Original brief:**\n${ctx.task}\n\n` +
    `**Bob's refined design:**\n${bobOutput}\n\n` +
    `Follow Bob's refined spec. Use coder for code changes, QA for review.\n` +
    `Verify with npm run check. Commit when done.`;

  const techLeadResult = await ctx.runAgent("tech-lead", buildTask);

  if (techLeadResult.status === "error") {
    return ctx.escalate("Tech-lead failed during implementation", {
      error: techLeadResult.error,
      bobDesign: bobOutput,
    });
  }

  const tlOutput = techLeadResult.lastAssistantText ?? "";

  return ctx.done(
    `## Design-Then-Build Complete\n\n` +
    `### Phase 1: Design Review (Bob)\n${bobOutput.slice(0, 2000)}\n\n` +
    `### Phase 2: Implementation (Tech-Lead)\n${tlOutput.slice(0, 2000)}`
  );
}
