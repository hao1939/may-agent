/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * verify-parallel — L3 Kinetic Defense: Parallel Auditor
 *
 * Breaks the "Consensus Hallucination" chain (L1→L2→L3) by running an
 * independent Auditor in parallel with the standard QA review.
 *
 * The Auditor uses **contrastive framing**: it is explicitly told to assume
 * the code contains a subtle bug and to find it. It does NOT see QA's output,
 * ensuring an independent perspective from a different "prior distribution".
 *
 * Flow:
 *   1. Coder implements the task
 *   2. IN PARALLEL:
 *      a. QA reviews (standard verification — read files, run tests)
 *      b. Auditor reviews (adversarial — "find why this is dangerous")
 *   3. If Auditor found issues:
 *      - QA must address them (merged review)
 *      - If QA passed but Auditor found real issues → escalate for judgment
 *   4. Standard retry loop for fixable issues
 *
 * This workflow is the structural fix for the pattern where QA rubber-stamps
 * coder output because both share similar model biases.
 *
 * Research: HAE 2603.07496, Moltbook 2602.09877
 */

export const name: string = "verify-parallel";

export const description: string =
  "L3 Kinetic Defense: Coder implements, then QA + adversarial Auditor " +
  "review in parallel. Auditor uses contrastive framing to break consensus " +
  "hallucination. Escalates if Auditor finds issues QA missed.";

// ── Helpers ────────────────────────────────────────────────────────────

/** Classify the severity of Auditor findings. */
function classifyAuditorFindings(auditorText: string): "none" | "low" | "high" {
  const upper = auditorText.toUpperCase();
  const lower = auditorText.toLowerCase();

  // If auditor explicitly says "no issues" or "clean"
  if (
    (lower.includes("no issues found") || lower.includes("no bugs found") ||
     lower.includes("no critical") || lower.includes("looks correct") ||
     lower.includes("no significant")) &&
    !upper.includes("BUG") && !upper.includes("VULNERABILITY") &&
    !upper.includes("CRITICAL")
  ) {
    return "none";
  }

  // High severity: explicit bug/vulnerability/critical language
  if (
    upper.includes("CRITICAL") || upper.includes("VULNERABILITY") ||
    upper.includes("SECURITY") || upper.includes("DATA LOSS") ||
    upper.includes("RACE CONDITION") || upper.includes("INJECTION") ||
    lower.includes("silent failure") || lower.includes("silently fails") ||
    lower.includes("undefined behavior") || lower.includes("memory leak")
  ) {
    return "high";
  }

  // Low severity: general concerns or suggestions
  if (
    upper.includes("BUG") || upper.includes("ISSUE") || upper.includes("PROBLEM") ||
    upper.includes("CONCERN") || upper.includes("WARNING") || upper.includes("RISK") ||
    upper.includes("FLAW") || upper.includes("ERROR")
  ) {
    return "low";
  }

  return "none";
}

/** Check QA verdict. */
function getQAVerdict(reviewText: string): "pass" | "fail" | "conditional" {
  const upper = reviewText.toUpperCase();
  if (upper.includes("FAIL")) return "fail";
  if (upper.includes("PASS")) return "pass";
  if (upper.includes("CONDITIONAL")) return "conditional";
  return "conditional"; // ambiguous → treat as conditional
}

