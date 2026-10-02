import type { TaskReconcileResult } from "../src/task.js";

// Checked by SDK tsc and its declaration-export test; never executed.
declare function accepts(result: TaskReconcileResult): void;
const report = { summary: "Source unavailable", facts: ["source:offline"] satisfies [string, ...string[]] };
const incomplete = { decision: "incomplete" as const, ...report };
accepts({ decision: "converged", ...report });
accepts({ decision: "wait", ...report });
accepts({ decision: "incomplete", ...report });
accepts({ decision: "needs-agent", ...report });
accepts({ ...incomplete, result: { partial: "Retained observation" } });
accepts({ ...report, state: "waiting", dependencies: [] }); // Legacy producer compatibility.
accepts({ ...report, decision: "converged", response: "Observed", actions: [] });
accepts({ ...report, decision: "wait", report: true });
accepts({ ...incomplete, report: true });
accepts({ summary: "Waiting quietly", decision: "wait", facts: [] });
// @ts-expect-error Explicit waiting reports require non-empty facts too.
accepts({ summary: "Access missing", decision: "wait", report: true, facts: [] });
const unprovenWait = { summary: "Access missing", decision: "wait" as const, report: true as const, facts: [] as string[] };
// @ts-expect-error An arbitrary array does not prove a reported wait has facts.
accepts(unprovenWait);
// @ts-expect-error Only true opts into an explicit report; omission stays quiet.
accepts({ ...report, decision: "wait", report: false });

// @ts-expect-error A failure report must contain facts, just as admission requires.
accepts({ ...incomplete, facts: [] });
const emptyReport = { ...incomplete, facts: [] };
// @ts-expect-error An unproven array cannot satisfy the non-empty facts contract.
accepts(emptyReport);

// @ts-expect-error Failure reports cannot propose actions, even an empty list.
accepts({ ...incomplete, actions: [] });
// @ts-expect-error Failure reports cannot add waits.
accepts({ ...incomplete, conditions: [] });
// @ts-expect-error Failure reports cannot delegate work.
accepts({ ...incomplete, dependencies: [] });
const mixed = { ...incomplete, actions: [] };
// @ts-expect-error Structural assignment must reject mixed non-literal values too.
accepts(mixed);
// @ts-expect-error Handoff has no accepted domain result.
accepts({ ...report, decision: "needs-agent", result: {} });
// @ts-expect-error Waiting puts progress in summary, not a caller answer.
accepts({ ...report, decision: "wait", response: "Finished" });

const request = { id: "review", appId: "evaluation", input: { kind: "message", data: { text: "Review" } } };
accepts({ ...report, decision: "converged", requests: [request] });
accepts({ ...report, decision: "wait", requests: [request], conditions: [{ requestId: "review" }] });
// @ts-expect-error A caller cannot declare convergence and add a wait.
accepts({ ...report, decision: "converged", requests: [request], conditions: [{ requestId: "review" }] });
// @ts-expect-error Incomplete preserves existing work; new submissions need a waiting or converged decision.
accepts({ ...incomplete, requests: [request] });

accepts({ ...report, decision: "continue", requests: [request], conditions: [{ requestId: "review" }] });
// @ts-expect-error New output must not mix old and new decisions.
accepts({ ...report, decision: "wait", state: "waiting" });
// @ts-expect-error Continuation needs evidence of useful progress.
accepts({ summary: "More work", decision: "continue", facts: [] });
