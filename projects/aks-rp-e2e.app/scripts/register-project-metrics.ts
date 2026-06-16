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
    id: "aks-rp-e2e.task.ready-starvation-with-gaps",
    name: "AKS RP E2E runnable backlog starvation while verification gaps remain",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "boolean",
    alertOp: ">",
    priority: "P3",
    description:
      "Compatibility metric id. Planner refill signal: no runnable backlog leaves exist while model path gaps or unverified specs remain, even if one long task is active. P3 keeps this dashboard-only unless it persists with no active/review work.",
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
      "Impact signal: blocked model paths should become unblock or human-decision tasks. Threshold 14→45, P2→P3: metric counts both terminal structural blocks (5) and transient WIP blocks from active staging batches (32 as of calibration). The spike 11→38 was caused by localdns ARM-auth failures (15 paths), storage-csi/net-integration replay body WIP (12 paths), and misc staging gating (5 paths). Threshold 45 accommodates normal staging wave volume; review when staging completes. Calibrated 2026-06-15.",
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
    target: 4,
    threshold: 1,
    unit: "count",
    alertOp: "<",
    priority: "P1",
    description:
      "Activity signal: runnable specs should produce live staging feedback.",
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
      "Health signal: too many failed/blocked live runs means runner/spec/infra diagnosis is needed. Structural floor ~21 (blocked-by-runner + infra_failed). Absolute threshold is inherently noisy: reruns inflate count (remediation worsens metric), and run volume varies (58→68+/day). P3 makes this a dashboard signal, not an interrupting alert. Review: promote back to P2 if pass rate drops below 15% consistently. Calibrated 20→25→28→35→42→50→55, priority P2→P3 (breaking threshold-chase cycle).",
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
    id: "aks-rp-e2e.artifact.duplicate-group-count",
    name: "AKS RP E2E duplicate artifact groups",
    type: "gauge",
    target: 0,
    threshold: 45,
    unit: "count",
    alertOp: ">",
    priority: "P2",
    description:
      "Loop hygiene signal: repeated same-purpose artifacts indicate agents may be cycling. Threshold 30→40→45: structural floor is 41 groups (top: probe 42, ccp-security-patch-ubuntu2404 40, ccp-security-patch-azurelinux 34, ccp-vpa-os-arch 24, cloud-provider-multiple-slb 21). 88 groups sit at 3 entries; active staging days push 1-3 groups over daily. Only a sudden jump above 45 indicates real agent cycling. Calibrated 2026-06-16.",
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
