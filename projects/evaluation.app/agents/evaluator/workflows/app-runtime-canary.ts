import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk/app";

export const name = "evaluation-app-runtime-canary";
export const description =
  "Manually verify the capability-scoped workflow context against one App inbox result.";

type CanaryInput = {
  itemId: string;
};

function parseInput(input: unknown): CanaryInput | null {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const itemId = (input as Record<string, unknown>).itemId;
    return typeof itemId === "string" && itemId.trim()
      ? { itemId: itemId.trim() }
      : null;
  }
  if (typeof input !== "string") return null;
  try {
    return parseInput(JSON.parse(input));
  } catch {
    return null;
  }
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  const input = parseInput(ctx.input);
  if (!input) {
    return ctx.blocked('Expected input {"itemId":"app_..."}');
  }

  const appResult = await ctx.read.appResult(input.itemId);
  if (!appResult) {
    return ctx.blocked(
      `App inbox item ${input.itemId} has no completed result`,
    );
  }

  await ctx.events.emit({
    type: "evaluation.app_runtime_canary.observed",
    data: { itemId: input.itemId, summary: appResult.summary },
    target: { appId: "evaluation-canary" },
  });
  ctx.log.info(`Observed completed App inbox item ${input.itemId}`);
  const summary = "Capability-scoped App runtime canary passed";
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [`app-inbox:${input.itemId}`, ...(appResult.evidence ?? [])],
    actions: [],
    canary: { itemId: input.itemId, appResult },
  });
}
