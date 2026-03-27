/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "design-review";

export const description: string =
  "Review shared knowledge docs against reality. Evaluator and optimizer " +
  "independently review, then cross-respond. Returns structured findings " +
  "for the optimizer to act on.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const targetDoc = ctx.task || "agents/shared/system-design.md";

  const scopeContext =
    `SCOPE CONTEXT: Identify the document's stated purpose and scope first. ` +
    `Evaluate whether it achieves what it claims — not whether it covers everything ` +
    `you can think of. A finding like 'feature X is not documented' is only valuable ` +
    `if the feature contradicts or invalidates something the doc describes.\n\n`;

  const basePrompt =
    `Review the document at ${targetDoc}.\n\n` +
    scopeContext +
    `Read the doc. Then check a few key claims against the actual code — ` +
    `don't try to audit everything, focus on the most important or suspect areas.\n\n` +
    `Classify findings by severity:\n` +
    `- CRITICAL: Runtime failures, dangerous inaccuracies\n` +
    `- IMPORTANT: Misleading claims, significant gaps (cap at ~5)\n` +
    `- MINOR: Nice-to-haves, completeness nits\n\n` +
    `Keep your review concise — max 2000 words. Focus on substance.\n\n`;

  const crossResponseGuidance =
    `Actively challenge low-value or pedantic findings from the other reviewer. ` +
    `If they flagged an undocumented feature that doesn't contradict any concept in ` +
    `the doc, call it out as out-of-scope. Your job in cross-response is to raise ` +
    `signal-to-noise, not agree and add more.\n\n`;

  // Step 1: Evaluator reviews independently
  ctx.emit({ type: "step_start", step: "evaluator-review" });
  const evalReview = await ctx.runAgent("evaluator",
    basePrompt +
    `Your perspective: agent behavior, scoring, attribution, the evaluation model.\n` +
    `Identify mismatches, missing concepts, inaccuracies, and strengths.\n` +
    `Write a structured report with severity tiers.`
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
    `Identify mismatches, missing concepts, inaccuracies, and strengths.\n` +
    `Write a structured report with severity tiers.`
  );
  if (optReview.status === "error") {
    return ctx.escalate("optimizer review failed", { error: optReview.error });
  }
  const optText = optReview.lastAssistantText ?? "(no output)";

  // Step 3: Evaluator responds to optimizer's review
  ctx.emit({ type: "step_start", step: "evaluator-response" });
  const evalResponse = await ctx.runAgent("evaluator",
    `You previously reviewed ${targetDoc}. Now read the optimizer's review and respond.\n\n` +
    `## Optimizer's Review\n${optText}\n\n` +
    crossResponseGuidance +
    `Respond concisely (max 1000 words):\n` +
    `- Agree/disagree with specific findings\n` +
    `- Challenge low-value findings\n` +
    `- Note anything they missed\n\n` +
    `Be direct. Do NOT use any tools — respond from your earlier review.`
  );
  if (evalResponse.status === "error") {
    return ctx.escalate("evaluator response failed", { error: evalResponse.error });
  }
  const evalResponseText = evalResponse.lastAssistantText ?? "(no output)";

  // Step 4: Optimizer responds to evaluator's review
  ctx.emit({ type: "step_start", step: "optimizer-response" });
  const optResponse = await ctx.runAgent("optimizer",
    `You previously reviewed ${targetDoc}. Now read the evaluator's review and respond.\n\n` +
    `## Evaluator's Review\n${evalText}\n\n` +
    crossResponseGuidance +
    `Respond concisely (max 1000 words):\n` +
    `- Agree/disagree with specific findings\n` +
    `- Challenge low-value findings\n` +
    `- Note anything they missed\n\n` +
    `Be direct. Do NOT use any tools — respond from your earlier review.`
  );
  if (optResponse.status === "error") {
    return ctx.escalate("optimizer response failed", { error: optResponse.error });
  }
  const optResponseText = optResponse.lastAssistantText ?? "(no output)";

  const summary = [
    `# Design Review: ${targetDoc}`,
    ``,
    `## Evaluator's Review`,
    evalText,
    ``,
    `---`,
    ``,
    `## Optimizer's Review`,
    optText,
    ``,
    `---`,
    ``,
    `## Evaluator's Cross-Response`,
    evalResponseText,
    ``,
    `---`,
    ``,
    `## Optimizer's Cross-Response`,
    optResponseText,
  ].join("\n");

  return ctx.done(summary);
}
