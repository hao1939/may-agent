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
    name: "AKS RP E2E ready task count",
    type: "gauge",
    target: 5,
    threshold: -1,
    unit: "count",
    alertOp: "<",
    priority: "P3",
    description: "Dashboard counter for dispatchable task-tree leaves.",
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
    description: "Dashboard counter for currently leased task-tree leaves.",
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
    name: "AKS RP E2E accepted tasks in 24h",
    type: "gauge",
    target: 8,
    threshold: 1,
    unit: "count",
    alertOp: "<",
    priority: "P2",
    description:
      "Activity signal: the task tree should accept material work daily while active.",
  },
  {
    id: "aks-rp-e2e.task.no-work-with-gaps",
    name: "AKS RP E2E no work while model gaps remain",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "boolean",
    alertOp: ">",
    priority: "P0",
    description:
      "P0 unblock signal: no ready/active work while non-passing knowledge-model paths remain.",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
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
    threshold: 20,
    unit: "count",
    alertOp: ">",
    priority: "P2",
    description:
      "Impact signal: many failed paths without diagnosis should wake owner review.",
  },
  {
    id: "aks-rp-e2e.model.blocked-path-count",
    name: "AKS RP E2E blocked paths",
    type: "gauge",
    target: 0,
    threshold: 12,
    unit: "count",
    alertOp: ">",
    priority: "P1",
    description:
      "Impact signal: blocked model paths should become unblock or human-decision tasks.",
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
    name: "AKS RP E2E test spec count",
    type: "gauge",
    target: 125,
    threshold: -1,
    unit: "count",
    alertOp: "<",
    priority: "P3",
    description: "Dashboard counter for reviewable runnable test specs.",
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
    threshold: 25,
    unit: "count",
    alertOp: ">",
    priority: "P2",
    description:
      "Health signal: too many failed/blocked live runs means runner/spec/infra diagnosis is needed. Baseline ~18 due to ARM auth env limitations; threshold gives headroom for normal jitter.",
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
    threshold: 30,
    unit: "count",
    alertOp: ">",
    priority: "P2",
    description:
      "Loop hygiene signal: repeated same-purpose artifacts indicate agents may be cycling.",
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
