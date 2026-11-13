/**
 * verified-coder workflow — Hard-Gated Coder (Wrapper Verification)
 *
 * Implements the "Ralph Loop" pattern from design-hard-gated-coder.md:
 * a coder agent is run in a loop, and the workflow itself executes
 * a verification command (e.g. `bun run test`, `tsc`, `node script.js`)
 * after each attempt. The workflow only succeeds when the verification
 * command returns exit code 0.
 *
 * Input: { task, verifyCommand, maxAttempts?, agent? }.
 * The shared invocation kernel validates inputSchema before execution.
 * Max attempts defaults to 3; the implementation agent defaults to tech-lead.
 */

import { execSync } from "node:child_process";
import { Type, type ExecutionResult, type Static, type WorkflowContext } from "@may-agent/sdk";

export const name: string = "verified-coder";

export const description: string =
  "Implementation + shell verification loop (up to maxAttempts, default 3). " +
  "Input: { task, verifyCommand, maxAttempts?, agent? }.";

export const inputSchema = Type.Object(
  {
    task: Type.String({ minLength: 1, pattern: "\\S" }),
    verifyCommand: Type.String({ minLength: 1, pattern: "\\S" }),
    maxAttempts: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
    agent: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const outputSchema = Type.Object(
  {
    attemptsUsed: Type.Integer({ minimum: 1 }),
    verifyCommand: Type.String({ minLength: 1 }),
    verifyOutput: Type.String(),
    coderSummary: Type.String(),
  },
  { additionalProperties: false },
);

type VerifiedCoderInput = Static<typeof inputSchema>;

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

export function emitStep(ctx: WorkflowContext, step: string): void {
  // Attempt-local progress belongs in structured workflow logs; the shared
  // runner records step traces automatically across Unit, Gym, and Host.
  ctx.log.info(`verified-coder step: ${step}`);
}

export async function execute(
  ctx: WorkflowContext<VerifiedCoderInput>,
): Promise<ExecutionResult> {
  ctx.signal.throwIfAborted();
  const task = ctx.input.task.trim();
  const verifyCommand = ctx.input.verifyCommand.trim();
  const maxAttempts = ctx.input.maxAttempts ?? 3;
  const agent = ctx.input.agent?.trim() || "tech-lead";

  const workspaceRoot = ctx.workspace?.root;
  if (!workspaceRoot) {
    return ctx.blocked("verified-coder requires a bounded workflow workspace");
  }

  emitStep(ctx, "init");

  let lastVerifyOutput = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    ctx.signal.throwIfAborted();
    // ── Coder step ───────────────────────────────────────────────────
    emitStep(ctx, `coder-attempt-${attempt}`);

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

    const coder = await ctx.agents.call(agent, coderTask);
    if (coder.status !== "done") {
      return ctx.blocked(
        `Coder did not complete attempt ${attempt}/${maxAttempts}`,
        {
          attempt,
          status: coder.status,
          error: coder.summary,
          facts: coder.facts,
        },
      );
    }

    // ── Verify step ──────────────────────────────────────────────────
    emitStep(ctx, `verify-attempt-${attempt}`);

    const verify = runVerification(verifyCommand, workspaceRoot);

    if (verify.passed) {
      const coderSummary = coder.summary || "(no output)";
      return ctx.done(
        `## Verification PASSED (attempt ${attempt}/${maxAttempts})\n\n` +
          `### Verification Command\n\`\`\`\n${verifyCommand}\n\`\`\`\n\n` +
          `### Verification Output\n\`\`\`\n${verify.output}\n\`\`\`\n\n` +
          `### Coder Summary\n${coderSummary}`,
        {
          attemptsUsed: attempt,
          verifyCommand,
          verifyOutput: verify.output,
          coderSummary,
        },
      );
    }

    // Failed — record output for next iteration
    lastVerifyOutput = verify.output;

    if (attempt < maxAttempts) {
      emitStep(ctx, `retry-${attempt}`);
    }
  }

  // All attempts exhausted
  return ctx.blocked(`Verification failed after ${maxAttempts} attempts`, {
    verifyCommand,
    lastExitCode: 1,
    lastOutput: lastVerifyOutput,
  });
}
