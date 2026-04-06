/// <reference path="../../../src/workflow-defs.d.ts" />

/**
 * implement-and-adversarial-review — H-001 Experiment Workflow
 *
 * Same as implement-and-review but adds an adversarial auditor running in
 * parallel with standard QA. The auditor uses contrastive framing ("assume
 * this code has a subtle bug — find it") to break consensus hallucination.
 *
 * This workflow tests H-001: adversarial QA framing increases issue detection.
 * The auditor's findings are tracked separately so we can measure how many
 * additional issues the adversarial framing catches vs standard QA alone.
 *
 * Flow:
 *   1. Coder implements
 *   2. IN PARALLEL: standard QA review + adversarial auditor
 *   3. Merge findings — auditor issues that QA missed trigger a fix cycle
 *   4. One retry for fixable issues
 *
 * Based on archived verify-parallel.ts, modernized to match current
 * implement-and-review.ts patterns (retry logic, verdict extraction,
 * environment-vs-patch distinction).
 */

import { stateApproach } from "../../../src/lib/forced-externalization.js";

export const name: string = "implement-and-adversarial-review";

export const description: string =
  "H-001 experiment: Coder implements, then QA + adversarial auditor " +
  "review in parallel. Tracks how many extra issues the adversarial " +
  "framing catches. One retry for fixable issues.";

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract formal verdict from QA's review text.
 * Matches implement-and-review.ts logic exactly.
 */
function getVerdict(text: string): "pass" | "conditional" | "fail" {
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
  if (u.includes("**FAIL**") && !u.includes("**PASS**")) return "fail";
  return "conditional";
}

/** Check for critical rejections requiring supervisor judgment. */
function isCriticalRejection(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("wrong proposal") ||
    lower.includes("wrong task") ||
    lower.includes("wrong implementation") ||
    lower.includes("implemented the wrong") ||
    lower.includes("policy violation") ||
    lower.includes("policy mismatch") ||
    lower.includes("behavioral regression")
  );
}

/** Classify auditor findings severity. */
function classifyAuditorFindings(text: string): "none" | "low" | "high" {
  const upper = text.toUpperCase();
  const lower = text.toLowerCase();

  // Auditor explicitly says no issues
  if (
    (lower.includes("no issues found") ||
      lower.includes("no bugs found") ||
      lower.includes("no critical") ||
      lower.includes("looks correct") ||
      lower.includes("no significant")) &&
    !upper.includes("BUG") &&
    !upper.includes("VULNERABILITY") &&
    !upper.includes("CRITICAL")
  ) {
    return "none";
  }

  // High severity: critical-class findings
  if (
    upper.includes("CRITICAL") ||
    upper.includes("VULNERABILITY") ||
    upper.includes("SECURITY") ||
    upper.includes("DATA LOSS") ||
    upper.includes("RACE CONDITION") ||
    upper.includes("INJECTION") ||
    lower.includes("silent failure") ||
    lower.includes("silently fails") ||
    lower.includes("undefined behavior")
  ) {
    return "high";
  }

  // Low severity: general concerns
  if (
    upper.includes("BUG") ||
    upper.includes("ISSUE") ||
    upper.includes("PROBLEM") ||
    upper.includes("CONCERN") ||
    upper.includes("WARNING") ||
    upper.includes("FLAW") ||
    upper.includes("ERROR")
  ) {
    return "low";
  }

  return "none";
}

