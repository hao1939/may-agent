import type { TaskReconcileResult } from "../src/task.js";

// Checked by SDK tsc and its declaration-export test; never executed.
declare function accepts(result: TaskReconcileResult): void;
const report = { summary: "Source unavailable", evidence: ["source:offline"] };
const stopped = { state: "stopped" as const, ...report };
for (const state of ["converged", "waiting", "stopped", "needs-agent"] as const) {
  accepts({ state, ...report });
}
accepts({ ...stopped, result: { partial: "Retained observation" } });
accepts({ ...report, state: "waiting", dependencies: [] });
accepts({ ...report, state: "converged", response: "Observed", actions: [] });

// @ts-expect-error Failure reports cannot propose actions, even an empty list.
accepts({ ...stopped, actions: [] });
// @ts-expect-error Failure reports cannot add waits.
accepts({ ...stopped, conditions: [] });
// @ts-expect-error Failure reports cannot delegate work.
accepts({ ...stopped, dependencies: [] });
const mixed = { ...stopped, actions: [] };
// @ts-expect-error Structural assignment must reject mixed non-literal values too.
accepts(mixed);
// @ts-expect-error Handoff has no accepted domain result.
accepts({ ...report, state: "needs-agent", result: {} });
// @ts-expect-error Waiting puts progress in summary, not a caller answer.
accepts({ ...report, state: "waiting", response: "Finished" });
