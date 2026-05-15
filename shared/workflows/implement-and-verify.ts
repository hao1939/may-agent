/**
 * implement-and-verify — Lightweight code workflow (H-070 P3 experiment)
 *
 * Designed to test H-070's prediction that reducing C_fixed (workflow
 * overhead) expands workflow benefit to smaller tasks. This workflow
 * strips out the QA agent entirely and uses shell verification only.
 *
 * Flow:
 *   1. Coder implements (with verification info in prompt)
 *   2. Run verification command (tsc + vitest) — hard gate, no LLM
 *   3. If verify passes → done
 *   4. If verify fails → ONE retry with error output
 *   5. If retry fails → escalate
 *
 * Target C_fixed: ~3-5 ops (vs ~9-15 for implement-and-review)
 *
 * Input format:
 *   The coding task. Optionally include:
 *     verifyCommand: <shell command>   — override auto-detected verification
 *     maxAttempts: <N>                 — override default of 2
 *
 *   If verifyCommand is not specified, defaults to:
 *     ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest --run
 */

import { execSync } from "node:child_process";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { injectFewShot } from "./fewshot-inject-helpers.js";

export const name: string = "implement-and-verify";

export const description: string =
  "Lightweight code workflow: coder implements, shell verifies. " +
  "No QA agent. One retry on verification failure. " +
  "Low overhead (~3-5 ops) for small-to-medium tasks.";

// ── Default verification command ───────────────────────────────────────

const DEFAULT_VERIFY =
  "./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest --run";

// ── Input parsing ──────────────────────────────────────────────────────

interface ParsedInput {
  task: string;
  verifyCommand: string;
  maxAttempts: number;
}

function parseInput(raw: string): ParsedInput {
  // Extract optional verifyCommand
  const verifyMatch = raw.match(/^verifyCommand:\s*(.+)$/m);
  const verifyCommand = verifyMatch ? verifyMatch[1].trim() : DEFAULT_VERIFY;

  // Extract optional maxAttempts (default 2 — keep overhead low)
  const attemptsMatch = raw.match(/^maxAttempts:\s*(\d+)$/m);
  const maxAttempts = attemptsMatch ? parseInt(attemptsMatch[1], 10) : 2;

  // The task is everything except the metadata lines
  const task = raw
    .replace(/^verifyCommand:\s*.+$/m, "")
    .replace(/^maxAttempts:\s*\d+$/m, "")
    .trim();

  if (!task) {
    throw new Error(
      "No coding task found in the input."
    );
  }

  return { task, verifyCommand, maxAttempts };
}

// ── Shell verification ─────────────────────────────────────────────────

interface VerifyResult {
  passed: boolean;
  exitCode: number;
  output: string;
}

function runVerification(command: string): VerifyResult {
  try {
    const output = execSync(command, {
      encoding: "utf-8",
      timeout: 120_000, // 2 min — vitest can be slow
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { passed: true, exitCode: 0, output: output || "(no output)" };
  } catch (err: any) {
    const exitCode = err.status ?? 1;
    const stdout = err.stdout ?? "";
    const stderr = err.stderr ?? "";
    const output =
      [stdout, stderr].filter(Boolean).join("\n").trim() || "(no output)";
    // Truncate to last 3000 chars to keep retry prompts manageable
    const truncated =
      output.length > 3000
        ? "...(truncated)\n" + output.slice(-3000)
        : output;
    return { passed: false, exitCode, output: truncated };
  }
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Parse input
  let parsed: ParsedInput;
  try {
    parsed = parseInput(ctx.task);
  } catch (err: any) {
    return ctx.escalate("Failed to parse implement-and-verify input", {
      error: err.message,
    });
  }

  const { task, verifyCommand, maxAttempts } = parsed;
  let lastVerifyOutput = "";
  let lastCoderText = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // ── Coder step ─────────────────────────────────────────────────
    ctx.emit({ type: "step_start", step: `coder-attempt-${attempt}` });

    let coderTask: string;
    if (attempt === 1) {
      // EXP-050: Removed stateApproach() wrapping — it added 1.76-3.78x
      // overhead with zero quality benefit. See H-085.
      // EXP-094/095: Inject domain-matched few-shot examples (task-level).
      const enrichedTask = injectFewShot(task);
      coderTask =
        `${enrichedTask}\n\n` +
        `## Verification\n` +
        `Your code will be verified with:\n` +
        `\`\`\`\n${verifyCommand}\n\`\`\`\n` +
        `Make sure your changes pass this check.`;
    } else {
      coderTask =
        `## Fix Required (attempt ${attempt}/${maxAttempts})\n\n` +
        `The verification command failed after your previous changes. ` +
        `Fix the code so it passes.\n\n` +
        `### Original Task\n${task}\n\n` +
        `### Verification Command\n\`\`\`\n${verifyCommand}\n\`\`\`\n\n` +
        `### Verification Output (FAILED)\n\`\`\`\n${lastVerifyOutput}\n\`\`\`\n\n` +
        `Read the error output carefully. Fix the root cause.\n\n` +
        `**Important**: If the errors are in files OUTSIDE the scope of the original task, ` +
        `finish(partial) explaining which errors are out-of-scope rather than editing files you were told not to touch.`;
    }

    let coder = await ctx.runAgent("coder", coderTask);
    if (coder.status === "error") {
      // One retry on transient coder errors (only on first attempt)
      if (attempt === 1) {
        coder = await ctx.runAgent("coder", coderTask);
        if (coder.status === "error") {
          return ctx.escalate(
            `Coder failed after retry (attempt ${attempt})`,
            { error: coder.error }
          );
        }
      } else {
        return ctx.escalate(
          `Coder failed on fix attempt ${attempt}`,
          { error: coder.error }
        );
      }
    }

    lastCoderText = coder.lastAssistantText ?? "(no output)";

    // ── Verify step ────────────────────────────────────────────────
    ctx.emit({ type: "step_start", step: `verify-attempt-${attempt}` });

    const verify = runVerification(verifyCommand);

    if (verify.passed) {
      return ctx.done(
        `## Verification PASSED (attempt ${attempt}/${maxAttempts})\n\n` +
          `### Verification Command\n\`\`\`\n${verifyCommand}\n\`\`\`\n\n` +
          `### Coder Summary\n${lastCoderText}\n\n` +
          `### Verification Output\n\`\`\`\n${verify.output.slice(0, 2000)}\n\`\`\`\n\n` +
          `## ⚠️ CALLER: Verify intent yourself\n` +
          `Shell verification confirms the code compiles and tests pass, ` +
          `but does NOT verify the task intent was met. Check the actual ` +
          `files before committing.`
      );
    }

    // Record for next iteration
    lastVerifyOutput = verify.output;
  }

  // All attempts exhausted
  return ctx.escalate(
    `Verification failed after ${maxAttempts} attempts`,
    { verifyCommand, lastOutput: lastVerifyOutput }
  );
}
