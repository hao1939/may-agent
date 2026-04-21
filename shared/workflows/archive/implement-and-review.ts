/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "implement-and-review";

export const description: string =
  "Code changes: delegates to coder, then QA. " +
  "Escalates on critical review issues (wrong task, policy violation). " +
  "One retry for fixable issues. Escalates if QA rejects twice.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Coder implements (with one retry on session error)
  const coderTask = ctx.task;
  let coder = await ctx.runAgent("coder", coderTask);
  if (coder.status === "error") {
    // 34% of historical escalations were coder session errors (timeouts,
    // interruptions). Retry once before escalating — many are transient.
    coder = await ctx.runAgent("coder", coderTask);
    if (coder.status === "error") {
      return ctx.escalate("coder failed after retry", { error: coder.error });
    }
  }

  // Step 2: QA evaluates independently
  // NOTE: Frame coder output as claims to verify, not facts to accept.
  // QA must read files and run checks itself — never trust the summary.
  const reviewTask =
    `Phase 1: DIAGNOSE — gather evidence before any verdict.\n` +
    `Read the changed files yourself and run checks yourself.\n` +
    `Before forming ANY verdict, list what you checked and what you found.\n\n` +
    `## Task Description\n${ctx.task}\n\n` +
    `## Coder's Summary (claims to verify — do NOT trust without checking)\n${coder.lastAssistantText}\n\n` +
    `Your job: verify the coder's claims by reading the actual files and running tsc/tests yourself.\n` +
    `IMPORTANT: If vitest fails, determine whether failures are caused by the patch ` +
    `or are pre-existing environment issues. Only blame the patch for failures it introduced.\n\n` +
    `Phase 2: VERDICT — now give your assessment based on Phase 1 evidence.\n` +
    `Form your own judgment. Report what YOU found, not what the coder said.`;
  const review = await ctx.runAgent("qa", reviewTask);
  if (review.status === "error") {
    return ctx.escalate("qa failed", { error: review.error });
  }

  // Step 3: Check verdict (QA uses PASS/FAIL/CONDITIONAL)
  // CONDITIONAL means "changes are correct but pre-existing issues prevent clean PASS"
  // — treat it the same as PASS.
  const reviewText = review.lastAssistantText ?? "";

  // Extract the formal verdict from QA's "### Verdict" section.
  // Individual check items may say "FAIL" (e.g., "tsc: FAIL") but those
  // are item-level — the verdict line is the authoritative signal.
  const getVerdict = (text: string): "pass" | "conditional" | "fail" => {
    // Try to extract formal verdict from "### Verdict" section first
    const verdictMatch = text.match(/#+\s*Verdict[^\n]*\n+\**(\w+)\**/i);
    if (verdictMatch) {
      const v = verdictMatch[1].toUpperCase();
      if (v === "PASS") return "pass";
      if (v === "CONDITIONAL") return "conditional";
      if (v === "FAIL" || v === "REQUEST_CHANGES") return "fail";
    }
    const u = text.toUpperCase();
    if (u.includes("**CONDITIONAL**")) return "conditional";
    if (u.includes("**PASS**") && !u.includes("**FAIL**")) return "pass";
    if (u.includes("PASS") && !u.includes("FAIL")) return "pass";
    // When QA says FAIL, respect it
    if (u.includes("**FAIL**") && !u.includes("**PASS**")) return "fail";
    // Ambiguous or no clear verdict → treat as conditional pass.
    // Rationale: if QA completed without a clear FAIL, the work is likely acceptable.
    // Previous behavior (defaulting to "fail") caused 87.5% false escalation rate.
    return "conditional";
  };

  const verdict1 = getVerdict(reviewText);
  if (verdict1 === "pass" || verdict1 === "conditional") {
    const verdict = verdict1 === "conditional" ? "CONDITIONAL PASS" : "PASS";
    return ctx.done(
      `## QA Verdict: ${verdict}\n\n` +
      `## Implementation\n${coder.lastAssistantText}\n\n` +
      `## Review\n${reviewText}\n\n` +
      `## ⚠️ PHASE 4 REQUIRED — DO NOT SKIP\n` +
      `QA PASS is not proof. You MUST verify intent yourself before reporting success:\n` +
      `1. Run \`tsc --noEmit\` — must exit 0\n` +
      `2. Run \`npx vitest --run\` — must pass\n` +
      `3. Verify the *specific ask* was met (read the file, check the output)\n` +
      `4. Only then: git add + commit with evidence\n\n` +
      `"Workflow said PASS" without your own verification = hallucinated success.`
    );
  }

  // Step 3b: Check if the rejection is about something the coder can fix,
  // or something that requires higher-level judgment (wrong task, policy
  // violation, architectural disagreement).
  // NOTE: Keep these checks narrow. "contradicts" was too broad and caused
  // false escalations (e.g., QA saying "test output contradicts expected value").
  const reviewLower = reviewText.toLowerCase();
  const isCriticalRejection =
    reviewLower.includes("wrong proposal") ||
    reviewLower.includes("wrong task") ||
    reviewLower.includes("wrong implementation") ||
    reviewLower.includes("implemented the wrong") ||
    reviewLower.includes("policy violation") ||
    reviewLower.includes("policy mismatch") ||
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
    `Original task: ${ctx.task}\n\n` +
    `IMPORTANT: Address ONLY the specific issues QA raised above. ` +
    `Do not fix pre-existing tsc/vitest failures that were not introduced by this patch.`;
  let fix = await ctx.runAgent("coder", fixTask);
  if (fix.status === "error") {
    // Retry once on transient session errors
    fix = await ctx.runAgent("coder", fixTask);
    if (fix.status === "error") {
      return ctx.escalate("coder fix attempt failed after retry", { error: fix.error, reviewFeedback: reviewText });
    }
  }

  // Step 5: Re-review
  const reReviewTask =
    `Phase 1: DIAGNOSE — gather evidence before any verdict.\n` +
    `Re-review after fixes. Read the changed files yourself and run checks yourself.\n\n` +
    `## Your Original Review Feedback\n${reviewText}\n\n` +
    `## Coder's Fix Summary (verify independently)\n${fix.lastAssistantText}\n\n` +
    `Verify the issues from your original review are actually resolved.\n` +
    `IMPORTANT: If vitest fails, determine whether failures are caused by the patch ` +
    `or are pre-existing environment issues. Only blame the patch for failures it introduced.\n\n` +
    `Phase 2: VERDICT — now give your assessment based on Phase 1 evidence.\n` +
    `Confirm each issue is fixed. Report what YOU found.`;
  const review2 = await ctx.runAgent("qa", reReviewTask);
  if (review2.status === "error") {
    return ctx.escalate("re-review failed", { error: review2.error });
  }

  const review2Text = review2.lastAssistantText ?? "";
  const verdict2Result = getVerdict(review2Text);
  if (verdict2Result === "fail") {
    return ctx.escalate("still failing after one iteration", {
      fixResult: fix.lastAssistantText,
      reviewFeedback: review2Text,
    });
  }

  const verdict2 = verdict2Result === "conditional" ? "CONDITIONAL PASS" : "PASS";
  return ctx.done(
    `## QA Verdict: ${verdict2} (after one iteration)\n\n` +
    `## Implementation (after one iteration)\n${fix.lastAssistantText}\n\n` +
    `## Final Review\n${review2Text}\n\n` +
    `## ⚠️ PHASE 4 REQUIRED — DO NOT SKIP\n` +
    `QA PASS is not proof. You MUST verify intent yourself before reporting success:\n` +
    `1. Run \`tsc --noEmit\` — must exit 0\n` +
    `2. Run \`npx vitest --run\` — must pass\n` +
    `3. Verify the *specific ask* was met (read the file, check the output)\n` +
    `4. Only then: git add + commit with evidence\n\n` +
    `"Workflow said PASS" without your own verification = hallucinated success.`
  );
}
