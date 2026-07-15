import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type SpecLoopState = {
  specs?: Record<
    string,
    {
      taskId?: string | null;
      catalogSpecState?: string | null;
      review?: { classification?: string | null } | null;
      successorEvidencePath?: string | null;
      resumeCondition?: string | null;
    }
  >;
};

type BlockerRecord = {
  condition?: string;
  waiting_for?: Record<string, unknown>;
  observed_by?: Record<string, unknown>;
  observation_method?: string;
  resume_condition?: string;
  next_check_at?: string;
  fallback_at?: string;
  fallback_action?: string;
  owner?: string;
};

type ApprovalDispatchLedgerRow = {
  ts?: string;
  pathId?: string;
  approvalId?: string;
  waitId?: string;
  packetPath?: string;
};

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ];
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function blockerOf(task: TaskNode, taskId: string): BlockerRecord {
  if (!task.blocker || typeof task.blocker !== "object") {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return task.blocker as BlockerRecord;
}

function latestRow37Approval(
  approvalDispatchPath: string,
  pathId: string,
): ApprovalDispatchLedgerRow | null {
  const body = readFileSync(approvalDispatchPath, "utf-8");
  const rows = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ApprovalDispatchLedgerRow)
    .filter((row) => row.pathId === pathId && (row.approvalId || row.waitId));
  return rows.at(-1) ?? null;
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const specLoopPath = resolve(appDir, ".state/spec-loop/state.json");
const approvalDispatchPath = resolve(
  appDir,
  ".state/approval-dispatch-runs.jsonl",
);
const memoPath =
  "evidence/archive/ops-repair-aad-rbac-reviewed-exception-trio-metadata-drift-20260714.md";
const featureKey = "aad-rbac";
const retiredCompactTaskId = "hold-compact-aad-rbac-package-partial-frontier";
const liveCompactTaskId = "hold-compact-aad-rbac-reviewed-exception-trio-frontier";
const row37TaskId =
  "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705";
const secopsTaskId =
  "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702";
const managedSpecId = "spec.aad-rbac.managed-v2-lifecycle";
const runCommandSpecId = "spec.aad-rbac.run-command-access";
const pathId = "path.aad-rbac.managed-v2-lifecycle";
const expectedFrontierTaskIds = [row37TaskId, secopsTaskId];
const liveCompactGoal =
  "Preserve only the exact aad-rbac reviewed-exception compact trio: the capacity-family wait for spec.aad-rbac.azure-rbac-automatic-sku, the row-37 owner contradiction holder for spec.aad-rbac.managed-v2-lifecycle, and the reviewed-exception/domain-evidence ceiling for spec.aad-rbac.run-command-access.";
const liveCompactAcceptance = [
  "The holder preserves only the reviewed-exception trio and records the exact surviving downstream lineage: wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702, hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705, and reviewed-exception/domain evidence for spec.aad-rbac.run-command-access.",
  "The old broad package-partial frontage is retired; the compact leaf now truthfully describes a reviewed-exception trio only.",
];
const liveCompactBlocker = {
  condition:
    "Blocked only as the reviewed-exception trio holder after mounted-source compact review confirmed that the only surviving aad-rbac compact residue is spec.aad-rbac.azure-rbac-automatic-sku behind wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702, spec.aad-rbac.managed-v2-lifecycle behind hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705, and reviewed-exception/domain evidence for spec.aad-rbac.run-command-access.",
  resume_condition:
    "Resume only when the same-path capacity-family wait returns, the row-37 owner adjudication changes, or stronger direct run-command-access evidence materially changes the reviewed-exception ceiling.",
  resume_at: "2026-07-15T10:30:00Z",
  next_check_at: "2026-07-15T10:30:00Z",
  fallback_at: "2026-07-16T10:30:00Z",
  fallback_action:
    "If one of the exact downstream carriers changes by fallback time, refresh this trio holder to the returned lineage instead of restoring a broad package-partial wait.",
  category: "external-wait",
  owner: "aks-explorer",
  blocked_at: "2026-07-14T10:47:35.350Z",
  waiting_for: {
    type: "blocker.resolved",
    taskId: liveCompactTaskId,
  },
  observed_by: {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.planning.requested",
  },
  observation_method:
    "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
};
const refreshedOwnerReason =
  "All feature-owned specs are already selected into the compact package, so the remaining controller-visible compact frontier is the reviewed-exception trio: one shared capacity-family wait carrier, one row-37 owner-adjudication wait carrier, and one run-command reviewed-exception/domain-evidence carrier rather than missing package membership or a truthful broad rerun candidate.";
const refreshedLastSummary =
  "Current aad-rbac compact reviewed-exception trio is only: wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702 and hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705 remain the live blocked carriers, while spec.aad-rbac.run-command-access stays evidence-only under reviewed-exception/spec-loop/domain authority. No broad compact rerun is truthful. See evidence/archive/ops-repair-aad-rbac-reviewed-exception-trio-metadata-drift-20260714.md.";
const refreshedSummary =
  "Controller-visible aad-rbac compact state now points at hold-compact-aad-rbac-reviewed-exception-trio-frontier while preserving the same represented frontier task ids and the evidence-only reviewed-exception ceiling for spec.aad-rbac.run-command-access.";

const specLoop = JSON.parse(readFileSync(specLoopPath, "utf-8")) as SpecLoopState;
const managedSpec = specLoop.specs?.[managedSpecId];
const runCommandSpec = specLoop.specs?.[runCommandSpecId];
if (managedSpec?.taskId !== row37TaskId) {
  throw new Error(
    `${managedSpecId} must remain assigned to ${row37TaskId}; got ${String(
      managedSpec?.taskId ?? null,
    )}`,
  );
}
if (runCommandSpec?.catalogSpecState !== "reviewed-exception") {
  throw new Error(
    `${runCommandSpecId} must remain reviewed-exception; got ${String(
      runCommandSpec?.catalogSpecState ?? null,
    )}`,
  );
}

const latestApproval = latestRow37Approval(approvalDispatchPath, pathId);
if (!latestApproval?.approvalId || !latestApproval.waitId) {
  throw new Error(`Missing approval resend lineage for ${pathId}`);
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const treeRepair = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks["aks-feature-compact-loop"] as TaskNode | undefined;
  const retiredCompactTask = tree.tasks[retiredCompactTaskId] as TaskNode | undefined;
  const row37Task = tree.tasks[row37TaskId] as TaskNode | undefined;
  if (!loopTask) throw new Error("Task not found: aks-feature-compact-loop");
  if (!retiredCompactTask) {
    throw new Error(`Task not found: ${retiredCompactTaskId}`);
  }
  if (!row37Task) throw new Error(`Task not found: ${row37TaskId}`);

  const row37Blocker = blockerOf(row37Task, row37TaskId);
  const beforeWaitingFor =
    row37Blocker.waiting_for && typeof row37Blocker.waiting_for === "object"
      ? { ...row37Blocker.waiting_for }
      : null;

  row37Blocker.waiting_for = removeUndefined({
    ...(beforeWaitingFor ?? {}),
    type: "owner.decision",
    taskId: row37TaskId,
    specId: managedSpecId,
    pathId,
    approvalPathId: pathId,
    approvalId: latestApproval.approvalId,
    latestApprovalId: latestApproval.approvalId,
    latestWaitId: latestApproval.waitId,
    packetPath: latestApproval.packetPath,
    resentAt: latestApproval.ts,
  });

  const now = new Date().toISOString();
  const liveCompactTask = {
    id: liveCompactTaskId,
    parent_id: loopTask.id,
    state: "blocked",
    kind: "domain_leaf",
    priority: "P2",
    owner: "aks-explorer",
    children: [],
    goal: liveCompactGoal,
    inputs: [],
    outputs: [".state/feature-compact-loop/state.json"],
    acceptance: liveCompactAcceptance,
    forbidden: [],
    conflict_scope: [`feature-compact:${featureKey}`],
    depends_on: [],
    blocker: liveCompactBlocker,
    trace: {
      created_at: "2026-07-14T10:47:35.350Z",
      created_by: "task-tree-tool",
      blocked_contract_repaired_at: "2026-07-14T10:47:35.377Z",
      metadata_drift_restored_at: now,
      metadata_drift_restored_by: process.env.WORKER ?? "app-ops",
    },
    status: "blocked",
  } as TaskNode;
  tree.tasks[liveCompactTaskId] = liveCompactTask;
  if (!loopTask.children?.includes(liveCompactTaskId)) {
    loopTask.children = [...(loopTask.children ?? []), liveCompactTaskId];
  }

  retiredCompactTask.state = "done";
  retiredCompactTask.status = "done";
  (retiredCompactTask as TaskNode & { resolution?: string }).resolution =
    "replaced";
  (retiredCompactTask as TaskNode & { done_at?: string }).done_at = now;
  (retiredCompactTask as TaskNode & { done_by?: string }).done_by =
    process.env.WORKER ?? "app-ops";
  (retiredCompactTask as TaskNode & { result?: string }).result =
    `Replaced by ${liveCompactTaskId} after repairing aad-rbac compact-holder metadata drift and restoring the reviewed-exception trio holder as the live controller-visible compact frontier.`;
  delete (retiredCompactTask as Record<string, unknown>).blocker;
  retiredCompactTask.trace = {
    ...(retiredCompactTask.trace ?? {}),
    compact_holder_projection_replaced_at: now,
    compact_holder_projection_replaced_by: process.env.WORKER ?? "app-ops",
    compact_holder_projection_replacement_task_ids: [
      liveCompactTaskId,
      row37TaskId,
      secopsTaskId,
    ],
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return {
    liveCompactBlocker,
    beforeWaitingFor,
    afterWaitingFor: row37Blocker.waiting_for,
    row37Condition: row37Blocker.condition ?? null,
    row37ResumeCondition: row37Blocker.resume_condition ?? null,
    retiredCompactStatus: {
      state: retiredCompactTask.state ?? null,
      status: retiredCompactTask.status ?? null,
      resolution: (retiredCompactTask as TaskNode & { resolution?: string })
        .resolution,
    },
  };
});

const { state, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const existing = state.features[featureKey];
if (!existing) {
  throw new Error(`Compact feature not found: ${featureKey}`);
}

const beforeCompact = {
  taskId: existing.taskId ?? null,
  frontierTaskIds: existing.frontierTaskIds ?? null,
  waitingFor: existing.waitingFor ?? null,
  blockedReason: existing.blockedReason ?? null,
  reviewEvidencePath: existing.reviewEvidencePath ?? null,
};

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  taskId: liveCompactTaskId,
  frontierTaskIds: expectedFrontierTaskIds,
  retryable: false,
  retryReason: treeRepair.liveCompactBlocker.resume_condition ?? null,
  blockedReason: treeRepair.liveCompactBlocker.condition ?? null,
  waitingFor: (treeRepair.liveCompactBlocker.waiting_for ?? null) as Record<
    string,
    unknown
  > | null,
  waitingCondition: treeRepair.liveCompactBlocker.resume_condition ?? null,
  observedBy: (treeRepair.liveCompactBlocker.observed_by ?? null) as Record<
    string,
    unknown
  > | null,
  observationMethod: treeRepair.liveCompactBlocker.observation_method ?? null,
  nextCheckAt: treeRepair.liveCompactBlocker.next_check_at ?? null,
  blockerOwner:
    typeof treeRepair.liveCompactBlocker.owner === "string"
      ? treeRepair.liveCompactBlocker.owner
      : existing.blockerOwner ?? null,
  fallbackAt: treeRepair.liveCompactBlocker.fallback_at ?? null,
  fallbackAction: treeRepair.liveCompactBlocker.fallback_action ?? null,
  ownerReason: refreshedOwnerReason,
  lastSummary: refreshedLastSummary,
  summary: refreshedSummary,
  reviewEvidencePath: memoPath,
  evidencePaths: unique([
    memoPath,
    "/app/projects/aks-rp-e2e/evidence/archive/reconcile-aad-rbac-row37-mounted-source-compact-projection-20260713.md",
    "/app/projects/aks-rp-e2e/evidence/archive/domain-reconcile-vm-prerelease-row37-managed-aad-mounted-source-20260713.md",
    "/app/projects/aks-rp-e2e/evidence/archive/domain-aad-rbac-run-command-access-mounted-source-branch-options-20260712.md",
    "/app/projects/aks-rp-e2e/evidence/archive/bound-spec-aad-rbac-run-command-access-user-vs-serviceprincipal-branch-20260703.md",
    "evidence/archive/ops-reconcile-aad-rbac-environment-overblock-family-20260714.md",
    ...(existing.evidencePaths ?? []),
  ]),
  attemptedFixes: unique([
    ...(existing.attemptedFixes ?? []),
    `Repaired aad-rbac trio metadata drift by repointing compact state from retired ${retiredCompactTaskId} to live ${liveCompactTaskId} and retagging ${row37TaskId} as owner.decision without changing the represented frontier.`,
  ]),
  lastCheckedAt: new Date().toISOString(),
});
saveFeatureCompactLoopState(compactStatePath, state);

