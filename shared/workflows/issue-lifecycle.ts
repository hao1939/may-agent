/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * issue-lifecycle — Event-triggered pipeline: investigate → design → review → implement → verify.
 *
 * Triggered by: metric regression, test failure, agent-reported issue, Hao request.
 * NOT triggered by: heartbeat polling.
 *
 * Each phase is a separate agent session. The workflow orchestrates the full
 * lifecycle as pure JS — no heartbeat involvement, runs to completion.
 *
 * ## Task Format
 *
 *   issue: <description of the issue>
 *   trigger: <what event caused this — metric, failure, discovery>
 *   worker: <agent name>           — does investigation + implementation (default: tech-lead)
 *   reviewer: <agent name>         — reviews design (default: bob)
 *   project: <path to project.md>  — optional, reuse existing project file
 *   severity: low|medium|high      — high skips design-review for speed
 *
 * ## Relationship to other workflows
 *
 * - persistent-task: called BY this workflow for Phase 4 (implementation loop)
 * - skill-lifecycle: same pattern (discover→draft→test→deploy) but for skills
 * - implement-and-verify: lightweight code-only version (no investigation/design)
 */

export const name: string = "issue-lifecycle";

export const description: string =
  "Full issue lifecycle: investigate → design → review → implement → verify. " +
  "Event-triggered, runs to completion. " +
  "Task: 'issue: <description>' with optional worker/reviewer/severity headers.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ── Parse task headers ───────────────────────────────────────────
  const raw = ctx.task;

  const issueMatch = raw.match(/^issue:\s*(.+)$/im);
  const issue = issueMatch?.[1]?.trim() ?? raw.trim();

  const triggerMatch = raw.match(/^trigger:\s*(.+)$/im);
  const trigger = triggerMatch?.[1]?.trim() ?? "manual";

  const workerMatch = raw.match(/^worker:\s*(\S+)/im);
  const worker = workerMatch?.[1] ?? "tech-lead";

  const reviewerMatch = raw.match(/^reviewer:\s*(\S+)/im);
  const reviewer = reviewerMatch?.[1] ?? "bob";

  const projectMatch = raw.match(/^project:\s*(.+)$/im);
  const projectPath = projectMatch?.[1]?.trim() ?? null;

  const severityMatch = raw.match(/^severity:\s*(\S+)/im);
  const severity = (severityMatch?.[1] ?? "medium").toLowerCase();

  ctx.emit({ type: "workflow_start", workflow: "issue-lifecycle", task: issue });

  // ── Phase 1: INVESTIGATE — find root cause ───────────────────────

  ctx.emit({ type: "step_start", step: "investigate" });

  const investigateTask =
    `## Phase 1: INVESTIGATE — find the root cause of this issue.\n\n` +
    `**Issue:** ${issue}\n` +
    `**Trigger:** ${trigger}\n\n` +
    `### Instructions\n` +
    `1. Reproduce or confirm the issue. Look at real data — logs, metrics, code, session history.\n` +
    `2. Trace the root cause. Don't stop at symptoms.\n` +
    `3. Assess scope: is this a one-line fix, a config change, or a design problem?\n` +
    `4. Write your findings to workspace/issue-investigation.md:\n` +
    `   - **Issue**: what's happening\n` +
    `   - **Root cause**: why it's happening\n` +
    `   - **Scope**: one-line-fix | config-change | needs-design\n` +
    `   - **Proposed approach**: how to fix it (1-3 sentences)\n` +
    `   - **Evidence**: specific files, logs, metrics that prove the root cause\n` +
    `5. If the issue is NOT real (false alarm, already fixed, can't reproduce):\n` +
    `   - Write "NOT AN ISSUE" to workspace/issue-investigation.md with explanation.\n\n` +
    `### Output\n` +
    `You MUST write to workspace/issue-investigation.md.`;

  const investigate = await ctx.runAgent(worker, investigateTask);
  if (investigate.status === "error") {
    return ctx.escalate("Phase 1 (investigate) failed", { error: investigate.error });
  }

  const investigateText = investigate.lastAssistantText ?? "";
  const investigateUpper = investigateText.toUpperCase();

  // Early exit: not a real issue
  if (
    investigateUpper.includes("NOT AN ISSUE") ||
    investigateUpper.includes("ALREADY FIXED") ||
    investigateUpper.includes("FALSE ALARM") ||
    investigateUpper.includes("CANNOT REPRODUCE")
  ) {
    return ctx.done(
      `## Issue Lifecycle: Not an issue\n\n` +
      `**Issue:** ${issue}\n**Trigger:** ${trigger}\n\n` +
      `Investigation found this is not a real issue or is already resolved.\n\n${investigateText}`,
    );
  }

  // Early exit: one-line fix — skip design + review, go straight to implement
  const isSimple =
    investigateUpper.includes("ONE-LINE FIX") ||
    investigateUpper.includes("CONFIG CHANGE") ||
    investigateUpper.includes("SCOPE: ONE-LINE") ||
    investigateUpper.includes("SCOPE: CONFIG");

  if (isSimple) {
    ctx.emit({ type: "step_start", step: "implement-simple" });

    const simpleFix =
      `## Quick fix — implement and verify.\n\n` +
      `**Issue:** ${issue}\n\n` +
      `### Investigation findings\n${ctx.summarize(investigate)}\n\n` +
      `### Instructions\n` +
      `1. Read workspace/issue-investigation.md for the root cause and proposed approach.\n` +
      `2. Implement the fix.\n` +
      `3. Run \`bun run check\` (tsc) to verify no type errors.\n` +
      `4. If there are tests, run them.\n` +
      `5. Commit the fix.\n` +
      `6. Verify the fix actually resolves the issue (check the same evidence from investigation).`;

    const fix = await ctx.runAgent(worker, simpleFix);
    if (fix.status === "error") {
      return ctx.escalate("Simple fix failed", { error: fix.error });
    }

    return ctx.done(
      `## Issue Lifecycle: Simple fix applied\n\n` +
      `**Issue:** ${issue}\n**Trigger:** ${trigger}\n**Scope:** simple fix\n\n` +
      `### Investigation\n${ctx.summarize(investigate)}\n\n` +
      `### Fix\n${ctx.summarize(fix)}`,
    );
  }

  // ── Phase 2: DESIGN — write a fix design with milestones ─────────

  ctx.emit({ type: "step_start", step: "design" });

  const designPath = projectPath ?? `agents/${worker}/workspace/projects/issue-${Date.now()}.md`;

  const designTask =
    `## Phase 2: DESIGN a fix for this issue.\n\n` +
    `**Issue:** ${issue}\n\n` +
    `### Investigation findings\n${ctx.summarize(investigate)}\n\n` +
    `### Instructions\n` +
    `1. Read workspace/issue-investigation.md for full root cause analysis.\n` +
    `2. Write a design document to ${designPath} with:\n` +
    `   - **Goal**: what success looks like (measurable)\n` +
    `   - **Approach**: how to fix it (specific files, specific changes)\n` +
    `   - **Milestones**: numbered, checkable milestones ([ ] format)\n` +
    `   - **Risks**: what could go wrong\n` +
    `   - **Verification**: how to confirm the fix works (metric, test, or manual check)\n` +
    `3. Keep it concrete — file paths, function names, specific changes. Not "improve the system."\n\n` +
    `### Output\n` +
    `Write the design to: ${designPath}`;

  const design = await ctx.runAgent(worker, designTask);
  if (design.status === "error") {
    return ctx.escalate("Phase 2 (design) failed", { error: design.error });
  }

  // ── Phase 3: REVIEW — reviewer checks the design ─────────────────

  // Skip review for high-severity (speed) or if reviewer == worker
  const skipReview = severity === "high" || reviewer === worker;

  let reviewText = "";
  if (!skipReview) {
    ctx.emit({ type: "step_start", step: "review" });

    const reviewTask =
      `## Phase 3: REVIEW this design.\n\n` +
      `**Issue:** ${issue}\n\n` +
      `### Instructions\n` +
      `1. Read the design at: ${designPath}\n` +
      `2. Read workspace/issue-investigation.md for root cause context.\n` +
      `3. Evaluate:\n` +
      `   - Does the approach address the root cause (not just symptoms)?\n` +
      `   - Are milestones concrete and checkable?\n` +
      `   - Are there risks the designer missed?\n` +
      `   - Is the approach the simplest that could work?\n` +
      `4. Write your verdict:\n` +
      `   - "APPROVED" — design is good, proceed to implement\n` +
      `   - "APPROVED WITH NOTES: <notes>" — proceed but incorporate feedback\n` +
      `   - "REVISE: <what needs changing>" — design needs rework (blocks implementation)\n` +
      `   - "REJECT: <reason>" — fundamental approach is wrong\n\n` +
      `### Output\n` +
      `State your verdict clearly. APPROVED / REVISE / REJECT.`;

    const review = await ctx.runAgent(reviewer, reviewTask);
    if (review.status === "error") {
      return ctx.escalate("Phase 3 (review) failed", { error: review.error });
    }

    reviewText = review.lastAssistantText ?? "";
    const reviewUpper = reviewText.toUpperCase();

    if (reviewUpper.includes("REJECT")) {
      return ctx.done(
        `## Issue Lifecycle: Design REJECTED\n\n` +
        `**Issue:** ${issue}\n**Trigger:** ${trigger}\n\n` +
        `Reviewer (${reviewer}) rejected the design.\n\n${reviewText}`,
      );
    }

    if (reviewUpper.includes("REVISE") && !reviewUpper.includes("APPROVED")) {
      // Send back for redesign (one retry)
      ctx.emit({ type: "step_start", step: "redesign" });

      const redesignTask =
        `## Phase 2b: REVISE your design based on review feedback.\n\n` +
        `**Issue:** ${issue}\n\n` +
        `### Review feedback\n${ctx.summarize(review)}\n\n` +
        `### Instructions\n` +
        `1. Read the review feedback above.\n` +
        `2. Read your design at: ${designPath}\n` +
        `3. Revise the design to address the feedback.\n` +
        `4. Update the file at: ${designPath}\n`;

      const redesign = await ctx.runAgent(worker, redesignTask);
      if (redesign.status === "error") {
        return ctx.escalate("Redesign failed", { error: redesign.error });
      }
    }
  }

  // ── Phase 4: IMPLEMENT — do the actual work ──────────────────────

  ctx.emit({ type: "step_start", step: "implement" });

  const implTask =
    `## Phase 4: IMPLEMENT the fix.\n\n` +
    `**Issue:** ${issue}\n\n` +
    `### Instructions\n` +
    `1. Read the design at: ${designPath}\n` +
    `2. Implement each milestone in order.\n` +
    `3. After each milestone:\n` +
    `   - Run \`bun run check\` (tsc)\n` +
    `   - Run relevant tests if they exist\n` +
    `   - Check the milestone checkbox in the design file\n` +
    `4. Commit your changes after completing all milestones.\n` +
    `5. If you get stuck on a milestone, explain what's blocking and move on.\n` +
    (reviewText ? `\n### Review notes to incorporate\n${reviewText}\n` : "") +
    `\n### Output\n` +
    `Complete all milestones. Check each one off in ${designPath}.`;

  const impl = await ctx.runAgent(worker, implTask);
  if (impl.status === "error") {
    return ctx.escalate("Phase 4 (implement) failed", { error: impl.error });
  }

  // ── Phase 5: VERIFY — confirm the fix works ─────────────────────

  ctx.emit({ type: "step_start", step: "verify" });

  const verifyTask =
    `## Phase 5: VERIFY the fix works.\n\n` +
    `**Issue:** ${issue}\n**Trigger:** ${trigger}\n\n` +
    `### Instructions\n` +
    `1. Read the design at: ${designPath} — check the verification criteria.\n` +
    `2. Run \`bun run check\` — must pass.\n` +
    `3. Run any relevant tests — must pass.\n` +
    `4. Check the original evidence from the investigation:\n` +
    `   - Read workspace/issue-investigation.md for what was broken\n` +
    `   - Verify those specific things are now fixed\n` +
    `5. If there's a metric associated with this issue, check its current value.\n` +
    `6. Write your verdict:\n` +
    `   - "VERIFIED" — fix works, issue is resolved\n` +
    `   - "NOT FIXED: <what's still broken>" — needs more work\n\n` +
    `### Output\n` +
    `State VERIFIED or NOT FIXED with evidence.`;

  const verify = await ctx.runAgent(worker, verifyTask);
  if (verify.status === "error") {
    return ctx.escalate("Phase 5 (verify) failed", { error: verify.error });
  }

  const verifyText = verify.lastAssistantText ?? "";
  const verifyUpper = verifyText.toUpperCase();

  if (verifyUpper.includes("NOT FIXED")) {
    return ctx.done(
      `## Issue Lifecycle: Fix NOT VERIFIED\n\n` +
      `**Issue:** ${issue}\n**Trigger:** ${trigger}\n\n` +
      `Implementation completed but verification failed. Needs another pass.\n\n` +
      `### Verification result\n${verifyText}`,
    );
  }

  return ctx.done(
    `## Issue Lifecycle: RESOLVED ✅\n\n` +
    `**Issue:** ${issue}\n**Trigger:** ${trigger}\n**Worker:** ${worker}\n` +
    `**Design:** ${designPath}\n\n` +
    `### Summary\n` +
    `- Investigated root cause\n` +
    `${!skipReview ? `- Design reviewed by ${reviewer}\n` : ""}` +
    `- Implemented fix\n` +
    `- Verified working\n\n` +
    `### Verification\n${ctx.summarize(verify)}`,
  );
}
