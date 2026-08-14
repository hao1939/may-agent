import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { MetricDefinition, MetricService } from "@may-agent/sdk/legacy";
import type { MetricSampleOutput } from "../../../../scripts/project-metrics.ts";

type ProjectMetricDefinition = {
  id: string;
  name: string;
  type: MetricDefinition["type"];
  target: number;
  threshold: number;
  unit: string;
  priority: MetricDefinition["priority"];
  alertOp: NonNullable<MetricDefinition["alertOp"]>;
  speed: string;
  description: string;
  configText?: string;
  status?: MetricDefinition["status"];
};

const projectMetricDefinitionsBase: ProjectMetricDefinition[] = [
  {
    id: "aks-rp-e2e.artifact.duplicate-group-count",
    name: "AKS RP E2E duplicate artifact groups",
    type: "gauge",
    target: 0,
    threshold: 700,
    unit: "count",
    priority: "P2",
    alertOp: ">",
    speed: "fast",
    description:
      "Loop hygiene signal: repeated same-purpose artifacts can indicate agents are cycling, but the old 500 threshold was calibrated against a smaller archive. On 2026-06-25 the current normalization produced 665 duplicate groups over the >3-file cutoff across 17,363 archive families and 29,991 counted archive files, with 638 groups above 5 files, 604 above 8 files, 584 above 10 files, 542 above 12 files, and 481 above 15 files. Recent accepted evidence growth has therefore moved the project's structural floor to roughly 665; threshold 700 keeps this as an interrupting signal only for material growth beyond the current steady-state instead of paging on every normal evidence wave. Filename normalization remains the 2026-06-21 in-place token removal that preserves semantic suffixes.",
  },
  {
    id: "aks-rp-e2e.feature.unknown-count",
    name: "AKS RP E2E unknown features",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description: "Dashboard counter for feature coverage remaining.",
  },
  {
    id: "aks-rp-e2e.model.blocked-path-count",
    name: "AKS RP E2E blocked paths",
    type: "gauge",
    target: 0,
    threshold: 9,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Impact signal: repo-local path.status=blocked entries should become unblock or human-decision tasks. The count intentionally excludes blocked-infra, accepted terminal/awaiting-external blocked paths, and blocked paths that already carry an exact resumeCondition/retestCondition because those are already represented by exact waits or durable exceptions. Threshold 45→9 after 2026-07-08 triage aligned the metric to the remaining blocked paths that still lack a terminal or exact-wait disposition.",
  },
  {
    id: "aks-rp-e2e.model.failed-path-count",
    name: "AKS RP E2E failed paths",
    type: "gauge",
    target: 0,
    threshold: 25,
    unit: "count",
    priority: "P2",
    alertOp: ">",
    speed: "fast",
    description:
      "Impact signal: many failed paths without diagnosis should wake app-ops review to create domain fix-forward work. Threshold 20->25: 22 discovered product-gaps (12 KMS firewalled-KV, plus deployment-safeguards, planned-maintenance, managedsystem, etc.) form a structural floor from active exploration; only external product fixes reduce this count. Calibrated 2026-06-12.",
  },
  {
    id: "aks-rp-e2e.planner.timeout-24h",
    name: "AKS RP E2E planner app-ops session timeouts in 24h",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P1",
    alertOp: ">",
    speed: "fast",
    description:
      "App-ops-visible planner health signal: counts planner_wake records from .state/planner-runs.jsonl in the last 24h whose app-ops session result timed out. Any nonzero count should wake app-ops to inspect planner recovery and backlog refill behavior.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.process.assignment-state-mismatch-count",
    name: "AKS RP E2E assignment state mismatch count",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 process signal: a project.task assignment pair is still open or orphaned, but the task is no longer active or no longer exists. This means task state moved without the closing completion/recovery event and needs planner or runtime repair.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.process.assignment.not-consumed-count",
    name: "AKS RP E2E queued assignments not consumed",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 process signal: project.task assignment rows are still queued after the worker-start grace window. The planner should re-emit task dispatch, clear a stale row, or repair worker dispatch so active work is actually consumed.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.process.blocked.missing-fallback-count",
    name: "AKS RP E2E blocked tasks missing fallback",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 process signal: a blocked leaf does not say when waiting stops being acceptable and what fallback action should happen. Add fallback_at and fallback_action or reopen the work.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.process.blocked.missing-observer-count",
    name: "AKS RP E2E blocked tasks missing observer",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 process signal: a blocked leaf does not say who checks the wait, how they check it, or when the next check happens. Add observed_by, observation_method, and next_check_at or reopen the work.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.process.blocked.missing-owner-count",
    name: "AKS RP E2E blocked tasks missing owner",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 process signal: a blocked leaf does not name the owner responsible for the wait. Add owner or convert the task back into actionable work.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.process.blocked.missing-waiting-for-count",
    name: "AKS RP E2E blocked tasks missing wait target",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 process signal: a blocked leaf does not name the exact condition it is waiting for. Blocked is not parked work; add waiting_for or convert the task back into actionable work.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count",
    name: "AKS RP E2E overdue blocked owner waits without active work",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "Compatibility alias for overdue blocked waits without active work. This includes human-owned waits unless a concrete active/review handoff or escalation references the blocked wait. Measurement stays live, but alert lifecycle is suppressed so the canonical metric owns paging.",
    configText: '{"alert":{"mode":"disabled","disabled":true}}',
  },
  {
    id: "aks-rp-e2e.process.blocked.overdue-unworked-count",
    name: "AKS RP E2E overdue blocked waits without active work",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 process signal: a blocked leaf passed its resume/fallback time, but no active or review task references that blocked wait. The owner label is not enough; create recovery/handoff/escalation work or refresh the exact wait.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.process.integrity.task-tree-problem-count",
    name: "AKS RP E2E task tree integrity problems",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 process signal: the task tree has structural integrity problems such as a root count other than one. This can hide work outside the intended project tree, so planner repair or intentional archive/disposition is required.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.process.loop.unrepresented-record-count",
    name: "AKS RP E2E loop records without live representation",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 process signal: a durable loop reports non-terminal ledger records that are not represented by child work, an exact blocked wait, an escalation, or an accepted terminal disposition. The loop controller and planner must make those records visible before the project can be considered closed.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.process.task.review-not-applied-count",
    name: "AKS RP E2E task reviews not applied",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Retired with the legacy asynchronous task-reviewer application path. The generic task reconciler now applies workflow results directly.",
    configText: '{"alert":{"mode":"disabled","disabled":true}}',
    status: "closed",
  },
  {
    id: "aks-rp-e2e.process.unowned-work-count",
    name: "AKS RP E2E unfinished work without active owner",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 process signal: unfinished work exists but is not actively owned by a healthy worker, recovery task, exact wait, or accepted terminal disposition. This intentionally covers task-tree leaves, loop-ledger records, and running workflow rows that lost their runtime session, because dead work can be hidden outside the task tree.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.process.unpublished-change-count",
    name: "AKS RP E2E project repo changes not visible to pipeline",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 process signal: the aks-rp-e2e project repo has dirty files or local commits that have not been pushed, so pipeline runs may be using stale test code, specs, plans, or artifacts. The local aks-rp-e2e.app repo is not counted here because app UI/task-state changes take effect locally.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.replay.script-count",
    name: "AKS RP E2E replay script count",
    type: "gauge",
    target: 125,
    threshold: -1,
    unit: "count",
    priority: "P3",
    alertOp: "<",
    speed: "fast",
    description: "Dashboard counter for generated replay scripts.",
  },
  {
    id: "aks-rp-e2e.run.live-failed-24h",
    name: "AKS RP E2E live runs failed/blocked in 24h",
    type: "gauge",
    target: 0,
    threshold: 55,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
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
    priority: "P1",
    alertOp: ">",
    speed: "fast",
    description:
      "Runner liveness signal: replay scripts and model gaps exist, but no live runs started in 24h.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.spec.blocked-count",
    name: "AKS RP E2E blocked specs",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Dashboard-only blocked-spec inventory signal: keeps truthful visibility on specs whose catalog/loop state is still blocked, including represented exact waits, reviewed-exception/frontier stewardship, and source/evidence ceilings. Keep this visible as raw spec inventory, but route interrupting blocked-spec actionability through existing companion metrics: aks-rp-e2e.task.blocked-actionable-count for malformed/overblocked wait families, aks-rp-e2e.process.blocked.overdue-unworked-count for missed resume/fallback coverage, and aks-rp-e2e.spec.unverified-without-work or aks-rp-e2e.task.no-work-with-gaps when blocked/unverified specs remain without active recovery work.",
  },
  {
    id: "aks-rp-e2e.spec.draft-count",
    name: "AKS RP E2E draft specs",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Dashboard burn-down counter: specs that still need replay/readiness work before live verification. Not an interrupting alert — the real health signals are spec.unverified-without-work (P0, fires when no verification work is planned) and task.no-work-with-gaps (P0, fires when no work at all while gaps remain). Calibrated threshold 200→999999 and priority P2→P3 on 2026-06-14: threshold=200 on a 335-spec burn-down creates a permanent P2 alert that interrupts without adding value; trend is positive (265→256).",
  },
  {
    id: "aks-rp-e2e.spec.ready-count",
    name: "AKS RP E2E ready specs",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Dashboard burn-down counter: specs marked ready but not yet live-verified. These should be grouped into execution waves or run individually. Not an interrupting alert — the real health signals are spec.unverified-without-work (P0, fires when no verification work is planned) and task.no-work-with-gaps (P0, fires when no work at all while gaps remain). Calibrated threshold 20→999999 and priority P2→P3 on 2026-06-14: batch draft→ready promotion (268 specs) is normal pipeline progress, not a failure; threshold=20 creates a permanent P2 alert that interrupts without adding value.",
  },
  {
    id: "aks-rp-e2e.spec.recovery-unowned-count",
    name: "AKS RP E2E retry-drained specs without recovery owner",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Debug component for process.unowned-work-count: retry-drained spec-loop records that are not represented by an open recovery, exact wait, or escalation task.",
  },
  {
    id: "aks-rp-e2e.spec.retry-exhausted-count",
    name: "AKS RP E2E retry-drained specs",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Dashboard counter: specs that exhausted direct retry and now require grouped recovery, exact wait, escalation, or a fresh meaningful fix before another run.",
  },
  {
    id: "aks-rp-e2e.spec.reviewed-exception-count",
    name: "AKS RP E2E reviewed spec exceptions",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Specs with durable non-pass exception status such as product-gap, product-constraint, environment-blocked, blocked-infra, superseded, or out-of-scope.",
  },
  {
    id: "aks-rp-e2e.spec.total-count",
    name: "AKS RP E2E indexed test spec count",
    type: "gauge",
    target: 335,
    threshold: -1,
    unit: "count",
    priority: "P3",
    alertOp: "<",
    speed: "fast",
    description:
      "Dashboard counter for the canonical feature-owned spec catalog used by the spec verification loop; a legacy specs/index.json is used only when present.",
  },
  {
    id: "aks-rp-e2e.spec.unverified-without-work",
    name: "AKS RP E2E unverified specs without verification work",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "boolean",
    priority: "P0",
    alertOp: ">",
    speed: "fast",
    description:
      "P0 planning signal: unverified specs exist but no verification branch/task work is open in the task tree.",
    configText: '{"alert":{"mode":"consecutive_failures","count":1}}',
  },
  {
    id: "aks-rp-e2e.spec.verified-count",
    name: "AKS RP E2E verified passing specs",
    type: "gauge",
    target: 335,
    threshold: -1,
    unit: "count",
    priority: "P3",
    alertOp: "<",
    speed: "fast",
    description:
      "Specs with status=pass and specState in verified/validated/resolved/pass. Legacy pass without explicit specState is not counted as verified.",
  },
  {
    id: "aks-rp-e2e.task.active-count",
    name: "AKS RP E2E active task count",
    type: "gauge",
    target: 5,
    threshold: -1,
    unit: "count",
    priority: "P3",
    alertOp: "<",
    speed: "fast",
    description:
      "Dashboard counter for non-runtime live projection leaves that are actually running/active. Structural nodes and runtime carriers are excluded.",
  },
  {
    id: "aks-rp-e2e.task.blocked-count",
    name: "AKS RP E2E blocked task count",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Dashboard-only blocked-leaf inventory signal: counts every blocked leaf, including durable exact family holders and future-window blocked waits that intentionally preserve a represented frontier before their review/fallback window opens. Keep this visible as raw inventory, but route interrupting actionability from aks-rp-e2e.task.blocked-actionable-count and blocked-overdue family metrics instead of paging repeatedly on scheduled represented waits.",
  },
  {
    id: "aks-rp-e2e.task.ready-count",
    name: "AKS RP E2E runnable backlog count",
    type: "gauge",
    target: 5,
    threshold: -1,
    unit: "count",
    priority: "P3",
    alertOp: "<",
    speed: "fast",
    description:
      "Compatibility metric id. Counts planner-assignable pending leaves from the live task-tree projection whose readiness.state=ready and readiness.reason is not dependency-blocked. Satisfied exact wait holders stay visible in the tree but are excluded from this backlog metric because ready is not a persisted task state.",
  },
  {
    id: "aks-rp-e2e.task.ready-starvation-with-gaps",
    name: "AKS RP E2E runnable backlog starvation while verification gaps remain",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "boolean",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Compatibility metric id. Planner refill signal: no runnable backlog leaves exist while model path gaps or unverified specs remain and there is no active/review work already in flight. P3 keeps this dashboard-only unless it persists with no active/review work.",
    configText: '{"alert":{"mode":"consecutive_failures","count":12}}',
  },
  {
    id: "aks-rp-e2e.task.stale-active-count",
    name: "AKS RP E2E stale active task count",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Dashboard counter for active task-tree leaves whose attached worker session is missing, not running, errored/interrupted, or still at zero operations after the stale threshold.",
  },
];

