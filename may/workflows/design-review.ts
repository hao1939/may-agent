/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "design-review";

export const description: string =
  "Design review discussion: evaluator and optimizer independently review the system " +
  "design doc against reality, then cross-respond to each other's findings. " +
  "May adds its own perspective and produces the final brief.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const designDocPath = "agents/shared/system-design.md";

  const scopeContext =
    `SCOPE CONTEXT: This is a conceptual design document. It intentionally omits ` +
    `implementation details like specific tool implementations, subsystem internals, ` +
    `and configuration. Evaluate whether the concepts, principles, and mental models ` +
    `are accurate and complete — not whether every feature or subsystem is mentioned. ` +
    `A finding like 'feature X is not documented' is only valuable if the feature ` +
    `contradicts or invalidates a concept the doc describes.\n\n`;

  const basePrompt =
    `Review the system design document at ${designDocPath}.\n\n` +
    scopeContext +
    `Read the design doc. Then check a few key claims against the actual code — ` +
    `don't try to audit everything, focus on the most important or suspect areas.\n\n` +
    `Keep your review concise — max 2000 words. Focus on substance, not listing every file you checked.\n\n`;

  const crossResponseGuidance =
    `Actively challenge low-value or pedantic findings from the other reviewer. ` +
    `If they flagged an undocumented feature that doesn't contradict any concept in ` +
    `the doc, call it out as out-of-scope. Prioritize: which of their findings would ` +
    `actually mislead a reader of the design doc?\n\n`;

  // Step 1: Evaluator reviews independently
  ctx.emit({ type: "step_start", step: "evaluator-review" });
  const evalReview = await ctx.runAgent("evaluator",
    basePrompt +
    `Your perspective: agent behavior, scoring, attribution, the evaluation model.\n` +
    `Identify:\n` +
    `1. **Mismatches**: Where the system doesn't match what the doc claims\n` +
    `2. **Missing concepts**: Ideas the doc should cover but doesn't\n` +
    `3. **Inaccuracies**: Things the doc claims that aren't true\n` +
    `4. **Strengths**: What the doc gets right\n\n` +
    `Write a structured report.`
  );
  if (evalReview.status === "error") {
    return ctx.escalate("evaluator review failed", { error: evalReview.error });
  }
  const evalText = evalReview.lastAssistantText ?? "(no output)";

  // Step 2: Optimizer reviews independently
  ctx.emit({ type: "step_start", step: "optimizer-review" });
  const optReview = await ctx.runAgent("optimizer",
    basePrompt +
    `Your perspective: system structure, fix hierarchy, optimization loop, code-level accuracy.\n` +
    `Identify:\n` +
    `1. **Mismatches**: Where the system doesn't match what the doc claims\n` +
    `2. **Missing concepts**: Ideas the doc should cover but doesn't\n` +
    `3. **Inaccuracies**: Things the doc claims that aren't true\n` +
    `4. **Strengths**: What the doc gets right\n\n` +
    `Write a structured report.`
  );
  if (optReview.status === "error") {
    return ctx.escalate("optimizer review failed", { error: optReview.error });
  }
  const optText = optReview.lastAssistantText ?? "(no output)";

  // Step 3: Evaluator responds to optimizer's review
  ctx.emit({ type: "step_start", step: "evaluator-response" });
  const evalResponse = await ctx.runAgent("evaluator",
    `You previously reviewed the system design doc. Now read the optimizer's review and respond.\n\n` +
    `## Optimizer's Review\n${optText}\n\n` +
    crossResponseGuidance +
    `Respond concisely (max 1000 words):\n` +
    `- What do you agree with?\n` +
    `- What do you disagree with, and why?\n` +
    `- What did the optimizer miss?\n` +
    `- Any new insights from their perspective?\n\n` +
    `Be direct. Disagreements are valuable. Do NOT use any tools — just respond based on your earlier review.`
  );
  if (evalResponse.status === "error") {
    return ctx.escalate("evaluator response failed", { error: evalResponse.error });
  }
  const evalResponseText = evalResponse.lastAssistantText ?? "(no output)";

  // Step 4: Optimizer responds to evaluator's review
  ctx.emit({ type: "step_start", step: "optimizer-response" });
  const optResponse = await ctx.runAgent("optimizer",
    `You previously reviewed the system design doc. Now read the evaluator's review and respond.\n\n` +
    `## Evaluator's Review\n${evalText}\n\n` +
    crossResponseGuidance +
    `Respond concisely (max 1000 words):\n` +
    `- What do you agree with?\n` +
    `- What do you disagree with, and why?\n` +
    `- What did the evaluator miss?\n` +
    `- Any new insights from their perspective?\n\n` +
    `Be direct. Disagreements are valuable. Do NOT use any tools — just respond based on your earlier review.`
  );
  if (optResponse.status === "error") {
    return ctx.escalate("optimizer response failed", { error: optResponse.error });
  }
  const optResponseText = optResponse.lastAssistantText ?? "(no output)";

  // Return all four outputs for May to synthesize
  const summary = [
    `# Design Review Discussion`,
    ``,
    `## Evaluator's Initial Review`,
    evalText,
    ``,
    `---`,
    ``,
    `## Optimizer's Initial Review`,
    optText,
    ``,
    `---`,
    ``,
    `## Evaluator's Response to Optimizer`,
    evalResponseText,
    ``,
    `---`,
    ``,
    `## Optimizer's Response to Evaluator`,
    optResponseText,
    ``,
    `---`,
    ``,
    `## Next Step`,
    `May: Read all four sections above. Add your own perspective (user-facing experience, ` +
    `task flow, delegation quality). Then produce the final brief:`,
    `1. What to fix in code (with specific files/functions)`,
    `2. What to update in the design doc`,
    `3. What to discuss with the user`,
  ].join("\n");

  return ctx.done(summary);
}