const after = state.features[featureKey];

console.log(
  JSON.stringify(
    {
      memoPath,
      paths: {
        compactStatePath,
        specLoopPath,
        approvalDispatchPath,
      },
      compact: {
        before: beforeCompact,
        after: {
          taskId: after?.taskId ?? null,
          frontierTaskIds: after?.frontierTaskIds ?? null,
          waitingFor: after?.waitingFor ?? null,
          blockedReason: after?.blockedReason ?? null,
          waitingCondition: after?.waitingCondition ?? null,
          nextCheckAt: after?.nextCheckAt ?? null,
          fallbackAt: after?.fallbackAt ?? null,
          reviewEvidencePath: after?.reviewEvidencePath ?? null,
          summary: after?.summary ?? null,
        },
      },
      row37: {
        beforeWaitingFor: treeRepair.beforeWaitingFor,
        afterWaitingFor: treeRepair.afterWaitingFor,
        condition: treeRepair.row37Condition,
        resumeCondition: treeRepair.row37ResumeCondition,
      },
      approvals: latestApproval,
      runCommand: {
        specId: runCommandSpecId,
        catalogSpecState: runCommandSpec?.catalogSpecState ?? null,
        reviewClassification: runCommandSpec?.review?.classification ?? null,
        successorEvidencePath: runCommandSpec?.successorEvidencePath ?? null,
        resumeCondition: runCommandSpec?.resumeCondition ?? null,
      },
    },
    null,
    2,
  ),
);
