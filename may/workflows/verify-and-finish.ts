/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * verify-and-finish — Safe Verification Workflow
 *
 * Replaces the "Hard Guard" approach (cancelled per Req 8b381f87) with a
 * behavioral workflow that ensures agents verify their work before claiming
 * success. Instead of blocking finish() at runtime, this provides a standard
 * callable path: execute task → verify → retry if failed → escalate if stuck.
 *
 * Input format (task string):
 *   The task MAY contain an `agent:` line (default: "coder") and a
 *   `verifyCommand:` line (optional — if absent, the agent is asked to
 *   self-verify by running a proof command).
 *
 *   Example:
 *     agent: coder
 *     Fix the off-by-one error in src/lib/parser.ts
 *     verifyCommand: node -e "require('./src/lib/parser').parse('test')"
 *
 * Max retries: 2 (the agent gets up to 3 total attempts: initial + 2 fixes).
 *
 * Design context: agents/bob/workspace/synthesis/strategy-workflows-pivot.md
 */

import { execSync } from "node:child_process";

export const name: string = "verify-and-finish";

export const description: string =
  "Safe verification workflow. Runs an agent on a task, then verifies " +
  "the result (via shell command or agent self-check). Retries up to 2x " +
  "on failure, then escalates. Use instead of raw delegation for critical tasks.";

// ── Input parsing ──────────────────────────────────────────────────────

interface ParsedInput {
  agent: string;
  task: string;
  verifyCommand: string | null;
  maxRetries: number;
}

function parseInput(raw: string): ParsedInput {
  // Extract agent (default: coder)
  const agentMatch = raw.match(/^agent:\s*(.+)$/m);
  const agent = agentMatch ? agentMatch[1].trim() : "coder";

  // Extract optional verifyCommand
  const verifyMatch = raw.match(/^verifyCommand:\s*(.+)$/m);
  const verifyCommand = verifyMatch ? verifyMatch[1].trim() : null;

  // Extract optional maxRetries (default: 2)
  const retriesMatch = raw.match(/^maxRetries:\s*(\d+)$/m);
  const maxRetries = retriesMatch ? parseInt(retriesMatch[1], 10) : 2;

  // The task is everything except the metadata lines
  const task = raw
    .replace(/^agent:\s*.+$/m, "")
    .replace(/^verifyCommand:\s*.+$/m, "")
    .replace(/^maxRetries:\s*\d+$/m, "")
    .trim();

  if (!task) {
    throw new Error(
      "No task description found in the input. Provide the task after the metadata lines."
    );
  }

  return { agent, task, verifyCommand, maxRetries };
}

// ── Shell verification ─────────────────────────────────────────────────

interface VerifyResult {
  passed: boolean;
  exitCode: number;
  output: string;
}

