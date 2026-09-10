/**
 * verified-coder workflow — Hard-Gated Coder (Wrapper Verification)
 *
 * Implements the "Ralph Loop" pattern from design-hard-gated-coder.md:
 * a coder agent is run in a loop, and the workflow itself executes
 * a verification command (e.g. `bun run test`, `tsc`, `node script.js`)
 * after each attempt. The workflow only succeeds when the verification
 * command returns exit code 0.
 *
 * Input contracts (task string):
 *   1. Reconciliation input: a fenced JSON object under the exact
 *      `## Reconciliation Task` heading. Its `outcome` string MUST contain a
 *      physical `verifyCommand:` line after JSON decoding and MAY contain a
 *      `maxAttempts:` line. The coder receives only the sanitized reconciliation
 *      object; wrapper/trigger text outside that fence is never task metadata.
 *   2. Legacy raw input: a physical top-level `verifyCommand:` line and optional
 *      `maxAttempts:` line. Everything else is the coding task.
 *
 * Max attempts defaults to 3.
 */

import { execSync } from "node:child_process";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";

export const name: string = "verified-coder";

export const description: string =
  "Coder + verification loop. Runs the coder, then executes a shell " +
  "verification command. Loops until the command exits 0 or max attempts " +
  "(default 3) exhausted. Task must include 'verifyCommand: <cmd>'.";

// ── Input parsing ──────────────────────────────────────────────────────

export interface ParsedInput {
  task: string;
  verifyCommand: string;
  maxAttempts: number;
}

type VerifiedCoderInput =
  | string
  | {
      task: string;
      verifyCommand: string;
      maxAttempts?: number;
    };

interface ReconciliationEnvelope {
  outcome: string;
  [key: string]: unknown;
}

function parseTaskAndMetadata(taskWithMetadata: string): ParsedInput {
  const verifyMatch = taskWithMetadata.match(/^verifyCommand:\s*(.*)$/m);
  const verifyCommand = verifyMatch?.[1].trim() ?? "";
  if (!verifyCommand) {
    throw new Error(
      "Task must include a non-empty 'verifyCommand: <command>' line. " +
        "This is the shell command that must exit 0 for the task to pass.",
    );
  }

  const attemptsMatch = taskWithMetadata.match(/^maxAttempts:\s*([1-9]\d*)$/m);
  const maxAttempts = attemptsMatch ? parseInt(attemptsMatch[1], 10) : 3;
  const task = taskWithMetadata
    .replace(/^verifyCommand:\s*.*$/m, "")
    .replace(/^maxAttempts:\s*[1-9]\d*$/m, "")
    .trim();

  if (!task) {
    throw new Error(
      "No coding task found in the input (only found verification metadata).",
    );
  }

  return { task, verifyCommand, maxAttempts };
}

export function parseInput(raw: string): ParsedInput {
  const reconciliationHeading = /^## Reconciliation Task\s*$/m;
  if (!reconciliationHeading.test(raw)) {
    return parseTaskAndMetadata(raw);
  }

  const envelopeMatch = raw.match(
    /^## Reconciliation Task\s*\r?\n```json\s*\r?\n([\s\S]*?)\r?\n```\s*$/m,
  );
  if (!envelopeMatch) {
    throw new Error("Malformed structured '## Reconciliation Task' envelope.");
  }

  let envelope: ReconciliationEnvelope;
  try {
    envelope = JSON.parse(envelopeMatch[1]) as ReconciliationEnvelope;
  } catch {
    throw new Error("Reconciliation Task envelope must contain valid JSON.");
  }
  if (
    !envelope ||
    typeof envelope !== "object" ||
    typeof envelope.outcome !== "string"
  ) {
    throw new Error(
      "Reconciliation Task envelope must contain a string 'outcome'.",
    );
  }

  // JSON decoding turns escaped newlines in outcome into physical metadata lines.
  // Only that field is inspected, so trigger/wrapper text can never become a command.
  const parsedOutcome = parseTaskAndMetadata(envelope.outcome);
  const sanitizedEnvelope = { ...envelope, outcome: parsedOutcome.task };

  return {
    task:
      "## Reconciliation Task\n```json\n" +
      JSON.stringify(sanitizedEnvelope, null, 2) +
      "\n```",
    verifyCommand: parsedOutcome.verifyCommand,
    maxAttempts: parsedOutcome.maxAttempts,
  };
}

