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
const sampleCommand = (id: string) =>
  `bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts ${id}`;

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
    threshold: 5,
    unit: "count",
    alertOp: ">",
    priority: "P1",
    description:
      "Too many blocked leaves means the project needs unblock or branch repair.",
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
      "P0 unblock signal: no dependency-clear runnable backlog or active worker task while model path gaps or unverified specs remain. Review tasks do not suppress this alert; they are owner work, so the breach should wake the owner to accept, reject, split, or create follow-up tasks.",
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
      "Impact signal: many failed paths without diagnosis should wake owner review. Threshold 20→25: 22 discovered product-gaps (12 KMS firewalled-KV, plus deployment-safeguards, planned-maintenance, managedsystem, etc.) form a structural floor from active exploration; only external product fixes reduce this count. Calibrated 2026-06-12.",
  },
  {
    id: "aks-rp-e2e.model.blocked-path-count",
    name: "AKS RP E2E blocked paths",
    type: "gauge",
    target: 0,
    threshold: 45,
    unit: "count",
    alertOp: ">",
    priority: "P3",
    description:
      "Impact signal: repo-local path.status=blocked entries should become unblock or human-decision tasks. This metric intentionally excludes path.status=blocked-infra because structural terminal infra gates are tracked separately and should not breach the blocked-path counter. Threshold 14→45, P2→P3 reflects normal transient staging-wave blocked volume; review when blocked path volume alone exceeds that lane. Measurement contract clarified 2026-06-28.",
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
      "Dashboard activity counter for execute-mode live runs in the last 24h. Not an interrupting alert: this project's automation policy keeps cloud verification event-driven and sparing, so raw daily live-run count should not page the owner during repo-local learning or externally gated periods. Use aks-rp-e2e.run.live-idle-with-runnable-work for the real liveness signal when execute-ready backlog exists but no run starts. Calibrated target 4→0, threshold 1→-1, priority P1→P3 on 2026-06-19 after repo-local evidence confirmed the old daily-pressure shape conflicted with replays/execution/automation.md and produced false alerts during ordinary gate-closed periods.",
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
    name: "AKS RP E2E planner owner-session timeouts in 24h",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">",
    priority: "P1",
    description:
      "Owner-visible planner health signal: counts planner_wake records from .state/planner-runs.jsonl in the last 24h whose owner session result timed out. Any nonzero count should wake the owner to inspect planner recovery and backlog refill behavior.",
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
      "Owner-visible planner slowness signal: counts planner_wake records in the last 24h that either took at least 180s wall time or ended interrupted/cancelled. This catches slow owner/planner loops before they become silent refill gaps.",
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
    "aks-explorer",
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