/** Count distinct issues mentioned in review text. */
function countIssues(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  // Count severity markers
  const criticals = (lower.match(/\bcritical\b/g) || []).length;
  const importants = (lower.match(/\bimportant\b/g) || []).length;
  const minors = (lower.match(/\bminor\b/g) || []).length;
  count = criticals + importants + minors;
  // Fallback: count bullet points in issues section
  if (count === 0) {
    const issueSection = lower.match(/issues?\s*\n([\s\S]*?)(?:\n#|\nverd|\n$)/);
    if (issueSection) {
      count = (issueSection[1].match(/^[\s]*[-*]/gm) || []).length;
    }
  }
  return Math.max(count, 0);
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ═══════════════════════════════════════════════════════════════════
  // Step 1: Coder implements (with one retry on session error)
  // H-085: Force coder to externalize approach before coding
  // ═══════════════════════════════════════════════════════════════════
  const coderTask = stateApproach(ctx.task);
  let coder = await ctx.runAgent("coder", coderTask);
  if (coder.status === "error") {
    coder = await ctx.runAgent("coder", coderTask);
    if (coder.status === "error") {
      return ctx.escalate("coder failed after retry", { error: coder.error });
    }
  }

  const coderSummary = coder.lastAssistantText ?? "(no output)";

  // ═══════════════════════════════════════════════════════════════════
  // Step 2: PARALLEL — Standard QA + Adversarial Auditor
  //
  // They run independently with NO shared context.
  // This is the core H-001 design: same evidence, different framing.
  // ═══════════════════════════════════════════════════════════════════

  // 2a. Standard QA task (identical to implement-and-review)
  const qaTask =
    `Phase 1: DIAGNOSE — gather evidence before any verdict.\n` +
    `Read the changed files yourself and run checks yourself.\n\n` +
    `## Task Description\n${ctx.task}\n\n` +
    `## Coder's Summary (claims to verify — do NOT trust without checking)\n${coderSummary}\n\n` +
    `Your job: verify the coder's claims by reading the actual files and running tsc/tests yourself.\n` +
    `IMPORTANT: If vitest fails, determine whether failures are caused by the patch ` +
    `or are pre-existing environment issues. Only blame the patch for failures it introduced.\n\n` +
    `Phase 2: VERDICT — now give your assessment based on Phase 1 evidence.\n` +
    `Form your own judgment. Report what YOU found, not what the coder said.`;

  // 2b. Adversarial auditor task — contrastive framing (H-001 treatment)
  const auditorTask =
    `## ADVERSARIAL CODE AUDIT\n\n` +
    `**Your mission: Try to BREAK this code. Assume it contains subtle bugs. Find them.**\n\n` +
    `You are an independent adversarial auditor. The coder claims this change is correct. ` +
    `Your job is to prove them wrong. Think like an attacker or a QA engineer ` +
    `writing a bug bounty report.\n\n` +
    `### Adversarial Checklist\n` +
    `For EVERY function changed, answer:\n` +
    `- What happens with null/undefined inputs?\n` +
    `- What happens with empty arrays/strings?\n` +
    `- What happens with concurrent calls?\n` +
    `- What happens when this code throws — does the caller handle it?\n` +
    `- Does the type signature match the runtime behavior?\n` +
    `- Are there edge cases where the logic silently produces wrong results?\n\n` +
    `### Your Process\n` +
    `1. Read ALL changed files yourself (do NOT trust the coder's summary)\n` +
    `2. Run tsc --noEmit and vitest --run. Read every warning and failure.\n` +
    `3. For each change, construct a scenario that would break it\n` +
    `4. Check for: off-by-one, missing error handling, race conditions, ` +
    `silent failures, type coercion bugs, unchecked optional access\n` +
    `5. Check for: behavioral regressions — does this change break existing callers?\n\n` +
    `## Task Description\n${ctx.task}\n\n` +
    `## Coder's Summary (UNTRUSTED — your job is to poke holes in it)\n${coderSummary}\n\n` +
    `## Output Format\n` +
    `For each issue found:\n` +
    `- **Severity**: CRITICAL / IMPORTANT / MINOR\n` +
    `- **File**: exact file path\n` +
    `- **Location**: function name or line\n` +
    `- **Issue**: what's wrong\n` +
    `- **Reproduction**: how to trigger it\n` +
    `- **Evidence**: the specific code you read or test output you saw\n\n` +
    `If you genuinely find no issues after thorough review, say "NO ISSUES FOUND" ` +
    `and list what you checked. Do NOT fabricate issues — false positives waste time. ` +
    `But be genuinely adversarial in your search.`;

  // Run both in parallel — independent judgments from different framings
  const [review, audit] = await Promise.all([
    ctx.runAgent("qa", qaTask),
    ctx.runAgent("qa", auditorTask),
  ]);

  if (review.status === "error" && audit.status === "error") {
    return ctx.escalate("both QA and auditor failed", {
      qaError: review.error,
      auditorError: audit.error,
    });
  }

  const reviewText = review.status === "error" ? "(QA session error)" : (review.lastAssistantText ?? "");
  const auditText = audit.status === "error" ? "(auditor session error)" : (audit.lastAssistantText ?? "");
  const qaVerdict = review.status === "error" ? "fail" as const : getVerdict(reviewText);
  const auditorSeverity = audit.status === "error" ? "none" as const : classifyAuditorFindings(auditText);

  // H-001 measurement: count issues found by each approach
  const qaIssueCount = countIssues(reviewText);
  const auditorIssueCount = countIssues(auditText);
  const experimentTag =
    `\n\n## H-001 Experiment Data\n` +
    `- QA issues found: ${qaIssueCount}\n` +
    `- Auditor issues found: ${auditorIssueCount}\n` +
    `- Auditor severity: ${auditorSeverity}\n` +
    `- QA verdict: ${qaVerdict}\n`;

  // ═══════════════════════════════════════════════════════════════════
  // Step 3: Merge verdicts
  // ═══════════════════════════════════════════════════════════════════

  // Case A: Both passed — clean result
  if ((qaVerdict === "pass" || qaVerdict === "conditional") && auditorSeverity === "none") {
    const verdict = qaVerdict === "conditional" ? "CONDITIONAL PASS" : "PASS";
    return ctx.done(
      `## QA Verdict: ${verdict} (with parallel adversarial audit — no findings)\n\n` +
      `## Implementation\n${coderSummary}\n\n` +
      `## QA Review\n${reviewText}\n\n` +
      `## Adversarial Audit\n${auditText}\n` +
      experimentTag +
      `\n## ⚠️ PHASE 4 REQUIRED — DO NOT SKIP\n` +
      `QA PASS is not proof. You MUST verify intent yourself before reporting success:\n` +
      `1. Run \`tsc --noEmit\` — must exit 0\n` +
      `2. Run \`npx vitest --run\` — must pass\n` +
      `3. Verify the *specific ask* was met (read the file, check the output)\n` +
      `4. Only then: git add + commit with evidence\n\n` +
      `"Workflow said PASS" without your own verification = hallucinated success.`,
    );
  }

  // Case B: QA passed but auditor found issues — KINETIC DEFENSE
  if ((qaVerdict === "pass" || qaVerdict === "conditional") && auditorSeverity !== "none") {
    if (auditorSeverity === "high") {
      // High-severity auditor findings override QA pass → escalate
      return ctx.escalate(
        "ADVERSARIAL AUDIT TRIGGERED: Auditor found critical issues that QA missed.",
        {
          qaVerdict,
          auditorSeverity,
          coderResult: coderSummary,
          qaReview: reviewText,
          auditorFindings: auditText,
          h001Data: { qaIssueCount, auditorIssueCount },
        },
      );
    }

    // Low severity: send auditor findings to coder for addressing
    const fixTask =
      `An independent adversarial auditor found potential issues with your implementation. ` +
      `Review each finding critically — fix real issues, but explain why any are false positives.\n\n` +
      `## Auditor Findings\n${auditText}\n\n` +
      `## Original Task\n${ctx.task}\n\n` +
      `IMPORTANT: Address ONLY the specific issues above. ` +
      `Do not fix pre-existing tsc/vitest failures that were not introduced by this patch.`;
    let fix = await ctx.runAgent("coder", fixTask);
    if (fix.status === "error") {
      fix = await ctx.runAgent("coder", fixTask);
      if (fix.status === "error") {
        return ctx.escalate("coder failed addressing auditor findings after retry", {
          error: fix.error,
          auditorFindings: auditText,
        });
      }
    }

    // Re-review with merged context
    const reReviewTask =
      `Phase 1: DIAGNOSE — gather evidence before any verdict.\n` +
      `Re-review after the coder addressed adversarial audit findings.\n\n` +
      `## Original QA Review (${qaVerdict.toUpperCase()})\n${reviewText}\n\n` +
      `## Adversarial Audit Findings\n${auditText}\n\n` +
      `## Coder's Response (verify independently)\n${fix.lastAssistantText}\n\n` +
      `Verify: (1) original work is still valid, (2) legitimate auditor findings ` +
      `were fixed, (3) false-positive dismissals are justified.\n` +
      `IMPORTANT: If vitest fails, determine whether failures are caused by the patch ` +
      `or are pre-existing environment issues.\n\n` +
      `Phase 2: VERDICT — based on Phase 1 evidence.`;
    const review2 = await ctx.runAgent("qa", reReviewTask);
    if (review2.status === "error") {
      return ctx.escalate("re-review failed", { error: review2.error });
    }

    const review2Text = review2.lastAssistantText ?? "";
    const verdict2 = getVerdict(review2Text);

    if (verdict2 === "fail") {
      return ctx.escalate("still failing after addressing auditor findings", {
        fixResult: fix.lastAssistantText,
        reviewFeedback: review2Text,
        auditorFindings: auditText,
      });
    }

    const vLabel = verdict2 === "conditional" ? "CONDITIONAL PASS" : "PASS";
    return ctx.done(
      `## QA Verdict: ${vLabel} (after addressing adversarial audit findings)\n\n` +
      `## Implementation (after auditor feedback)\n${fix.lastAssistantText}\n\n` +
      `## Final Review\n${review2Text}\n\n` +
      `## Adversarial Audit Findings (addressed)\n${auditText}\n` +
      experimentTag +
      `\n## ⚠️ PHASE 4 REQUIRED — DO NOT SKIP\n` +
      `QA PASS is not proof. You MUST verify intent yourself before reporting success:\n` +
      `1. Run \`tsc --noEmit\` — must exit 0\n` +
      `2. Run \`npx vitest --run\` — must pass\n` +
      `3. Verify the *specific ask* was met\n` +
      `4. Only then: git add + commit with evidence`,
    );
  }

  // Case C: QA failed — standard retry path (include auditor findings too)
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

  // Step 4: One retry — merge QA feedback + any auditor findings
  const mergedFeedback =
    auditorSeverity !== "none"
      ? `## QA Review Findings\n${reviewText}\n\n## Adversarial Audit Findings\n${auditText}`
      : reviewText;

  const fixTask =
    `Fix these issues from QA review:\n\n${mergedFeedback}\n\n` +
    `Original task: ${ctx.task}\n\n` +
    `IMPORTANT: Address ONLY the specific issues raised above. ` +
    `Do not fix pre-existing tsc/vitest failures that were not introduced by this patch.`;
  let fix = await ctx.runAgent("coder", fixTask);
  if (fix.status === "error") {
    fix = await ctx.runAgent("coder", fixTask);
    if (fix.status === "error") {
      return ctx.escalate("coder fix attempt failed after retry", {
        error: fix.error,
        reviewFeedback: reviewText,
        auditorFindings: auditText,
      });
    }
  }

  // Step 5: Re-review
  const reReviewTask =
    `Phase 1: DIAGNOSE — gather evidence before any verdict.\n` +
    `Re-review after fixes. Read the changed files yourself and run checks yourself.\n\n` +
    `## Your Original Review Feedback\n${reviewText}\n\n` +
    (auditorSeverity !== "none"
      ? `## Adversarial Audit Findings\n${auditText}\n\n`
      : ``) +
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
      auditorFindings: auditText,
    });
  }

  const verdict2 = verdict2Result === "conditional" ? "CONDITIONAL PASS" : "PASS";
  return ctx.done(
    `## QA Verdict: ${verdict2} (after one iteration + adversarial audit)\n\n` +
    `## Implementation (after one iteration)\n${fix.lastAssistantText}\n\n` +
    `## Final Review\n${review2Text}\n\n` +
    (auditorSeverity !== "none"
      ? `## Adversarial Audit Findings (addressed)\n${auditText}\n\n`
      : ``) +
    experimentTag +
    `\n## ⚠️ PHASE 4 REQUIRED — DO NOT SKIP\n` +
    `QA PASS is not proof. You MUST verify intent yourself before reporting success:\n` +
    `1. Run \`tsc --noEmit\` — must exit 0\n` +
    `2. Run \`npx vitest --run\` — must pass\n` +
    `3. Verify the *specific ask* was met\n` +
    `4. Only then: git add + commit with evidence`,
  );
}
