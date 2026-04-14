/// <reference path="../../../src/lib/workflow-defs.d.ts" />
/**
 * pivot-detector guard — detects unbounded create-test-fail-pivot loops.
 *
 * Problem: Both bob (187+93=280 ops) and coach (118 ops, 3.4× budget) hit
 * unbounded loops where they create something, test it, it fails, pivot to
 * a new approach, and repeat indefinitely.
 *
 * Solution: Track consecutive step failures (steps where the result contains
 * failure/error indicators without success markers). After 3 consecutive
 * fail-pivot cycles, inject a "reassess" warning. After 5, inject a
 * mandatory reassessment step.
 *
 * Events: step_done (tracks completion patterns)
 */

/** Detect if a step result indicates failure/pivot pattern. */
function isFailurePivot(result: { lastAssistantText?: string; finishResult?: { status?: string } }): boolean {
  const text = result.lastAssistantText ?? "";
  const lower = text.toLowerCase();

  // Explicit failure from finish()
  if (result.finishResult?.status === "failure" || result.finishResult?.status === "blocked") {
    return true;
  }

  // Failure indicators in text
  const failurePatterns = [
    /\bfail(ed|ure)?\b/i,
    /\bdoesn't work\b/i,
    /\bdidn't work\b/i,
    /\bnot working\b/i,
    /\btry a different approach\b/i,
    /\blet me try another\b/i,
    /\bpivot\b/i,
    /\bscrap\b/i,
    /\bstart over\b/i,
    /\bretry\b/i,
    /\ball .* hit (100%|ceiling)\b/i,
    /\btoo (easy|hard)\b/i,
    /\bback to the drawing board\b/i,
  ];

  const successPatterns = [
    /\b(pass|passed|passing|success|succeeded|complete|done|works|working)\b/i,
    /all\s+\d+\s+tests?\s+pass/i,
    /✅/,
  ];

  const hasFailure = failurePatterns.some(p => p.test(text));
  const hasSuccess = successPatterns.some(p => p.test(lower));

  // Failure without any success markers
  return hasFailure && !hasSuccess;
}

// Track consecutive failures per workflow run (in-memory, resets each workflow)
const consecutiveFailures = new Map<string, number>();

export const guard: WorkflowGuard = {
  name: "pivot-detector",
  events: ["step_done", "workflow_start"],

  handle(event: WorkflowGuardEvent): Demand[] {
    // Reset counter on workflow start
    if (event.type === "workflow_start") {
      consecutiveFailures.delete(event.runId);
      return [];
    }

    if (event.type !== "step_done") return [];

    // Skip guard-injected steps (don't count reassessment steps as failures)
    if (event.step.startsWith("guard:")) return [];

    const runId = event.runId;

    if (isFailurePivot(event.result)) {
      const count = (consecutiveFailures.get(runId) ?? 0) + 1;
      consecutiveFailures.set(runId, count);

      if (count >= 5) {
        // Hard intervention: inject a mandatory reassessment step
        consecutiveFailures.set(runId, 0); // Reset after intervention
        return [
          {
            type: "run_step",
            reason: `${count} consecutive fail-pivot cycles detected. Injecting mandatory reassessment.`,
            step: {
              agent: event.agentName ?? "coder",
              task: [
                "MANDATORY REASSESSMENT — Pivot loop detected.",
                "",
                `This workflow has hit ${count} consecutive create-test-fail-pivot cycles.`,
                "Before continuing, you MUST:",
                "1. List all approaches tried so far and why each failed",
                "2. Identify the common root cause across failures",
                "3. Propose a fundamentally different strategy (not a variation of what was tried)",
                "4. If no viable strategy exists, recommend STOPPING and escalating",
                "",
                "Write your analysis to a file, then propose the next step OR recommend stopping.",
              ].join("\n"),
              label: "guard:pivot-reassess",
            },
          },
        ];
      }

      if (count >= 3) {
        // Soft intervention: warn
        return [
          {
            type: "warn",
            reason: `${count} consecutive fail-pivot cycles detected. Consider stepping back to reassess the approach before trying again.`,
            guardName: "pivot-detector",
          },
        ];
      }
    } else {
      // Success resets the counter
      consecutiveFailures.set(runId, 0);
    }

    return [];
  },
};