function runShellVerification(command: string): VerifyResult {
  try {
    const output = execSync(command, {
      encoding: "utf-8",
      timeout: 60_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { passed: true, exitCode: 0, output: output || "(no output)" };
  } catch (err: any) {
    const exitCode = err.status ?? 1;
    const stdout = err.stdout ?? "";
    const stderr = err.stderr ?? "";
    const output = [stdout, stderr].filter(Boolean).join("\n").trim() || "(no output)";
    return { passed: false, exitCode, output };
  }
}

// ── Response analysis ──────────────────────────────────────────────────

/**
 * Analyze agent response for self-verification signals.
 * When no verifyCommand is provided, the agent is asked to prove its work.
 * We check its response for evidence of actual verification.
 */
function analyzeAgentVerification(text: string): { verified: boolean; reason: string } {
  const upper = text.toUpperCase();
  const lower = text.toLowerCase();

  // Strong failure signals
  if (
    upper.includes("VERIFICATION FAILED") ||
    upper.includes("VERIFY FAILED") ||
    upper.includes("TEST FAILED") ||
    upper.includes("TESTS FAILED") ||
    (upper.includes("ERROR") && upper.includes("FAIL"))
  ) {
    return { verified: false, reason: "Agent reported verification failure" };
  }

  // Strong success signals — agent ran something and it passed
  if (
    upper.includes("VERIFICATION PASSED") ||
    upper.includes("VERIFY PASSED") ||
    upper.includes("VERIFIED") ||
    (upper.includes("TESTS PASS") && !upper.includes("FAIL")) ||
    (upper.includes("EXIT CODE 0") || upper.includes("EXIT CODE: 0")) ||
    (lower.includes("confirmed") && (lower.includes("works") || lower.includes("correct")))
  ) {
    return { verified: true, reason: "Agent reported successful verification" };
  }

  // Agent claimed done without evidence of running anything
  if (
    upper.includes("DONE") || upper.includes("COMPLETE") || upper.includes("FINISHED")
  ) {
    // Check if they mention running a command
    if (
      lower.includes("ran ") || lower.includes("executed") ||
      lower.includes("output:") || lower.includes("```") ||
      lower.includes("exit code")
    ) {
      return { verified: true, reason: "Agent claims completion with evidence of execution" };
    }
    return { verified: false, reason: "Agent claimed done but showed no verification evidence" };
  }

  // Ambiguous — treat as unverified to be safe
  return { verified: false, reason: "No clear verification signal in agent response" };
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 0: Parse input
  let parsed: ParsedInput;
  try {
    parsed = parseInput(ctx.task);
  } catch (err: any) {
    return ctx.escalate("Failed to parse verify-and-finish input", { error: err.message });
  }

  const { agent, task, verifyCommand, maxRetries } = parsed;
  const totalAttempts = maxRetries + 1; // initial + retries

  ctx.emit({ type: "workflow_start", workflow: "verify-and-finish", task });

  let lastFailureOutput = "";

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    // ── Agent execution step ─────────────────────────────────────────
    ctx.emit({ type: "step_start", step: `agent-attempt-${attempt}` });

    let agentTask: string;
    if (attempt === 1) {
      // First attempt: give the task with verification instructions
      if (verifyCommand) {
        agentTask =
          `${task}\n\n` +
          `## Verification\n` +
          `After completing, this command will be run to verify:\n` +
          `\`\`\`\n${verifyCommand}\n\`\`\`\n` +
          `Make sure your work passes this check.`;
      } else {
        agentTask =
          `${task}\n\n` +
          `## Verification Required\n` +
          `After completing the task, you MUST verify your work by running a ` +
          `command that proves it's correct. Show the command and its output. ` +
          `Say "VERIFICATION PASSED" if it works, or "VERIFICATION FAILED" if not.`;
      }
    } else {
      // Retry attempt: include failure context
      agentTask =
        `## Fix Required (attempt ${attempt}/${totalAttempts})\n\n` +
        `Your previous work failed verification. Fix it.\n\n` +
        `### Original Task\n${task}\n\n` +
        (verifyCommand
          ? `### Verification Command\n\`\`\`\n${verifyCommand}\n\`\`\`\n\n`
          : ``) +
        `### Previous Failure\n\`\`\`\n${lastFailureOutput}\n\`\`\`\n\n` +
        `Read the error output carefully. Fix the root cause, then ` +
        (verifyCommand
          ? `ensure the verification command passes.`
          : `verify your fix works. Say "VERIFICATION PASSED" or "VERIFICATION FAILED".`);
    }

    const result = await ctx.runAgent(agent, agentTask);
    if (result.status === "error") {
      if (attempt < totalAttempts) {
        lastFailureOutput = `Agent error: ${result.error ?? "unknown error"}`;
        continue;
      }
      return ctx.escalate(
        `Agent "${agent}" failed on attempt ${attempt}/${totalAttempts}`,
        { attempt, error: result.error }
      );
    }

    const agentText = result.lastAssistantText ?? "";

    // ── Verification step ────────────────────────────────────────────
    ctx.emit({ type: "step_start", step: `verify-attempt-${attempt}` });

    let verified: boolean;
    let verifyOutput: string;

    if (verifyCommand) {
      // Shell verification: run the command ourselves
      const shellResult = runShellVerification(verifyCommand);
      verified = shellResult.passed;
      verifyOutput = shellResult.output;
    } else {
      // Agent self-verification: analyze the agent's response
      const analysis = analyzeAgentVerification(agentText);
      verified = analysis.verified;
      verifyOutput = `${analysis.reason}\n\nAgent output (excerpt):\n${agentText.slice(0, 2000)}`;
    }

    if (verified) {
      // Success — verification passed
      const summary = verifyCommand
        ? `## Verification PASSED (attempt ${attempt}/${totalAttempts})\n\n` +
          `### Task\n${task}\n\n` +
          `### Verification Command\n\`\`\`\n${verifyCommand}\n\`\`\`\n\n` +
          `### Verification Output\n\`\`\`\n${verifyOutput}\n\`\`\`\n\n` +
          `### Agent Summary\n${agentText}`
        : `## Verification PASSED (attempt ${attempt}/${totalAttempts})\n\n` +
          `### Task\n${task}\n\n` +
          `### Agent Summary (self-verified)\n${agentText}`;

      return ctx.done(summary);
    }

    // Failed — store output for next retry
    lastFailureOutput = verifyOutput;

    if (attempt < totalAttempts) {
      ctx.emit({ type: "step_start", step: `retry-setup-${attempt}` });
    }
  }

  // All attempts exhausted — escalate
  return ctx.escalate(
    `Verification failed after ${totalAttempts} attempts (${maxRetries} retries)`,
    {
      agent,
      task,
      verifyCommand: verifyCommand ?? "(self-verify)",
      lastFailureOutput,
    }
  );
}
