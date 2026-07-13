import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type MetricDef = {
  id: string;
  name: string;
  type: "gauge" | "health";
  target: number;
  threshold: number;
  unit: string;
  alertOp: "<" | ">";
  priority: "P0" | "P1" | "P2" | "P3";
  description: string;
  config?: Record<string, unknown>;
};

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = resolve(appDir, "..", "..");
const dbPath = resolve(process.env.MAY_DB_PATH ?? `${rootDir}/.state/may.db`);
const sampleCommand = (id: string) => {
  const jsonMetrics = new Set([
    "aks-rp-e2e.process.unowned-work-count",
    "aks-rp-e2e.process.loop.unrepresented-record-count",
    "aks-rp-e2e.process.task.review-not-applied-count",
    "aks-rp-e2e.task.blocked-actionable-count",
    "aks-rp-e2e.process.blocked.missing-waiting-for-count",
    "aks-rp-e2e.process.blocked.missing-observer-count",
    "aks-rp-e2e.process.blocked.missing-resume-condition",
    "aks-rp-e2e.process.blocked.missing-owner-count",
    "aks-rp-e2e.process.blocked.missing-fallback-count",
    "aks-rp-e2e.process.blocked.overdue-unworked-count",
    "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count",
  ]);
  return jsonMetrics.has(id)
    ? `bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts ${id} --json`
    : `bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts ${id}`;
};

