import type { AppTaskInput } from "@may-agent/sdk/app";

export const WORKLOAD_REVIEW_TASK_ID = "runtime/workload-review";
export const WORKLOAD_REVIEW_WORKFLOW = "workload-review";
export const WORKLOAD_REVIEW_INTERVAL_MS = 15 * 60_000;

/** Installation opt-in, never selected by a Task input or workload score. */
export function workloadReviewPolicy(env: NodeJS.ProcessEnv = process.env) {
  const enabled = env.ALEX_WORKLOAD_REVIEW_ENABLED === "true";
  return {
    enabled,
    notifyOwners: enabled && env.ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS === "true",
    coordination: { taskId: WORKLOAD_REVIEW_TASK_ID, workflow: WORKLOAD_REVIEW_WORKFLOW, maxAttemptMs: 90_000 },
    schedule: { id: "workload-review", intervalMs: WORKLOAD_REVIEW_INTERVAL_MS,
      catchUp: "latest" as const, input: { kind: "workload-review", data: { reason: "scheduled" } } },
  };
}

export function workloadReviewTask(admitted: AppTaskInput, enabled: boolean) {
  if (!enabled) throw new Error("Workload review requires the installed Alex pilot opt-in");
  return { kind: "desired" as const, intent: {
    id: WORKLOAD_REVIEW_TASK_ID, parentId: "root", agent: "alex", workflow: WORKLOAD_REVIEW_WORKFLOW,
    outcome: "Review changed commitments and supported opportunities within current workload and authority.",
    acceptance: [
      "Preserve business obligations under every load; recommend methods and priorities without count-based closure.",
      "Use bounded scoped evidence, skip unchanged or empty reviews, and distinguish recommendations from applied decisions.",
    ],
    // Persist only the App's raw workload-review domain input. The Host Task
    // execution adapter constructs the single canonical { prompt, data }
    // callable envelope when it invokes the workflow.
    input: admitted.input.data,
    priority: "P2" as const,
  } };
}
