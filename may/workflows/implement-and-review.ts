/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "implement-and-review";

export const description: string =
  "Code changes: delegates to coder, then QA. " +
  "Escalates on critical review issues (wrong task, policy violation). " +
  "One retry for fixable issues. Escalates if QA rejects twice.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Coder implements
  const coder = await ctx.runAgent("coder", ctx.task);
  if (coder.status === "error") {
    return ctx.escalate("coder failed", { error: coder.error });
  }

  // Step 2: QA evaluates
  const reviewTask =
    `Review the following implementation.\n\n` +
    `## Task\n${ctx.task}\n\n` +
    `## Implementation\n${coder.lastAssistantText}`;
  const review = await ctx.runAgent("qa", reviewTask);
  if (review.status === "error") {
    return ctx.escalate("qa failed", { error: review.error });
  }

  // Step 3: Check verdict (QA uses PASS/FAIL/CONDITIONAL)
  const reviewText = review.lastAssistantText ?? "";
  const reviewUpper = reviewText.toUpperCase();
  if (reviewUpper.includes("PASS") && !reviewUpper.includes("FAIL")) {
    return ctx.done(
      `## Implementation\n${coder.lastAssistantText}\n\n` +
      `## Review\n${reviewText}`
    );
  }

  // Step 3b: Check if the rejection is about something the coder can fix,
  // or something that requires higher-level judgment (wrong task, policy
  // violation, architectural disagreement).
  // If QA flags critical/structural issues, escalate to the
  // supervisor instead of letting the coder blindly retry.
  const reviewLower = reviewText.toLowerCase();
  const isCriticalRejection =
    reviewLower.includes("wrong proposal") ||
    reviewLower.includes("wrong task") ||
    reviewLower.includes("wrong implementation") ||
    reviewLower.includes("implemented the wrong") ||
    reviewLower.includes("policy violation") ||
    reviewLower.includes("policy mismatch") ||
    reviewLower.includes("contradicts") ||
    reviewLower.includes("behavioral regression");

  if (isCriticalRejection) {
    return ctx.escalate(
      "qa flagged critical issues that require supervisor judgment",
      { coderResult: coder.lastAssistantText, reviewFeedback: reviewText },
    );
  }

  // Step 4: One iteration — send feedback to coder for fixable issues
  const fixTask =
    `Fix these issues from QA:\n\n${reviewText}\n\n` +
    `Original task: ${ctx.task}`;
  const fix = await ctx.runAgent("coder", fixTask);
  if (fix.status === "error") {
    return ctx.escalate("coder fix attempt failed", { error: fix.error, reviewFeedback: reviewText });
  }

  // Step 5: Re-review
  const reReviewTask =
    `Re-review after fixes.\n\n` +
    `## Original Review Feedback\n${reviewText}\n\n` +
    `## Updated Implementation\n${fix.lastAssistantText}`;
  const review2 = await ctx.runAgent("qa", reReviewTask);
  if (review2.status === "error") {
    return ctx.escalate("re-review failed", { error: review2.error });
  }

  const review2Text = review2.lastAssistantText ?? "";
  const review2Upper = review2Text.toUpperCase();
  if (review2Upper.includes("FAIL") || (review2Upper.includes("CONDITIONAL") && !review2Upper.includes("PASS"))) {
    return ctx.escalate("still failing after one iteration", {
      fixResult: fix.lastAssistantText,
      reviewFeedback: review2Text,
    });
  }

  return ctx.done(
    `## Implementation (after one iteration)\n${fix.lastAssistantText}\n\n` +
    `## Final Review\n${review2Text}`
  );
}