const metrics: MetricDef[] = [
  {
    id: "aks-rp-e2e.task.ready-count",
    name: "AKS RP E2E runnable backlog count",
    type: "gauge",
    target: 5,
    threshold: -1,
    unit: "count",
    alertOp: "<",
    priority: "P3",
    description:
      "Compatibility metric id. Counts planner-assignable backlog leaves; ready is not a persisted task state.",
  },
  {
    id: "aks-rp-e2e.task.active-count",
    name: "AKS RP E2E active task count",
    type: "gauge",
    target: 5,
    threshold: -1,
    unit: "count",
    alertOp: "<",
    priority: "P3",
    description: "Dashboard counter for currently assigned task-tree leaves.",
  },
  {
    id: "aks-rp-e2e.task.stale-active-count",
    name: "AKS RP E2E stale active task count",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Dashboard counter for active task-tree leaves whose attached worker session is missing, not running, errored/interrupted, or still at zero operations after the stale threshold.",
  },
  {
    id: "aks-rp-e2e.task.blocked-count",
    name: "AKS RP E2E blocked task count",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Dashboard-only blocked-leaf inventory signal: counts every blocked leaf, including durable exact family holders and future-window blocked waits that intentionally preserve a represented frontier before their review/fallback window opens. Keep this visible as raw inventory, but route interrupting actionability from aks-rp-e2e.task.blocked-actionable-count and blocked-overdue family metrics instead of paging repeatedly on scheduled represented waits.",
  },
  {
    id: "aks-rp-e2e.task.blocked-actionable-count",
    name: "AKS RP E2E actionable blocked task count",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P2",
    description:
      "Blocked-frontier actionability signal: counts blocked wait families that the planning packet still flags as actionable warnings or repeated blocker groups, excluding durable exact represented holders. This should wake app-ops only when blocked volume corresponds to repairable process work rather than the stable represented frontier.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.task.completed-24h",
    name: "AKS RP E2E done tasks in 24h",
    type: "gauge",
    target: 8,
    threshold: 1,
    unit: "count",
    alertOp: "<",
    priority: "P2",
    description:
      "Activity signal: the task tree should complete material work daily while active.",
  },
  {
    id: "aks-rp-e2e.task.no-work-with-gaps",
    name: "AKS RP E2E no executable work while verification gaps remain",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "boolean",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 unblock signal: no dependency-clear runnable backlog or active worker task while model path gaps or unverified specs remain. Review tasks do not suppress this alert; they are app-ops work, so the breach should wake app-ops to accept, reject, split, or create follow-up tasks.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.task.stale-active-with-gaps",
    name: "AKS RP E2E stale active task while verification gaps remain",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "boolean",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 stuck signal: the task tree says work is active, but at least one active leaf has no healthy worker session while model path gaps or unverified specs remain. This catches restart/recovery holes where active task-tree state masks an idle project.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.unowned-work-count",
    name: "AKS RP E2E unfinished work without active owner",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: unfinished work exists but is not actively owned by a healthy worker, recovery task, exact wait, or accepted terminal disposition. This intentionally covers task-tree leaves, loop-ledger records, and running workflow rows that lost their runtime session, because dead work can be hidden outside the task tree.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.assignment-state-mismatch-count",
    name: "AKS RP E2E assignment state mismatch count",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: a project.task assignment pair is still open or orphaned, but the task is no longer active or no longer exists. This means task state moved without the closing completion/recovery event and needs planner or runtime repair.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.assignment.not-consumed-count",
    name: "AKS RP E2E queued assignments not consumed",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: project.task assignment rows are still queued after the worker-start grace window. The planner should re-emit task dispatch, clear a stale row, or repair worker dispatch so active work is actually consumed.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.task.review-not-applied-count",
    name: "AKS RP E2E task reviews not applied",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: task-reviewer emitted a decision for the current attempt, but the task is still in review after the planner-application grace window. The planner should apply the decision, stale-noop it with proof, or create owned repair work.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.unpublished-change-count",
    name: "AKS RP E2E project repo changes not visible to pipeline",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: the aks-rp-e2e project repo has dirty files or local commits that have not been pushed, so pipeline runs may be using stale test code, specs, plans, or artifacts. The local aks-rp-e2e.app repo is not counted here because app UI/task-state changes take effect locally.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.loop.unrepresented-record-count",
    name: "AKS RP E2E loop records without live representation",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: a durable loop reports non-terminal ledger records that are not represented by child work, an exact blocked wait, an escalation, or an accepted terminal disposition. The loop controller and planner must make those records visible before the project can be considered closed.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.integrity.task-tree-problem-count",
    name: "AKS RP E2E task tree integrity problems",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: the task tree has structural integrity problems such as a root count other than one. This can hide work outside the intended project tree, so planner repair or intentional archive/disposition is required.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.blocked.missing-waiting-for-count",
    name: "AKS RP E2E blocked tasks missing wait target",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: a blocked leaf does not name the exact condition it is waiting for. Blocked is not parked work; add waiting_for or convert the task back into actionable work.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.blocked.missing-observer-count",
    name: "AKS RP E2E blocked tasks missing observer",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: a blocked leaf does not say who checks the wait, how they check it, or when the next check happens. Add observed_by, observation_method, and next_check_at or reopen the work.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.blocked.missing-owner-count",
    name: "AKS RP E2E blocked tasks missing owner",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: a blocked leaf does not name the owner responsible for the wait. Add owner or convert the task back into actionable work.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.blocked.missing-fallback-count",
    name: "AKS RP E2E blocked tasks missing fallback",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: a blocked leaf does not say when waiting stops being acceptable and what fallback action should happen. Add fallback_at and fallback_action or reopen the work.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.blocked.overdue-unworked-count",
    name: "AKS RP E2E overdue blocked waits without active work",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 process signal: a blocked leaf passed its resume/fallback time, but no active or review task references that blocked wait. The owner label is not enough; create recovery/handoff/escalation work or refresh the exact wait.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count",
    name: "AKS RP E2E overdue blocked owner waits without active work",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P0",
    description:
      "Compatibility alias for overdue blocked waits without active work. This includes human-owned waits unless a concrete active/review handoff or escalation references the blocked wait. Measurement stays live, but alert lifecycle is suppressed so the canonical metric owns paging.",
    config: {
      alert: {
        mode: "disabled",
        disabled: true,
      },
    },
  },
  {
    id: "aks-rp-e2e.task.ready-starvation-with-gaps",
    name: "AKS RP E2E runnable backlog starvation while verification gaps remain",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "boolean",
    alertOp: ">",
    priority: "P3",
    description:
      "Compatibility metric id. Planner refill signal: no runnable backlog leaves exist while model path gaps or unverified specs remain and there is no active/review work already in flight. P3 keeps this dashboard-only unless it persists with no active/review work.",
    config: { alert: { mode: "consecutive_failures", count: 12 } },
  },
  {
    id: "aks-rp-e2e.task.capacity-underfilled-with-gaps",
    name: "AKS RP E2E worker capacity underfilled while verification gaps remain",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "boolean",
    alertOp: ">",
    priority: "P2",
    description:
      "Planner refill signal: runnable backlog plus active leaves are below desired parallelism while model path gaps or unverified specs remain. Only sustained inability to refill for 2h is a real signal.",
    config: { alert: { mode: "consecutive_failures", count: 24 } },
  },
  {
    id: "aks-rp-e2e.model.unknown-path-count",
    name: "AKS RP E2E unknown/source-enumerated paths",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Impact counter: paths still needing verification or runnable follow-up.",
  },
  {
    id: "aks-rp-e2e.model.failed-path-count",
    name: "AKS RP E2E failed paths",
    type: "gauge",
    target: 0,
    threshold: 25,
    unit: "count",
    alertOp: ">",
    priority: "P2",
    description:
      "Impact signal: many failed paths without diagnosis should wake app-ops review to create domain fix-forward work. Threshold 20->25: 22 discovered product-gaps (12 KMS firewalled-KV, plus deployment-safeguards, planned-maintenance, managedsystem, etc.) form a structural floor from active exploration; only external product fixes reduce this count. Calibrated 2026-06-12.",
  },
  {
    id: "aks-rp-e2e.model.blocked-path-count",
    name: "AKS RP E2E blocked paths",
    type: "gauge",
    target: 0,
    threshold: 9,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Impact signal: repo-local path.status=blocked entries should become unblock or human-decision tasks. The count intentionally excludes blocked-infra, accepted terminal/awaiting-external blocked paths, and blocked paths that already carry an exact resumeCondition/retestCondition because those are already represented by exact waits or durable exceptions. Threshold 45→9 after 2026-07-08 triage aligned the metric to the remaining blocked paths that still lack a terminal or exact-wait disposition.",
  },
  {
    id: "aks-rp-e2e.feature.unknown-count",
    name: "AKS RP E2E unknown features",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description: "Dashboard counter for feature coverage remaining.",
  },
  {
    id: "aks-rp-e2e.spec.total-count",
    name: "AKS RP E2E indexed test spec count",
    type: "gauge",
    target: 335,
    threshold: -1,
    unit: "count",
    alertOp: "<",
    priority: "P3",
    description:
      "Dashboard counter for specs/index.json entries, the canonical verification catalog.",
  },
  {
    id: "aks-rp-e2e.spec.verified-count",
    name: "AKS RP E2E verified passing specs",
    type: "gauge",
    target: 335,
    threshold: -1,
    unit: "count",
    alertOp: "<",
    priority: "P3",
    description:
      "Specs with status=pass and specState in verified/validated/resolved/pass. Legacy pass without explicit specState is not counted as verified.",
  },
  {
    id: "aks-rp-e2e.spec.reviewed-exception-count",
    name: "AKS RP E2E reviewed spec exceptions",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Specs with durable non-pass exception status such as product-gap, product-constraint, environment-blocked, blocked-infra, superseded, or out-of-scope.",
  },
  {
    id: "aks-rp-e2e.spec.unverified-count",
    name: "AKS RP E2E unverified specs",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Dashboard burn-down counter: indexed specs not live-verified passing and not a reviewed durable exception. Not an interrupting alert — the real health signals are spec.unverified-without-work (P0, fires when no verification work is planned) and task.no-work-with-gaps (P0, fires when no work at all while gaps remain). Calibrated threshold 0→999999 and priority P1→P3 on 2026-06-14: threshold=0 on a 335-spec burn-down creates a permanent P1 alert that interrupts without adding value.",
  },
  {
    id: "aks-rp-e2e.spec.failed-count",
    name: "AKS RP E2E failed specs",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P1",
    description:
      "Specs with fail/failing status. Each should have diagnosis, fix/retry, or reviewed exception follow-up.",
  },
  {
    id: "aks-rp-e2e.spec.blocked-count",
    name: "AKS RP E2E blocked specs",
    type: "gauge",
    target: 0,
    threshold: 10,
    unit: "count",
    alertOp: ">",
    priority: "P2",
    description:
      "Specs with blocked status. High count means unblock, prerequisite, or exception review work is needed.",
  },
  {
    id: "aks-rp-e2e.spec.ready-count",
    name: "AKS RP E2E ready specs",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Dashboard burn-down counter: specs marked ready but not yet live-verified. These should be grouped into execution waves or run individually. Not an interrupting alert — the real health signals are spec.unverified-without-work (P0, fires when no verification work is planned) and task.no-work-with-gaps (P0, fires when no work at all while gaps remain). Calibrated threshold 20→999999 and priority P2→P3 on 2026-06-14: batch draft→ready promotion (268 specs) is normal pipeline progress, not a failure; threshold=20 creates a permanent P2 alert that interrupts without adding value.",
  },
  {
    id: "aks-rp-e2e.spec.draft-count",
    name: "AKS RP E2E draft specs",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Dashboard burn-down counter: specs that still need replay/readiness work before live verification. Not an interrupting alert — the real health signals are spec.unverified-without-work (P0, fires when no verification work is planned) and task.no-work-with-gaps (P0, fires when no work at all while gaps remain). Calibrated threshold 200→999999 and priority P2→P3 on 2026-06-14: threshold=200 on a 335-spec burn-down creates a permanent P2 alert that interrupts without adding value; trend is positive (265→256).",
  },
  {
    id: "aks-rp-e2e.spec.retry-exhausted-count",
    name: "AKS RP E2E retry-drained specs",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Dashboard counter: specs that exhausted direct retry and now require grouped recovery, exact wait, escalation, or a fresh meaningful fix before another run.",
  },
  {
    id: "aks-rp-e2e.spec.recovery-unowned-count",
    name: "AKS RP E2E retry-drained specs without recovery owner",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Debug component for process.unowned-work-count: retry-drained spec-loop records that are not represented by an open recovery, exact wait, or escalation task.",
  },
  {
    id: "aks-rp-e2e.spec.unverified-without-work",
    name: "AKS RP E2E unverified specs without verification work",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "boolean",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 planning signal: unverified specs exist but no verification branch/task work is open in the task tree.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.replay.script-count",
    name: "AKS RP E2E replay script count",
    type: "gauge",
    target: 125,
    threshold: -1,
    unit: "count",
    alertOp: "<",
    priority: "P3",
    description: "Dashboard counter for generated replay scripts.",
  },
  {
    id: "aks-rp-e2e.run.live-started-24h",
    name: "AKS RP E2E live runs started in 24h",
    type: "gauge",
    target: 0,
    threshold: -1,
    unit: "count",
    alertOp: "<",
    priority: "P3",
    description:
      "Dashboard activity counter for execute-mode live runs in the last 24h. Not an interrupting alert: this project's automation policy keeps cloud verification event-driven and sparing, so raw daily live-run count should not page app-ops during repo-local learning or externally gated periods. Use aks-rp-e2e.run.live-idle-with-runnable-work for the real liveness signal when execute-ready backlog exists but no run starts. Calibrated target 4->0, threshold 1->-1, priority P1->P3 on 2026-06-19 after repo-local evidence confirmed the old daily-pressure shape produced false alerts during ordinary gate-closed periods.",
  },
  {
    id: "aks-rp-e2e.run.live-succeeded-24h",
    name: "AKS RP E2E live runs succeeded in 24h",
    type: "gauge",
    target: 2,
    threshold: 0,
    unit: "count",
    alertOp: "<",
    priority: "P2",
    description:
      "Impact signal: live verification should produce passing evidence.",
  },
  {
    id: "aks-rp-e2e.run.live-failed-24h",
    name: "AKS RP E2E live runs failed/blocked in 24h",
    type: "gauge",
    target: 0,
    threshold: 55,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Health signal: too many failed/blocked live runs means runner/spec/infra diagnosis is needed. Structural floor ~21 (blocked-by-runner + infra_failed). Absolute threshold is inherently noisy: reruns inflate count (remediation worsens metric), run volume varies (58→68+/day), and the raw counter intentionally includes blocked-before-verdict launches such as source/check-only carriers plus env/spec-preflight reruns. Treat it as a family-level execution-health signal, not a distinct work-item queue; use family triage to separate genuine live contradictions from retry/noise families. If a cleaner actionable queue is needed later, add a sibling deduped/actionable-family metric instead of weakening this raw signal. P3 makes this a dashboard signal, not an interrupting alert. Review: promote back to P2 if pass rate drops below 15% consistently. Calibrated 20→25→28→35→42→50→55, priority P2→P3 (breaking threshold-chase cycle).",
  },
  {
    id: "aks-rp-e2e.run.live-idle-with-runnable-work",
    name: "AKS RP E2E live execution idle with runnable work",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "boolean",
    alertOp: ">",
    priority: "P1",
    description:
      "Runner liveness signal: replay scripts and model gaps exist, but no live runs started in 24h.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.planner.timeout-24h",
    name: "AKS RP E2E planner app-ops session timeouts in 24h",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P1",
    description:
      "App-ops-visible planner health signal: counts planner_wake records from .state/planner-runs.jsonl in the last 24h whose app-ops session result timed out. Any nonzero count should wake app-ops to inspect planner recovery and backlog refill behavior.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.planner.slow-count-24h",
    name: "AKS RP E2E slow planner wakes in 24h",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P2",
    description:
      "App-ops-visible planner slowness signal: counts planner_wake records in the last 24h that either took at least 180s wall time or ended interrupted/cancelled. This catches slow app-ops/planner loops before they become silent refill gaps.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "aks-rp-e2e.artifact.duplicate-group-count",
    name: "AKS RP E2E duplicate artifact groups",
    type: "gauge",
    target: 0,
    threshold: 700,
    unit: "count",
    alertOp: ">",
    priority: "P2",
    description:
      "Loop hygiene signal: repeated same-purpose artifacts can indicate agents are cycling, but the old 500 threshold was calibrated against a smaller archive. On 2026-06-25 the current normalization produced 665 duplicate groups over the >3-file cutoff across 17,363 archive families and 29,991 counted archive files, with 638 groups above 5 files, 604 above 8 files, 584 above 10 files, 542 above 12 files, and 481 above 15 files. Recent accepted evidence growth has therefore moved the project's structural floor to roughly 665; threshold 700 keeps this as an interrupting signal only for material growth beyond the current steady-state instead of paging on every normal evidence wave. Filename normalization remains the 2026-06-21 in-place token removal that preserves semantic suffixes.",
  },
];

