import type { TaskReconcileResult } from "../src/task.js";

// Checked by SDK tsc and its declaration-export test; never executed.
declare function accepts(result: TaskReconcileResult): void;
const report = { summary: "Source unavailable", evidence: ["source:offline"] satisfies [string, ...string[]] };
const stopped = { state: "stopped" as const, ...report };
accepts({ state: "converged", ...report });
accepts({ state: "waiting", ...report });
accepts({ state: "stopped", ...report });
accepts({ state: "needs-agent", ...report });
accepts({ ...stopped, result: { partial: "Retained observation" } });
accepts({ ...report, state: "waiting", dependencies: [] });
accepts({ ...report, state: "converged", response: "Observed", actions: [] });
accepts({ ...report, state: "waiting", report: true });
accepts({ ...stopped, report: true });
accepts({ summary: "Waiting quietly", state: "waiting", evidence: [] });
// @ts-expect-error Explicit waiting reports require non-empty evidence too.
accepts({ summary: "Access missing", state: "waiting", report: true, evidence: [] });
const unprovenWait = { summary: "Access missing", state: "waiting" as const, report: true as const, evidence: [] as string[] };
// @ts-expect-error An arbitrary array does not prove a reported wait has evidence.
accepts(unprovenWait);
// @ts-expect-error Only true opts into an explicit report; omission stays quiet.
accepts({ ...report, state: "waiting", report: false });

// @ts-expect-error A failure report must contain evidence, just as admission requires.
accepts({ ...stopped, evidence: [] });
const emptyReport = { ...stopped, evidence: [] };
// @ts-expect-error An unproven array cannot satisfy the non-empty evidence contract.
accepts(emptyReport);

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
