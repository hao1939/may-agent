/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * research-to-production — Closes the loop from hypothesis to deployed code.
 *
 * THE PROBLEM THIS SOLVES:
 *   Bob has 116 experiments and 52 hypotheses. Only ~5 became code.
 *   The gap is NOT ideation — it's the handoff. Nobody enforces the
 *   "does this work? → code it → test it → ship it" pipeline.
 *
 * This workflow enforces a 4-step pipeline:
 *   1. ASSESS:  Bob reads the research and decides: is this actionable?
 *              If no → done. If yes → produce a concrete implementation spec.
 *   2. BUILD:   Tech-lead (or coder) implements the spec with tests.
 *              Hard-gated by tsc + vitest.
 *   3. VERIFY:  Run verification. If it fails, one retry.
 *   4. REPORT:  Bob writes up the result: what shipped, what we learned.
 *
 * Input format:
 *   Plain text describing what to close the loop on. Examples:
 *
 *     "Close the loop on KE-052: structural access constraints.
 *      The finding says tool output truncation is the #1 agent failure cause.
 *      Read agents/shared/knowledge/entries/KE-052.md for details."
 *
 *     "Ship EXP-132 findings: path hallucination guard works.
 *      Already has results at agents/shared/knowledge/experiments/EXP-132/results.md"
 *
 *   Optional headers:
 *     researcher: bob          # who does assess + report (default: bob)
 *     builder: tech-lead       # who builds (default: tech-lead)
 *     verifyCommand: <cmd>     # override verification (default: tsc + vitest)
 *     skipAssess: true         # skip assessment if spec already exists
 */

import { execSync } from "node:child_process";

export const name: string = "research-to-production";

export const description: string =
  "Close the research→production loop. Takes a hypothesis, experiment, or knowledge entry " +
  "and enforces: assess actionability → build implementation → verify → report. " +
  "Input: plain text describing what to ship. Optional headers: researcher, builder, verifyCommand, skipAssess.";

// ── Input parsing ──────────────────────────────────────────────────────

interface ParsedInput {
  researcher: string;
  builder: string;
  verifyCommand: string;
  skipAssess: boolean;
  task: string;
}

