/**
 * verified-coder workflow — Hard-Gated Coder (Wrapper Verification)
 *
 * Implements the "Ralph Loop" pattern from design-hard-gated-coder.md:
 * a coder agent is run in a loop, and the workflow itself executes
 * a verification command (e.g. `bun run test`, `tsc`, `node script.js`)
 * after each attempt. The workflow only succeeds when the verification
 * command returns exit code 0.
 *
 * Input format (task string):
 *   The task MUST contain a `verifyCommand:` field on its own line.
 *   Everything else is the coding task.
 *
 *   Example:
 *     Write a function that returns 42 and export it from lib.ts.
 *     verifyCommand: bun run typecheck && node -e "assert(require('./lib').answer() === 42)"
 *
 * Max attempts: 3 (configurable via maxAttempts: N in the task).
 */

import { execSync } from "node:child_process";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name: string = "verified-coder";

export const description: string =
  "Coder + verification loop. Runs the coder, then executes a shell " +
  "verification command. Loops until the command exits 0 or max attempts " +
  "(default 3) exhausted. Task must include 'verifyCommand: <cmd>'.";

// ── Input parsing ──────────────────────────────────────────────────────

interface ParsedInput {
  task: string;
  verifyCommand: string;
  maxAttempts: number;
}

function parseInput(raw: string): ParsedInput {
  // Extract verifyCommand
  const verifyMatch = raw.match(/^verifyCommand:\s*(.+)$/m);
  if (!verifyMatch) {
    throw new Error(
      "Task must include a 'verifyCommand: <command>' line. " +
        "This is the shell command that must exit 0 for the task to pass.",
    );
  }
  const verifyCommand = verifyMatch[1].trim();

  // Extract optional maxAttempts
  const attemptsMatch = raw.match(/^maxAttempts:\s*(\d+)$/m);
  const maxAttempts = attemptsMatch ? parseInt(attemptsMatch[1], 10) : 3;

  // The task is everything except the verifyCommand and maxAttempts lines
  const task = raw
    .replace(/^verifyCommand:\s*.+$/m, "")
    .replace(/^maxAttempts:\s*\d+$/m, "")
    .trim();

  if (!task) {
    throw new Error(
      "No coding task found in the input (only found verifyCommand).",
    );
  }

  return { task, verifyCommand, maxAttempts };
}

// ── Verification runner ────────────────────────────────────────────────

interface VerifyResult {
  passed: boolean;
  exitCode: number;
  output: string;
}

function runVerification(command: string): VerifyResult {
  try {
    const output = execSync(command, {
      encoding: "utf-8",
      timeout: 60_000, // 60s timeout for verification
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { passed: true, exitCode: 0, output: output || "(no output)" };
  } catch (err: any) {
    const exitCode = err.status ?? 1;
    const stdout = err.stdout ?? "";
    const stderr = err.stderr ?? "";
    const output =
      [stdout, stderr].filter(Boolean).join("\n").trim() || "(no output)";
    return { passed: false, exitCode, output };
  }
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 0: Parse input
  let parsed: ParsedInput;
  try {
    parsed = parseInput(ctx.task);
  } catch (err: any) {
    return ctx.blocked("Failed to parse verified-coder input", {
      error: err.message,
    });
  }

  const { task, verifyCommand, maxAttempts } = parsed;

  ctx.emit({ type: "step_start", step: "init" });

  let lastVerifyOutput = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // ── Coder step ───────────────────────────────────────────────────
    ctx.emit({ type: "step_start", step: `coder-attempt-${attempt}` });

    let coderTask: string;
    if (attempt === 1) {
      coderTask =
        `${task}\n\n` +
        `## Verification\n` +
        `When done, this command will be run to verify your work:\n` +
        `\`\`\`\n${verifyCommand}\n\`\`\`\n` +
        `It must exit with code 0. Make sure your code passes this check.`;
    } else {
      coderTask =
        `## Fix Required (attempt ${attempt}/${maxAttempts})\n\n` +
        `The verification command failed. Fix the code so it passes.\n\n` +
        `### Original Task\n${task}\n\n` +
        `### Verification Command\n\`\`\`\n${verifyCommand}\n\`\`\`\n\n` +
        `### Verification Output (FAILED)\n\`\`\`\n${lastVerifyOutput}\n\`\`\`\n\n` +
        `Read the error output carefully. Fix the root cause. ` +
        `Do NOT just suppress errors — actually fix the code.\n\n` +
        `**Important**: If the errors are in files OUTSIDE the scope of the original task, ` +
        `finish(partial) explaining which errors are out-of-scope rather than editing files you were told not to touch.`;
    }

    const coder = await ctx.runAgent("coder", coderTask);
    if (coder.status === "error") {
      return ctx.blocked(`Coder failed on attempt ${attempt}/${maxAttempts}`, {
        attempt,
        error: coder.error,
      });
    }

    // ── Verify step ──────────────────────────────────────────────────
    ctx.emit({ type: "step_start", step: `verify-attempt-${attempt}` });

    const verify = runVerification(verifyCommand);

    if (verify.passed) {
      // Success!
      return ctx.done(
        `## Verification PASSED (attempt ${attempt}/${maxAttempts})\n\n` +
          `### Verification Command\n\`\`\`\n${verifyCommand}\n\`\`\`\n\n` +
          `### Verification Output\n\`\`\`\n${verify.output}\n\`\`\`\n\n` +
          `### Coder Summary\n${coder.lastAssistantText ?? "(no output)"}`,
      );
    }

    // Failed — record output for next iteration
    lastVerifyOutput = verify.output;

    if (attempt < maxAttempts) {
      ctx.emit({
        type: "step_start",
        step: `retry-${attempt}`,
      });
    }
  }

  // All attempts exhausted
  return ctx.blocked(`Verification failed after ${maxAttempts} attempts`, {
    verifyCommand,
    lastExitCode: 1,
    lastOutput: lastVerifyOutput,
  });
}