if (!existsSync(dbPath)) {
  throw new Error(`may.db not found: ${dbPath}`);
}

const db = new Database(dbPath);
const now = Date.now();
const upsert = db.prepare(`
  INSERT INTO metrics (
    id, name, type, owner, target, threshold, unit, priority, status, project,
    source, source_command, created_at, updated_at, alert_op, speed,
    description, config
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 'source_command', ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    type = excluded.type,
    owner = excluded.owner,
    target = excluded.target,
    threshold = excluded.threshold,
    unit = excluded.unit,
    priority = excluded.priority,
    status = 'active',
    project = excluded.project,
    source = excluded.source,
    source_command = excluded.source_command,
    updated_at = excluded.updated_at,
    alert_op = excluded.alert_op,
    speed = excluded.speed,
    description = excluded.description,
    config = excluded.config
`);

for (const metric of metrics) {
  upsert.run(
    metric.id,
    metric.name,
    metric.type,
    "app-ops",
    metric.target,
    metric.threshold,
    metric.unit,
    metric.priority,
    "aks-rp-e2e",
    sampleCommand(metric.id),
    now,
    now,
    metric.alertOp,
    "fast",
    metric.description,
    metric.config ? JSON.stringify(metric.config) : null,
  );
}

console.log(`registered ${metrics.length} aks-rp-e2e metrics in ${dbPath}`);