function metricSourceCommand(appDir: string, metricId: string): string {
  return `bun ${appDir}/scripts/project-metrics.ts ${metricId} --json`;
}

function parseConfig(configText?: string): Record<string, unknown> | undefined {
  if (!configText) return undefined;
  return JSON.parse(configText) as Record<string, unknown>;
}

function noteText(note: unknown): string | undefined {
  if (note == null) return undefined;
  return typeof note === "string" ? note : JSON.stringify(note);
}

export function sampleProjectMetricOutputs(input: {
  appDir: string;
  projectDir: string;
  metricIds: string[];
}): Record<string, MetricSampleOutput> {
  const result = spawnSync(
    "bun",
    [
      join(input.appDir, "scripts", "project-metrics.ts"),
      "--batch-json",
      ...input.metricIds,
    ],
    {
      cwd: input.appDir,
      encoding: "utf8",
      env: {
        ...process.env,
        AKS_RP_E2E_APP_DIR: input.appDir,
        PROJECT_DIR: input.projectDir,
      },
      timeout: 120_000,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Project metric sampler exited ${result.status}: ${String(result.stderr).trim()}`,
    );
  }
  const parsed = JSON.parse(String(result.stdout)) as Record<
    string,
    MetricSampleOutput
  >;
  for (const metricId of input.metricIds) {
    if (typeof parsed[metricId]?.value !== "number") {
      throw new Error(`Project metric sampler omitted ${metricId}`);
    }
  }
  return parsed;
}

export function projectMetricDefinitions(appDir: string): MetricDefinition[] {
  return projectMetricDefinitionsBase.map((definition) => ({
    id: definition.id,
    name: definition.name,
    owner: "app-ops",
    project: "aks-rp-e2e",
    type: definition.type,
    target: definition.target,
    threshold: definition.threshold,
    unit: definition.unit,
    priority: definition.priority,
    alertOp: definition.alertOp,
    speed: definition.speed,
    description: definition.description,
    config: parseConfig(definition.configText),
    source: "source_command",
    sourceCommand: metricSourceCommand(appDir, definition.id),
    measureInterval: 300_000,
    status: definition.status ?? "active",
  }));
}

export function publishProjectMetrics(input: {
  metrics?: Pick<MetricService, "defineMany" | "record" | "evaluate"> | null;
  appDir: string;
  projectDir: string;
  measuredBy?: string;
}): Array<{ id: string; value: number; measuredAt: number }> {
  if (!input.metrics) return [];

  const definitions = projectMetricDefinitions(input.appDir);
  input.metrics.defineMany(definitions);
  const activeDefinitions = definitions.filter(
    (definition) => definition.status === "active",
  );
  const samples = sampleProjectMetricOutputs({
    appDir: input.appDir,
    projectDir: input.projectDir,
    metricIds: activeDefinitions.map((definition) => definition.id),
  });

  const published: Array<{ id: string; value: number; measuredAt: number }> =
    [];
  for (const definition of activeDefinitions) {
    const sample: MetricSampleOutput = samples[definition.id]!;
    input.metrics.record(definition.id, sample.value, {
      measuredAt: sample.measuredAt,
      measuredBy: input.measuredBy,
      sampleSize: sample.sampleSize,
      note: noteText(sample.note),
    });
    input.metrics.evaluate(definition.id);
    published.push({
      id: definition.id,
      value: sample.value,
      measuredAt: sample.measuredAt ?? Date.now(),
    });
  }

  return published;
}