/** Check for critical rejections that need supervisor judgment. */
function isCriticalRejection(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("wrong proposal") ||
    lower.includes("wrong task") ||
    lower.includes("wrong implementation") ||
    lower.includes("implemented the wrong") ||
    lower.includes("policy violation") ||
    lower.includes("policy mismatch") ||
    lower.includes("contradicts") ||
    lower.includes("behavioral regression")
  );
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ═══════════════════════════════════════════════════════════════════
  // Step 1: Coder implements the change
  // ═══════════════════════════════════════════════════════════════════
  const coder = await ctx.runAgent("coder", ctx.task);
  if (coder.status === "error") {
    return ctx.escalate("coder failed", { error: coder.error });
  }

  const coderSummary = coder.lastAssistantText ?? "(no output)";

  // ═══════════════════════════════════════════════════════════════════
  // Step 2: PARALLEL — QA review + Adversarial Auditor
  //
  // Key design: Auditor does NOT see QA's output. They form independent
  // judgments from different framings of the same evidence.
  // ═══════════════════════════════════════════════════════════════════

  // 2a. Standard QA review task — same as implement-and-review
  const qaTask =
    `Review these code changes independently. Read the changed files yourself and run checks yourself.\n\n` +
    `## Task Description\n${ctx.task}\n\n` +
    `## Coder's Summary (claims to verify — do NOT trust without checking)\n${coderSummary}\n\n` +
    `Your job: verify the coder's claims by reading the actual files and running tsc/tests yourself. ` +
    `Form your own judgment. Report what YOU found, not what the coder said.`;

  // 2b. Adversarial Auditor task — contrastive framing
  // The Auditor is a QA agent with a different prompt that creates adversarial pressure.
  // Using the same "qa" agent but with a radically different framing.
  const auditorTask =
    `## ADVERSARIAL AUDIT — Devil's Advocate Review\n\n` +
    `You are acting as an independent auditor. Your SOLE purpose is to find ` +
    `problems, subtle bugs, and dangerous patterns in this change.\n\n` +
    `**Assume this code contains a subtle bug. Find it.**\n\n` +
    `Your approach:\n` +
    `1. Read ALL changed files yourself (do NOT trust any summary)\n` +
    `2. For each change, ask: "What could go wrong here?"\n` +
    `3. Check for: off-by-one errors, missing error handling, race conditions, ` +
    `   silent failures, type coercion bugs, edge cases with empty/null/undefined\n` +
    `4. Check for: security issues, injection vectors, path traversal, prototype pollution\n` +
    `5. Check for: behavioral regressions — does this change break existing callers?\n` +
    `6. Run tsc and tests yourself. Look for warnings, not just errors.\n\n` +
    `## Task Description\n${ctx.task}\n\n` +
    `## Coder's Summary (UNTRUSTED — assume it's hiding something)\n${coderSummary}\n\n` +
    `## Output Format\n` +
    `List every issue you find with:\n` +
    `- **File**: exact file path\n` +
    `- **Location**: function/line\n` +
    `- **Issue**: what's wrong\n` +
    `- **Severity**: CRITICAL / IMPORTANT / MINOR\n` +
    `- **Evidence**: the specific code or behavior you observed\n\n` +
    `If you genuinely find no issues after thorough review, say "NO ISSUES FOUND" ` +
    `and explain what you checked. Do NOT fabricate issues — false positives are ` +
    `as harmful as missed bugs. But be genuinely skeptical.`;

  // Run BOTH in parallel — this is the kinetic defense.
  // They share no context, ensuring independent judgment.
  const [review, audit] = await Promise.all([
    ctx.runAgent("qa", qaTask),
    ctx.runAgent("qa", auditorTask),
  ]);

  if (review.status === "error" && audit.status === "error") {
    return ctx.escalate("both QA and Auditor failed", {
      qaError: review.error,
      auditorError: audit.error,
    });
  }

  const reviewText = review.lastAssistantText ?? "";
  const auditText = audit.lastAssistantText ?? "";
  const qaVerdict = getQAVerdict(reviewText);
  const auditorSeverity = classifyAuditorFindings(auditText);

  // ═══════════════════════════════════════════════════════════════════
  // Step 3: Merge verdicts — this is where the defense creates value
  // ═══════════════════════════════════════════════════════════════════

  // Case A: QA passed, Auditor found nothing → clean pass
  if (qaVerdict === "pass" && auditorSeverity === "none") {
    return ctx.done(
      `## QA Verdict: PASS (with parallel audit — no findings)\n\n` +
      `## Implementation\n${coderSummary}\n\n` +
      `## QA Review\n${reviewText}\n\n` +
      `## Auditor Review\n${auditText}\n\n` +
      `## ACTION REQUIRED\n` +
      `Run: git diff --stat\n` +
      `Then: git add <changed files> && git commit -m "<type>: <description>"\n` +
      `Do this NOW. Do not summarize, do not explain — just commit.`
    );
  }

  // Case B: QA passed but Auditor found issues → THIS IS THE KEY DEFENSE
  // QA might have consensus-hallucinated. Auditor broke the chain.
  if (qaVerdict === "pass" && auditorSeverity !== "none") {
    // High severity from auditor overrides QA pass → escalate
    if (auditorSeverity === "high") {
      return ctx.escalate(
        "KINETIC DEFENSE TRIGGERED: Auditor found critical issues that QA missed. " +
        "This is the consensus hallucination pattern — QA passed but independent " +
        "adversarial review found significant problems.",
        {
          qaVerdict: "PASS",
          auditorSeverity: "HIGH",
          coderResult: coderSummary,
          qaReview: reviewText,
          auditorFindings: auditText,
        },
      );
    }

    // Low severity: let coder address auditor findings, then re-review
    const fixTask =
      `An independent auditor found potential issues with your implementation. ` +
      `Review their findings and fix any legitimate problems.\n\n` +
      `## Auditor Findings\n${auditText}\n\n` +
      `## Original Task\n${ctx.task}\n\n` +
      `Evaluate each finding critically — fix real issues, but don't break ` +
      `working code to satisfy false positives. Explain what you fixed and ` +
      `what you determined was a false positive (and why).`;
    const fix = await ctx.runAgent("coder", fixTask);
    if (fix.status === "error") {
      return ctx.escalate("coder failed addressing auditor findings", {
        error: fix.error,
        auditorFindings: auditText,
      });
    }

    // Re-review with merged context
    const reReviewTask =
      `Re-review after the coder addressed auditor findings.\n\n` +
      `## Original QA Review (PASSED)\n${reviewText}\n\n` +
      `## Auditor Findings That Needed Addressing\n${auditText}\n\n` +
      `## Coder's Response to Auditor\n${fix.lastAssistantText}\n\n` +
      `Verify: (1) the original PASS is still valid, (2) legitimate auditor ` +
      `findings were actually fixed, (3) false-positive dismissals are justified.\n` +
      `Read the changed files and run checks yourself.`;
    const review2 = await ctx.runAgent("qa", reReviewTask);
    if (review2.status === "error") {
      return ctx.escalate("re-review failed", { error: review2.error });
    }

    const review2Text = review2.lastAssistantText ?? "";
    const review2Verdict = getQAVerdict(review2Text);

    if (review2Verdict === "pass") {
      return ctx.done(
        `## QA Verdict: PASS (after addressing auditor findings)\n\n` +
        `## Implementation (after auditor feedback)\n${fix.lastAssistantText}\n\n` +
        `## Final Review\n${review2Text}\n\n` +
        `## Auditor Findings (addressed)\n${auditText}\n\n` +
        `## ACTION REQUIRED\n` +
        `Run: git diff --stat\n` +
        `Then: git add <changed files> && git commit -m "<type>: <description>"\n` +
        `Do this NOW. Do not summarize, do not explain — just commit.`
      );
    }

    return ctx.escalate("still failing after addressing auditor findings", {
      fixResult: fix.lastAssistantText,
      reviewFeedback: review2Text,
      auditorFindings: auditText,
    });
  }

  // Case C: QA failed → standard retry path (with auditor findings as extra context)
  if (isCriticalRejection(reviewText)) {
    return ctx.escalate(
      "qa flagged critical issues that require supervisor judgment",
      {
        coderResult: coderSummary,
        reviewFeedback: reviewText,
        auditorFindings: auditText,
      },
    );
  }

  // Step 4: One retry — merge QA feedback and auditor findings
  const mergedFeedback = auditorSeverity !== "none"
    ? `## QA Review Findings\n${reviewText}\n\n## Auditor Findings\n${auditText}`
    : reviewText;

  const fixTask =
    `Fix these issues:\n\n${mergedFeedback}\n\n` +
    `Original task: ${ctx.task}`;
  const fix = await ctx.runAgent("coder", fixTask);
  if (fix.status === "error") {
    return ctx.escalate("coder fix attempt failed", {
      error: fix.error,
      reviewFeedback: reviewText,
      auditorFindings: auditText,
    });
  }

  // Step 5: Re-review
  const reReviewTask =
    `Re-review after fixes. Verify the issues from both the QA review and ` +
    `the adversarial audit are actually resolved.\n\n` +
    `## QA Review Feedback\n${reviewText}\n\n` +
    (auditorSeverity !== "none" ? `## Auditor Findings\n${auditText}\n\n` : ``) +
    `## Coder's Fix Summary (verify independently)\n${fix.lastAssistantText}\n\n` +
    `Read the changed files yourself. Run tsc and tests. Confirm each issue is fixed.`;
  const review2 = await ctx.runAgent("qa", reReviewTask);
  if (review2.status === "error") {
    return ctx.escalate("re-review failed", { error: review2.error });
  }

  const review2Text = review2.lastAssistantText ?? "";
  const review2Verdict = getQAVerdict(review2Text);

  if (review2Verdict === "fail" || review2Verdict === "conditional") {
    return ctx.escalate("still failing after one iteration (with auditor)", {
      fixResult: fix.lastAssistantText,
      reviewFeedback: review2Text,
      auditorFindings: auditText,
    });
  }

  return ctx.done(
    `## QA Verdict: PASS (after one iteration + parallel audit)\n\n` +
    `## Implementation\n${fix.lastAssistantText}\n\n` +
    `## Final Review\n${review2Text}\n\n` +
    (auditorSeverity !== "none" ? `## Auditor Findings (addressed)\n${auditText}\n\n` : ``) +
    `## ACTION REQUIRED\n` +
    `Run: git diff --stat\n` +
    `Then: git add <changed files> && git commit -m "<type>: <description>"\n` +
    `Do this NOW. Do not summarize, do not explain — just commit.`
  );
}