function parseInput(raw: string): ParsedInput {
  let researcher = "bob";
  let builder = "tech-lead";
  let verifyCommand = "./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest --run 2>&1 | tail -30";
  let skipAssess = false;
  let task = raw;

  const researcherMatch = raw.match(/^researcher:\s*(\S+)\s*$/im);
  if (researcherMatch) {
    researcher = researcherMatch[1];
    task = task.replace(researcherMatch[0], "").trim();
  }

  const builderMatch = raw.match(/^builder:\s*(\S+)\s*$/im);
  if (builderMatch) {
    builder = builderMatch[1];
    task = task.replace(builderMatch[0], "").trim();
  }

  const verifyMatch = raw.match(/^verifyCommand:\s*(.+)$/im);
  if (verifyMatch) {
    verifyCommand = verifyMatch[1].trim();
    task = task.replace(verifyMatch[0], "").trim();
  }

  const skipMatch = raw.match(/^skipAssess:\s*(true|yes)\s*$/im);
  if (skipMatch) {
    skipAssess = true;
    task = task.replace(skipMatch[0], "").trim();
  }

  return { researcher, builder, verifyCommand, skipAssess, task };
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const input = parseInput(ctx.task);

  if (!input.task.trim()) {
    return ctx.escalate("No task provided. Describe what research to close the loop on.");
  }

  // ── Phase 1: ASSESS — Is this actionable? What exactly should we build? ─

  let spec = "";

  if (!input.skipAssess) {
    ctx.emit({ type: "step_start", step: "assess" });

    const assessTask =
      `## Phase 1: ASSESS — Is this research actionable?\n\n` +
      `${input.task}\n\n` +
      `### Your job\n` +
      `1. Read the referenced research (knowledge entry, experiment, hypothesis).\n` +
      `2. Decide: Can this become a concrete code change RIGHT NOW?\n` +
      `   - If the research is too vague, theoretical, or needs more experiments → write "NOT ACTIONABLE" and explain why.\n` +
      `   - If it contradicts other evidence → write "CONFLICTING" and cite the contradiction.\n` +
      `   - If it's already implemented → write "ALREADY SHIPPED" and cite where.\n` +
      `3. If actionable → Write a concrete implementation spec:\n` +
      `   - WHAT: exactly which file(s) to create or modify\n` +
      `   - HOW: the specific code changes (function signatures, logic, constants)\n` +
      `   - TESTS: what tests to write and what they should verify\n` +
      `   - RISK: what could go wrong, what's the rollback plan\n\n` +
      `Write your spec to workspace/r2p-spec.md. This will be handed to the builder.\n\n` +
      `### Output format\n` +
      `Your LAST line of output must be exactly one of:\n` +
      `  VERDICT: ACTIONABLE\n` +
      `  VERDICT: NOT ACTIONABLE\n` +
      `  VERDICT: CONFLICTING\n` +
      `  VERDICT: ALREADY SHIPPED\n`;

    const assessResult = await ctx.runAgent(input.researcher, assessTask);

    if (assessResult.status === "error") {
      return ctx.escalate("Phase 1 (assess) failed", { error: assessResult.lastAssistantText });
    }

    const assessText = (assessResult.lastAssistantText ?? "").toUpperCase();

    // Check verdict
    if (assessText.includes("NOT ACTIONABLE") || assessText.includes("NOT_ACTIONABLE")) {
      return ctx.done(
        `Research assessed as NOT ACTIONABLE. ${input.researcher} determined this needs more work before it can become code. ` +
        `See the assessment for details.`
      );
    }

    if (assessText.includes("CONFLICTING")) {
      return ctx.done(
        `Research assessed as CONFLICTING — contradicts other evidence. ` +
        `Needs resolution before implementation.`
      );
    }

    if (assessText.includes("ALREADY SHIPPED")) {
      return ctx.done(
        `Research ALREADY SHIPPED — the finding is already in production code.`
      );
    }

    if (!assessText.includes("ACTIONABLE")) {
      // Researcher didn't follow the format, but let's check if they wrote a spec
      return ctx.escalate(
        `Researcher didn't output a clear VERDICT. Expected one of: ACTIONABLE, NOT ACTIONABLE, CONFLICTING, ALREADY SHIPPED. ` +
        `Got: ${(assessResult.lastAssistantText ?? "").slice(-200)}`
      );
    }

    // Extract the spec from the researcher's output or workspace file
    spec =
      `## Implementation Spec (from ${input.researcher}'s assessment)\n\n` +
      `The researcher has written a detailed spec to their workspace/r2p-spec.md.\n` +
      `Read agents/${input.researcher}/workspace/r2p-spec.md for the full specification.\n\n` +
      `Original research context:\n${input.task}`;

    ctx.emit({ type: "step_done", step: "assess", result: assessResult });
  } else {
    spec = input.task; // Skip assess, use task as spec directly
  }

  // ── Phase 2: BUILD — Implement the spec ─────────────────────────────

  ctx.emit({ type: "step_start", step: "build" });

  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retryContext = attempt > 1
      ? `\n\n### RETRY — Previous attempt failed verification\nFix the issues shown below and try again.\n`
      : "";

    const buildTask =
      `## Phase 2: BUILD — Implement this research finding as production code\n\n` +
      `${spec}\n\n` +
      `### Requirements\n` +
      `1. Read the spec carefully (especially agents/${input.researcher}/workspace/r2p-spec.md if it exists).\n` +
      `2. Implement the code changes described in the spec.\n` +
      `3. Write tests that verify the implementation works.\n` +
      `4. Run the verification command to confirm everything passes:\n` +
      `   ${input.verifyCommand}\n` +
      `5. Commit to a review branch: git checkout -b review/<descriptive-name>\n` +
      `6. Do NOT merge to main — the review gate handles that.\n` +
      `${retryContext}`;

    const buildResult = await ctx.runAgent(input.builder, buildTask);

    if (buildResult.status === "error" && attempt < maxAttempts) {
      ctx.emit({ type: "step_done", step: `build-attempt-${attempt}`, result: buildResult });
      continue; // Retry
    }

    if (buildResult.status === "error") {
      return ctx.escalate(
        `Build failed after ${maxAttempts} attempts. ` +
        `Builder (${input.builder}) could not implement the spec. ` +
        `Last error: ${(buildResult.lastAssistantText ?? "").slice(-300)}`
      );
    }

    ctx.emit({ type: "step_done", step: "build", result: buildResult });

    // ── Phase 3: VERIFY — Hard gate ──────────────────────────────────

    ctx.emit({ type: "step_start", step: "verify" });

    let verifyPassed = false;
    let verifyOutput = "";

    try {
      verifyOutput = execSync(input.verifyCommand, {
        timeout: 120_000,
        encoding: "utf-8",
        cwd: process.cwd(),
      });
      verifyPassed = true;
    } catch (e: any) {
      verifyOutput = e.stdout ?? e.message ?? "Verification failed";
      verifyPassed = false;
    }

    if (verifyPassed) {
      ctx.emit({
        type: "step_done",
        step: "verify",
        result: { status: "done", lastAssistantText: "Verification passed", messages: [], duration: "0s", outputDir: "", sessionId: "" } as any,
      });

      // ── Phase 4: REPORT — Document what shipped ────────────────────

      ctx.emit({ type: "step_start", step: "report" });

      const reportTask =
        `## Phase 4: REPORT — Document what just shipped\n\n` +
        `A code change based on your research was just built and verified.\n\n` +
        `Original research: ${input.task}\n\n` +
        `### Instructions\n` +
        `1. Check what was committed: run git log --oneline -5 and git diff HEAD~1 --stat\n` +
        `2. Update the relevant knowledge entry/experiment/hypothesis to reflect the finding is now DEPLOYED.\n` +
        `3. Write a brief (3-5 lines) to workspace/r2p-report.md:\n` +
        `   - What was the research finding?\n` +
        `   - What code was shipped?\n` +
        `   - How does this improve the system?\n` +
        `4. Update PRIORITY-TRACKER.md if applicable.\n` +
        `5. If the experiment/hypothesis has a status field, update it to DEPLOYED or SHIPPED.\n`;

      const reportResult = await ctx.runAgent(input.researcher, reportTask);

      ctx.emit({ type: "step_done", step: "report", result: reportResult });

      return ctx.done(
        `Research→Production loop CLOSED. ` +
        `Assessed by ${input.researcher}, built by ${input.builder}, verification passed, report written. ` +
        `Research finding is now in production code.`
      );
    }

    // Verification failed — retry if we have attempts left
    if (attempt < maxAttempts) {
      spec += `\n\n### Verification failure (attempt ${attempt}):\n\`\`\`\n${verifyOutput.slice(-2000)}\n\`\`\``;
      ctx.emit({
        type: "step_done",
        step: `verify-attempt-${attempt}`,
        result: { status: "error", lastAssistantText: verifyOutput.slice(-500), messages: [], duration: "0s", outputDir: "", sessionId: "" } as any,
      });
      continue;
    }

    // All attempts exhausted
    return ctx.escalate(
      `Build passed but verification failed after ${maxAttempts} attempts.\n` +
      `Verify command: ${input.verifyCommand}\n` +
      `Last output:\n${verifyOutput.slice(-1000)}`
    );
  }

  return ctx.escalate("Unexpected: exited build loop without result");
}