function parseWorkflowInput(input: unknown): ParsedInput {
  if (typeof input === "string") return parseInput(input);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(
      "verified-coder input must be a string or structured object",
    );
  }
  const record = input as Partial<Exclude<VerifiedCoderInput, string>>;
  const task = record.task?.trim() ?? "";
  const verifyCommand = record.verifyCommand?.trim() ?? "";
  const maxAttempts = record.maxAttempts ?? 3;
  if (!task) throw new Error("verified-coder input requires a non-empty task");
  if (!verifyCommand) {
    throw new Error("verified-coder input requires a non-empty verifyCommand");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("verified-coder maxAttempts must be a positive integer");
  }
  return { task, verifyCommand, maxAttempts };
}

// ── Verification runner ────────────────────────────────────────────────

interface VerifyResult {
  passed: boolean;
  exitCode: number;
  output: string;
}

function runVerification(command: string, cwd: string): VerifyResult {
  try {
    const output = execSync(command, {
      encoding: "utf-8",
      timeout: 60_000, // 60s timeout for verification
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
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

export async function emitStep(
  ctx: WorkflowContext,
  step: string,
): Promise<void> {
  if (ctx.reconciliation) {
    // Task-owned event publication is reserved for durable domain facts with a
    // stable semantic identity. These markers are attempt-local progress only;
    // the Host already records workflow and agent-step lifecycle events.
    ctx.log.info(`verified-coder step: ${step}`);
    return;
  }
  await ctx.events.emit({ type: "step_start", data: { step } });
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  // Step 0: Parse input
  let parsed: ParsedInput;
  try {
    parsed = parseWorkflowInput(ctx.input);
  } catch (err: any) {
    return ctx.blocked("Failed to parse verified-coder input", {
      error: err.message,
    });
  }

  const { task, verifyCommand, maxAttempts } = parsed;

  const workspaceRoot = ctx.workspace?.root;
  if (!workspaceRoot) {
    return ctx.blocked("verified-coder requires a bounded workflow workspace");
  }

  await emitStep(ctx, "init");

  let lastVerifyOutput = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // ── Coder step ───────────────────────────────────────────────────
    await emitStep(ctx, `coder-attempt-${attempt}`);

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

    coderTask +=
      `\n\n## Checkout\n` +
      `Edit and verify only in this allocated workspace: ${workspaceRoot}\n` +
      `Do not switch to the shared checkout or change another worker's branch. ` +
      `Report a blocker if the allocation or requested scope is unsuitable.\n` +
      `A passing check is verification evidence, not permission to merge or deploy.`;

    const coder = await ctx.agents.call("coder", coderTask);
    if (coder.status !== "done") {
      return ctx.blocked(
        `Coder did not complete attempt ${attempt}/${maxAttempts}`,
        {
          attempt,
          status: coder.status,
          error: coder.summary,
          evidence: coder.evidence,
        },
      );
    }

    // ── Verify step ──────────────────────────────────────────────────
    await emitStep(ctx, `verify-attempt-${attempt}`);

    const verify = runVerification(verifyCommand, workspaceRoot);

    if (verify.passed) {
      // Success!
      return ctx.done(
        `## Verification PASSED (attempt ${attempt}/${maxAttempts})\n\n` +
          `### Verification Command\n\`\`\`\n${verifyCommand}\n\`\`\`\n\n` +
          `### Verification Output\n\`\`\`\n${verify.output}\n\`\`\`\n\n` +
          `### Coder Summary\n${coder.summary || "(no output)"}`,
      );
    }

    // Failed — record output for next iteration
    lastVerifyOutput = verify.output;

    if (attempt < maxAttempts) {
      await emitStep(ctx, `retry-${attempt}`);
    }
  }

  // All attempts exhausted
  return ctx.blocked(`Verification failed after ${maxAttempts} attempts`, {
    verifyCommand,
    lastExitCode: 1,
    lastOutput: lastVerifyOutput,
  });
}
