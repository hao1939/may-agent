/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "implement-and-review";

export const description: string =
  "Implement a fix, then review. One retry for fixable issues. " +
  "Escalates on critical review issues or second rejection.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Coder implements
  const coder = await ctx.runAgent("coder", ctx.task);
  if (coder.status === "error") {
    return ctx.escalate("coder failed", { error: coder.error });
  }

  // Step 2: QA evaluates independently
  const reviewTask =
    `Review these code changes independently. Read the changed files yourself and run checks yourself.\n\n` +
    `## Task Description\n${ctx.task}\n\n` +
    `## Coder's Summary (claims to verify — do NOT trust without checking)\n${coder.lastAssistantText}\n\n` +
    `Your job: verify the coder's claims by reading the actual files and running tsc/tests yourself. ` +
    `Form your own judgment. Report what YOU found, not what the coder said.`;
  const review = await ctx.runAgent("qa", reviewTask);
  if (review.status === "error") {
    return ctx.escalate("qa failed", { error: review.error });
  }

  // Check verdict (QA uses PASS/FAIL/CONDITIONAL)
  const reviewText = review.lastAssistantText ?? "";
  const reviewUpper = reviewText.toUpperCase();
  if (reviewUpper.includes("PASS") && !reviewUpper.includes("FAIL")) {
    return ctx.done(
      `## Implementation\n${coder.lastAssistantText}\n\n` +
      `## Review\n${reviewText}`
    );
  }

  // Critical rejections escalate immediately
  const reviewLower = reviewText.toLowerCase();
  const isCritical =
    reviewLower.includes("wrong proposal") ||
    reviewLower.includes("wrong task") ||
    reviewLower.includes("wrong implementation") ||
    reviewLower.includes("policy violation") ||
    reviewLower.includes("contradicts") ||
    reviewLower.includes("behavioral regression");

  if (isCritical) {
    return ctx.escalate(
      "qa flagged critical issues",
      { coderResult: coder.lastAssistantText, reviewFeedback: reviewText },
    );
  }

  // Step 3: One retry
  const fixTask =
    `Fix these issues from QA:\n\n${reviewText}\n\n` +
    `Original task: ${ctx.task}`;
  const fix = await ctx.runAgent("coder", fixTask);
  if (fix.status === "error") {
    return ctx.escalate("coder fix attempt failed", { error: fix.error, reviewFeedback: reviewText });
  }

  // Step 4: Re-review
  const reReviewTask =
    `Re-review after fixes. Verify the issues from your original review are actually resolved.\n\n` +
    `## Your Original Review Feedback\n${reviewText}\n\n` +
    `## Coder's Fix Summary (verify independently)\n${fix.lastAssistantText}\n\n` +
    `Read the changed files yourself. Run tsc and tests. Confirm each issue is fixed.`;
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
