/**
 * verified-coder workflow — Hard-Gated Coder (Wrapper Verification)
 *
 * Implements the "Ralph Loop" pattern from design-hard-gated-coder.md:
 * a coder agent is run in a loop, and the workflow itself executes
 * a verification executable with arguments (e.g. ["node", "script.js"])
 * after each attempt. The workflow only succeeds when the verification
 * command returns exit code 0.
 *
 * Input: { task, verify: [executable, ...arguments], maxAttempts?, agent? }.
 * The shared invocation kernel validates inputSchema before execution.
 * Max attempts defaults to 3; the implementation agent defaults to tech-lead.
 */

import { Type, type ExecutionResult, type Static, type WorkflowContext } from "@may-agent/sdk";
import { commandReceipt } from "../../../command.js";

export const name: string = "verified-coder";

export const description: string =
  "Implementation + command verification loop (up to maxAttempts, default 3). " +
  "Input: { task, verify: [executable, ...arguments], maxAttempts?, agent? }.";

export const inputSchema = Type.Object(
  {
    task: Type.String({ minLength: 1, pattern: "\\S" }),
    verify: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: 32 }),
    maxAttempts: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
    agent: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const outputSchema = Type.Object(
  {
    attemptsUsed: Type.Integer({ minimum: 1 }),
    verify: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: 32 }),
    verifyOutput: Type.String(),
    coderSummary: Type.String(),
  },
  { additionalProperties: false },
);

type VerifiedCoderInput = Static<typeof inputSchema>;

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
  const verify = ctx.input.verify;
  const verifyDescription = JSON.stringify(verify);
  const maxAttempts = ctx.input.maxAttempts ?? 3;
  const agent = ctx.input.agent?.trim() || "tech-lead";

  const workspaceRoot = ctx.workspace?.root;
  if (!workspaceRoot) {
    return ctx.blocked("verified-coder requires a bounded workflow workspace");
  }

  emitStep(ctx, "init");

  let lastVerifyOutput = "";
  let lastExitCode: number | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    ctx.signal.throwIfAborted();
    // ── Coder step ───────────────────────────────────────────────────
    emitStep(ctx, `coder-attempt-${attempt}`);

    let coderTask: string;
    if (attempt === 1) {
      coderTask =
        `${task}\n\n` +
        `## Verification\n` +
        `When done, this executable and its arguments will verify your work:\n` +
        `\`\`\`json\n${verifyDescription}\n\`\`\`\n` +
        `It must exit with code 0. Make sure your code passes this check.`;
    } else {
      coderTask =
        `## Fix Required (attempt ${attempt}/${maxAttempts})\n\n` +
        `The verification command failed. Fix the code so it passes.\n\n` +
        `### Original Task\n${task}\n\n` +
        `### Verification Command (executable and arguments)\n\`\`\`json\n${verifyDescription}\n\`\`\`\n\n` +
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

    const coder = await ctx.call(agent, coderTask);
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

    const receipt = await commandReceipt(workspaceRoot, verify, ctx.signal);
    ctx.signal.throwIfAborted();
    const verifyOutput =
      [receipt.stdout, receipt.stderr].filter(Boolean).join("\n").trim() ||
      receipt.error || "(no output)";

    if (!receipt.error) {
      const coderSummary = coder.summary || "(no output)";
      return ctx.done(
        `## Verification PASSED (attempt ${attempt}/${maxAttempts})\n\n` +
          `### Verification Command (executable and arguments)\n\`\`\`json\n${verifyDescription}\n\`\`\`\n\n` +
          `### Verification Output\n\`\`\`\n${verifyOutput}\n\`\`\`\n\n` +
          `### Coder Summary\n${coderSummary}`,
        {
          attemptsUsed: attempt,
          verify,
          verifyOutput,
          coderSummary,
        },
      );
    }

    // Failed — record output for next iteration
    lastVerifyOutput = verifyOutput;
    lastExitCode = receipt.exitCode;

    if (attempt < maxAttempts) {
      emitStep(ctx, `retry-${attempt}`);
    }
  }

  // All attempts exhausted
  return ctx.blocked(`Verification failed after ${maxAttempts} attempts`, {
    verify,
    lastExitCode,
    lastOutput: lastVerifyOutput,
  });
}
