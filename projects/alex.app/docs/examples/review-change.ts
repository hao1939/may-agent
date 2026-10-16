import { Type, type ExecutionResult, type WorkflowContext } from "@may-agent/sdk";

type Input = { subjectRef: string };
const ReviewSchema = Type.Object({
  subjectRef: Type.String({ minLength: 1 }),
  verdict: Type.Optional(Type.Union([Type.Literal("pass"), Type.Literal("changes-needed")])),
  summary: Type.String({ minLength: 1 }),
  references: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })),
});

export const name = "review-change";
export const description =
  "Review one exact source reference and return findings; does not implement or approve it.";

// Install a reviewer in the owning agent's permitted team before using this recipe.
export async function execute(ctx: WorkflowContext<Input>): Promise<ExecutionResult> {
  ctx.signal.throwIfAborted();
  if (!ctx.input || typeof ctx.input.subjectRef !== "string" || !ctx.input.subjectRef.trim()) {
    return ctx.blocked("An exact subject reference is required");
  }

  const review = await ctx.agents.call(
    "reviewer",
    [
      "Review this exact subject within the caller's assignment:",
      ctx.input.subjectRef,
      "Use shared Task context and relevant updates. Return the subject reference,",
      "a summary and available findings. Omit a verdict or evidence references",
      "you do not have; explain remaining work in the summary. Do not modify the subject.",
    ].join("\n"),
    { schema: ReviewSchema },
  );
  ctx.signal.throwIfAborted();

  if (!review.output || review.output.subjectRef !== ctx.input.subjectRef) {
    return ctx.blocked("The review did not identify the requested subject", { review });
  }

  // Returning a usable report does not establish a completed review. Preserve
  // available findings even when the helper reported partial work or a blocker.
  // The caller judges whether the evidence is sufficient and what remains.
  return ctx.done("Review report returned; caller assessment remains", {
    reviewExecutionId: review.id,
    review: review.output,
  });
}
