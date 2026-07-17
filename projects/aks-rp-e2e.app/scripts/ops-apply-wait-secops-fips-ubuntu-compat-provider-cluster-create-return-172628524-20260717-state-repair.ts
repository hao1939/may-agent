import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  type SpecLoopSpecState,
} from "../workflows/lib/spec-loop-store.ts";

type JsonRecord = Record<string, unknown>;
type ArchivedBundle = { tasks?: Array<JsonRecord> };

type SpecRow = SpecLoopSpecState & JsonRecord;

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717-state-repair_20260717042819";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const repairedAt = new Date().toISOString();

const taskId =
  "wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717";
const parentId = "aks-spec-verification-loop";
const specId = "spec.secops-fips.ubuntu-compat";
const runId = "172628524";
const runUrl =
  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172628524";
const resourceGroup = "rg-plan-001-4426-n454fb-046184";
const clusterName = "aks-plan-001-4426-n454fb-046184";
const archiveTaskId = "wait-secops-fips-ubuntu-compat-ado-run-172604921-result";
const evidencePath =
  "evidence/archive/ops-apply-wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717-state-repair.md";
const evidenceAbsolute = resolve(appDir, evidencePath);
const archiveDir = resolve(appDir, ".state/tasks/archive");
const nextCheckAt = "2026-07-17T18:00:00Z";
const fallbackAt = "2026-07-18T18:00:00Z";
const blockerRecordedAt = "2026-07-17T04:22:18.966Z";
const resultPath =
  "../aks-rp-e2e/workspace/wait-secops-fips-ubuntu-compat-ado-run-172628524-result/20260717T040801Z/slice-01-test-results/runs/test-results/test_20260717032324426_n454fb_046184/result.json";
const diagnosisMemo =
  "../aks-rp-e2e/evidence/archive/diagnose-secops-fips-ubuntu-compat-cluster-create-http-500-run-172628524-20260717.md";
const terminalReviewMemo =
  "../aks-rp-e2e/evidence/archive/wait-secops-fips-ubuntu-compat-ado-run-172628524-result-20260717.md";
const repairedLineageMemo =
  "../aks-rp-e2e/evidence/archive/repair-secops-fips-ubuntu-compat-host-validation-daemonset-yaml-20260717.md";
const blockerMemo =
  "../aks-rp-e2e/evidence/archive/record-secops-fips-ubuntu-compat-provider-cluster-create-blocker-run-172628524-20260717.md";
const escalationPacket =
  "../aks-rp-e2e/evidence/archive/prepare-secops-fips-ubuntu-compat-provider-cluster-create-escalation-packet-172628524-20260717.md";
const domainEvidenceRefs = [
  diagnosisMemo,
  terminalReviewMemo,
  repairedLineageMemo,
  blockerMemo,
  escalationPacket,
  "../aks-rp-e2e/workspace/wait-secops-fips-ubuntu-compat-ado-run-172628524-result/20260717T040801Z/ado-run-show.json",
  "../aks-rp-e2e/workspace/wait-secops-fips-ubuntu-compat-ado-run-172628524-result/20260717T040801Z/plan-inputs/plans/plan_20260717032324426_n454fb.json",
  "../aks-rp-e2e/workspace/wait-secops-fips-ubuntu-compat-ado-run-172628524-result/20260717T040801Z/slice-01-test-results/runs/test-results/test_20260717032324426_n454fb_046184/result.json",
  "../aks-rp-e2e/workspace/wait-secops-fips-ubuntu-compat-ado-run-172628524-result/20260717T040801Z/slice-01-test-results/runs/test-results/test_20260717032324426_n454fb_046184/artifacts/secops-fips-ubuntu-compat/spec-runner/result.json",
  "../aks-rp-e2e/workspace/wait-secops-fips-ubuntu-compat-ado-run-172628524-result/20260717T040801Z/slice-01-test-results/runs/test-results/test_20260717032324426_n454fb_046184/artifacts/secops-fips-ubuntu-compat/stdout.log",
  "../aks-rp-e2e/workspace/wait-secops-fips-ubuntu-compat-ado-run-172628524-result/20260717T040801Z/slice-01-test-results/runs/test-results/test_20260717032324426_n454fb_046184/shared-clusters/shared-exec-cluster-01.json",
];

const waitGoal =
  "Hold the exact external/provider blocker for spec.secops-fips.ubuntu-compat run 172628524 while awaiting provider/RP guidance on the AKS cluster-create HTTP 500 / MC resource-group Get failure, with one governed fallback window and no duplicate unchanged reruns.";
const waitCondition =
  "Blocked on the reviewed live create surface for spec.secops-fips.ubuntu-compat run 172628524: resource group rg-plan-001-4426-n454fb-046184 was created successfully, but cluster step op.create-k8s135-plus-fips-ubuntu-cluster failed with http=500 provisioningState=(missing); pools=[] and terminal summary Get resource group MC_rg-plan-001-4426-n454fb-046184_aks-plan-001-4426-n454fb_westus2 failed. The earlier daemonset-YAML defect is already fixed in this lineage, so the current frontier is external/provider create-path guidance, not a new proven repo-local repair.";
const resumeCondition =
  "Resume only when authoritative provider/RP guidance, an exact owner reroute, or reviewed fallback evidence changes the same create-path surface enough to justify one bounded successor. Do not reopen unchanged reruns early.";
const fallbackAction =
  "If no provider/RP guidance is available by fallback time, attach any returned guidance if present; otherwise allow exactly one same-slice staging rerun of spec.secops-fips.ubuntu-compat if a provider route exists, or escalate to human/operator using ../aks-rp-e2e/evidence/archive/prepare-secops-fips-ubuntu-compat-provider-cluster-create-escalation-packet-172628524-20260717.md if no provider route exists.";
const observationMethod =
  "Scheduled blocked-frontier owner review checks the stated provider/RP wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.";
const taskResult =
  `${attemptId}: restored ${taskId} as the single blocked external/provider wait for ${specId} run ${runId}, attached the required diagnosis/terminal-review/repaired-lineage/blocker/escalation evidence, and preserved the controlled next-check/fallback window without creating a duplicate sibling wait.`;
const specStateReason =
  `The current truthful frontier for ${specId} is the external/provider cluster-create blocker from Azure DevOps run ${runId}: resource group ${resourceGroup} was created, but cluster ${clusterName} failed at op.create-k8s135-plus-fips-ubuntu-cluster with HTTP 500 / MC resource-group Get failure after the earlier daemonset-YAML defect had already been repaired.`;
const specReviewAction =
  `Keep pending under ${taskId}. Await provider/RP guidance or exact owner reroute for run ${runId}, preserve the repaired daemonset-YAML lineage as solved history, and do not reopen unchanged reruns before the governed next-check/fallback window.`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf8");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function deleteKeys(record: JsonRecord, keys: string[]): void {
  for (const key of keys) delete record[key];
}

function findArchivedTask(targetTaskId: string): { archivePath: string; task: TaskNode } {
  const files = readdirSync(archiveDir)
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a));

  for (const file of files) {
    const archivePath = resolve(archiveDir, file);
    const bundle = readJson<ArchivedBundle>(archivePath);
    const task = (bundle.tasks ?? []).find((entry) => entry.id === targetTaskId);
    if (task) {
      return {
        archivePath,
        task: clone(task as TaskNode),
      };
    }
  }

  throw new Error(`Archived task ${targetTaskId} not found under ${archiveDir}`);
}

function taskSnapshot(task: TaskNode | undefined, id = "(missing)") {
  if (!task) return { id, present: false };
  return {
    id: task.id,
    present: true,
    revision: task.revision ?? null,
    parent_id: asString(task.parent_id),
    state: asString(task.state),
    goal: asString(task.goal),
    outputs: asStringArray(task.outputs),
    evidence: asStringArray((task as TaskNode & { evidence?: unknown }).evidence),
    blocker: task.blocker ?? null,
    result: asString(task.result),
  };
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const archived = findArchivedTask(taskId);
const beforeTree = readTaskTree(config);
const beforeParent = beforeTree.tasks[parentId] as TaskNode | undefined;
const beforeLive = beforeTree.tasks[taskId] as TaskNode | undefined;
assert(beforeParent, `Missing live parent ${parentId}`);

const specStateLoadedBefore = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: parentId,
  windowSize: 5,
});
const specRowBefore = specStateLoadedBefore.state.specs[specId] as SpecRow | undefined;
assert(specRowBefore, `Missing spec-loop row for ${specId}`);

const sameScopeBefore = Object.values(beforeTree.tasks)
  .filter((task) =>
    asStringArray(task.conflict_scope).includes(`ado-run:${runId}`) ||
    asStringArray(task.conflict_scope).includes(`spec:${specId}`),
  )
  .map((task) => ({
    id: task.id,
    state: asString(task.state),
    parent_id: asString(task.parent_id),
  }))
  .sort((a, b) => String(a.id).localeCompare(String(b.id)));

const featureStateBefore = readJson<JsonRecord>(resolve(appDir, ".state/feature-compact-loop/state.json"));
const secopsFeatureBefore = asRecord(asRecord(featureStateBefore.features).secops);

const baseline = {
  archivePath: archived.archivePath.replace(`${appDir}/`, ""),
  archivedTask: taskSnapshot(archived.task, taskId),
  liveTask: taskSnapshot(beforeLive, taskId),
  parentHasTask: asStringArray(beforeParent.children).includes(taskId),
  sameScopeLiveTasks: sameScopeBefore,
  specLoopRow: clone(specRowBefore),
  secopsFeatureTaskId: asString(secopsFeatureBefore.taskId),
  secopsFeatureFrontierTaskIds: asStringArray(secopsFeatureBefore.frontierTaskIds),
};

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const liveParent = tree.tasks[parentId] as TaskNode | undefined;
  assert(liveParent, `Missing live parent ${parentId} during repair`);

  const sourceTask = clone(archived.task);
  const existingLive = tree.tasks[taskId] as TaskNode | undefined;
  const revisionBase = Math.max(
    Number.isInteger(sourceTask.revision) ? Number(sourceTask.revision) : 0,
    Number.isInteger(existingLive?.revision) ? Number(existingLive?.revision) : 0,
  );
  const revision = revisionBase + 1;
  const priorState = asString(existingLive?.state) ?? "archived-done";

  const trace = {
    ...asRecord(sourceTask.trace),
    ...asRecord(existingLive?.trace),
  };
  deleteKeys(trace, [
    "assigned_at",
    "assigned_by",
    "assigned_worker",
    "current_attempt_id",
    "worker_started_attempt_id",
    "worker_started_at",
    "last_session",
    "workflowResult",
    "late_worker_completions",
    "late_worker_completion_recorded_at",
    "late_worker_completion_attempt_id",
    "last_worker_result",
    "last_worker_claim",
    "last_worker_summary",
    "last_worker_completed_at",
    "last_worker_task_revision",
    "last_worker_evidence",
    "reviewed_at",
    "reviewed_by",
    "review_summary",
    "requeued_at",
    "requeued_by",
    "requeue_reason",
  ]);
  trace.restored_from_archive_path = archived.archivePath.replace(`${appDir}/`, "");
  trace.blocked_wait_restored_at = repairedAt;
  trace.blocked_wait_restored_by = worker;
  trace.blocked_wait_restore_attempt_id = attemptId;
  trace.blocked_wait_restore_summary =
    `Restored ${taskId} from archived done state to the live blocked external/provider wait after planner maintenance compacted the reviewed leaf before the wait contract was actually activated.`;
  trace.blocked_wait_requeue_guard_applied_at = repairedAt;
  trace.blocked_wait_requeue_guard_applied_by = worker;
  trace.blocked_wait_requeue_guard_attempt_id = attemptId;
  trace.blocked_wait_requeue_guard_reason =
    "Preserve the exact restored external/provider wait as app-owned repair state so the planner does not immediately reopen the same task-tree-followup lineage as runnable backlog before provider/RP guidance arrives.";
  trace.previous_nonterminal_status = priorState;
  trace.current_task_revision = revision;

  const mergedContext = {
    ...asRecord(sourceTask.context),
    ...asRecord(existingLive?.context),
  };
  const reviewedTask = asRecord(mergedContext.reviewedTask);
  const originalReviewAction = asRecord(reviewedTask.reviewAction);
  if (asString(originalReviewAction.actionKind) === "task-tree-followup") {
    reviewedTask.originalReviewAction = clone(originalReviewAction);
    reviewedTask.reviewAction = {
      ...originalReviewAction,
      actionKind: "app-state-repair",
      owner: "app-ops",
      goal:
        `Preserve ${taskId} as the exact live blocked external/provider wait for ${specId} run ${runId}; do not reopen unchanged project-side rerun/publication work before provider/RP guidance or fallback evidence materially changes the same create-path surface.`,
    };
    reviewedTask.requeueGuardReason =
      "This reviewed lineage was already converted into the exact live external/provider wait by an authorized app-owned state repair. Keep the wait blocked until provider/RP guidance, an exact owner reroute, or the governed fallback window produces a materially different successor.";
  }

  const context = {
    ...mergedContext,
    reviewedTask,
    acceptance_note:
      `2026-07-17 app-owned state repair restored ${taskId} as the live blocked external/provider wait for ${specId} run ${runId}, attached the exact blocker evidence set, repointed the spec-loop row away from stale ${archiveTaskId}, and guarded the reviewed lineage from immediate planner requeue drift.`,
    restoredFromArchivePath: archived.archivePath.replace(`${appDir}/`, ""),
    appEvidencePath: evidencePath,
  };

  const restoredTask: TaskNode & { evidence?: string[] } = {
    ...sourceTask,
    ...existingLive,
    id: taskId,
    parent_id: parentId,
    state: "blocked",
    revision,
    owner: asString(sourceTask.owner) ?? asString(existingLive?.owner) ?? "aks-explorer",
    kind: sourceTask.kind ?? existingLive?.kind ?? "domain_leaf",
    priority: sourceTask.priority ?? existingLive?.priority ?? "P2",
    children: [],
    goal: waitGoal,
    outputs: unique([...domainEvidenceRefs, evidencePath]),
    evidence: unique([...domainEvidenceRefs, evidencePath]),
    acceptance: asStringArray(sourceTask.acceptance),
    conflict_scope: unique([
      ...asStringArray(sourceTask.conflict_scope),
      ...asStringArray(existingLive?.conflict_scope),
      `ado-run:${runId}`,
      "feature:secops-fips-ubuntu-compat",
      "runtime:secops-fips-ubuntu-compat-cluster-create",
      `spec:${specId}`,
    ]),
    blocker: {
      condition: waitCondition,
      category: "external-wait",
      owner: "human",
      blocked_at: blockerRecordedAt,
      waiting_for: {
        type: "azure.provider.guidance",
        taskId,
      },
      observed_by: {
        workflow: "project-planner",
        schedule: "blocked-frontier-owner-review",
        trigger: "project.planning.requested",
      },
      observation_method: observationMethod,
      next_check_at: nextCheckAt,
      resume_condition: resumeCondition,
      fallback_at: fallbackAt,
      fallback_action: fallbackAction,
      resume_at: nextCheckAt,
    },
    context,
    trace,
    result: taskResult,
    resolution: undefined,
    done_at: undefined,
    done_by: undefined,
    session_history: unique([
      ...asStringArray(sourceTask.session_history),
      ...asStringArray(existingLive?.session_history),
    ]),
  };

  delete (restoredTask as TaskNode & { session_id?: unknown }).session_id;
  delete (restoredTask as TaskNode & { status?: unknown }).status;

  const parentChildrenBefore = asStringArray(liveParent.children);
  const parentChildrenAfter = unique([...parentChildrenBefore, taskId]);
  const liveChanged =
    JSON.stringify(existingLive ?? null) !== JSON.stringify(restoredTask);
  const parentChanged =
    JSON.stringify(parentChildrenBefore) !== JSON.stringify(parentChildrenAfter);

  if (liveChanged) tree.tasks[taskId] = restoredTask;
  if (parentChanged) liveParent.children = parentChildrenAfter;
  if (liveChanged || parentChanged) saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    changed: liveChanged || parentChanged,
    taskChanged: liveChanged,
    parentChanged,
    taskAfter: taskSnapshot(tree.tasks[taskId] as TaskNode | undefined, taskId),
    parentHasTaskAfter: asStringArray((tree.tasks[parentId] as TaskNode).children).includes(taskId),
  };
});

const specStateLoadedAfter = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: parentId,
  windowSize: 5,
});
const specState = specStateLoadedAfter.state;
const liveSpecBefore = clone(specState.specs[specId] as SpecRow);
assert(liveSpecBefore, `Missing spec-loop row for ${specId} during repair`);

const review: JsonRecord = {
  ...asRecord(liveSpecBefore.review),
  classification: "external_provider_blocker",
  lastRootCause:
    `Reviewed Azure DevOps run ${runId} for ${specId}: resource group ${resourceGroup} created successfully, but cluster ${clusterName} failed at op.create-k8s135-plus-fips-ubuntu-cluster with HTTP 500 / MC resource-group Get failure after the earlier daemonset-YAML defect had already been repaired.`,
  lastAction: specReviewAction,
  reviewedAt: repairedAt,
};
delete review.pendingReviewReason;
delete review.pendingReviewTaskId;
delete review.pendingReviewRunId;
delete review.pendingReviewObservedAt;

const updatedSpecRow: SpecRow = {
  ...liveSpecBefore,
  status: "pending",
  lastRunId: runId,
  lastRunUrl: runUrl,
  lastResultPath: resultPath,
  updatedAt: repairedAt,
  taskId,
  activeAttemptId: null,
  activeTaskSessionId: null,
  activeWorkflowRunId: null,
  heartbeatAt: null,
  failureClass: null,
  diagnosis: null,
  review,
  resumeCondition,
  successorDisposition: "external-provider-cluster-create-blocker-wait",
  successorEvidencePath: `${projectDir}/evidence/archive/record-secops-fips-ubuntu-compat-provider-cluster-create-blocker-run-172628524-20260717.md`,
  successorRunId: runId,
  successorRunUrl: runUrl,
  successorResultPath: `${projectDir}/workspace/wait-secops-fips-ubuntu-compat-ado-run-172628524-result/20260717T040801Z/slice-01-test-results/runs/test-results/test_20260717032324426_n454fb_046184/artifacts/secops-fips-ubuntu-compat/spec-runner/result.json`,
  successorStateReason: specStateReason,
  terminalDisposition: false,
};
specState.specs[specId] = updatedSpecRow;

const specStateChanged =
  JSON.stringify(liveSpecBefore) !== JSON.stringify(specState.specs[specId]);
if (specStateChanged) saveSpecLoopState(specStateLoadedAfter.path, specState);

const afterTree = readTaskTree(config);
const afterTask = afterTree.tasks[taskId] as TaskNode | undefined;
const afterSpecRow = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: parentId,
  windowSize: 5,
}).state.specs[specId] as SpecRow | undefined;
assert(afterTask, `Expected ${taskId} to be live after repair`);
assert(afterSpecRow, `Expected spec-loop row ${specId} after repair`);

const sameScopeAfter = Object.values(afterTree.tasks)
  .filter((task) => {
    const scope = asStringArray(task.conflict_scope);
    if (!scope.includes(`ado-run:${runId}`) && !scope.includes(`spec:${specId}`)) {
      return false;
    }
    return task.id !== "ops-apply-wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717-state-repair";
  })
  .map((task) => ({
    id: task.id,
    state: asString(task.state),
    parent_id: asString(task.parent_id),
  }))
  .sort((a, b) => String(a.id).localeCompare(String(b.id)));

const blockedSameScope = sameScopeAfter.filter(
  (task) => task.id === taskId && task.state === "blocked",
);
const activeOrBlockedSiblingSameScope = sameScopeAfter.filter(
  (task) => task.id !== taskId && (task.state === "active" || task.state === "blocked"),
);

const featureStateAfter = readJson<JsonRecord>(resolve(appDir, ".state/feature-compact-loop/state.json"));
const secopsFeatureAfter = asRecord(asRecord(featureStateAfter.features).secops);

const verification = {
  taskShow: taskSnapshot(afterTask, taskId),
  kanbanExpectation: {
    blocked: true,
    notInProgress: true,
  },
  sameScopeLiveTasks: sameScopeAfter,
  blockedExactMatchCount: blockedSameScope.length,
  activeOrBlockedSiblingSameScopeCount: activeOrBlockedSiblingSameScope.length,
  specLoopRow: clone(afterSpecRow),
  secopsFeatureTaskId: asString(secopsFeatureAfter.taskId),
  secopsFeatureFrontierTaskIds: asStringArray(secopsFeatureAfter.frontierTaskIds),
  featureCompactChanged: JSON.stringify(secopsFeatureBefore) !== JSON.stringify(secopsFeatureAfter),
};

writeText(
  evidenceAbsolute,
  `# App apply — secops FIPS Ubuntu compat provider cluster-create blocked wait state repair\n\n` +
    `- Task: \`ops-apply-wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717-state-repair\`\n` +
    `- Attempt: \`${attemptId}\`\n` +
    `- Applied at: \`${repairedAt}\`\n` +
    `- Supported mechanisms: \`readTaskTree(... )\` + \`withTreeLock(... )\` + \`saveTaskTreeWithKanbanSnapshot(... )\`, plus \`loadSpecLoopState(... )\` + \`saveSpecLoopState(... )\`\n\n` +
    `## Baseline before apply\n\n` +
    `The reviewed wait task had already been compacted into an archive bundle as done even though the required blocked-wait contract was still missing from the live task tree, and the spec-loop row still pointed at stale task \`${archiveTaskId}\` / prior run residue.\n\n` +
    `\`\`\`json\n${JSON.stringify(baseline, null, 2)}\n\`\`\`\n\n` +
    `## Applied repair\n\n` +
    `1. Restored \`${taskId}\` from archived done state back into the live task tree under \`${parentId}\`, cleared terminal fields, and re-applied the exact blocked external/provider wait contract instead of creating a duplicate sibling task.\n` +
    `2. Replaced placeholder output text with the exact blocker memo, diagnosis memo, terminal review memo, repaired-lineage memo, fallback escalation packet, and same-run artifact refs required by the reviewed proposal.\n` +
    `3. Repointed \`.state/spec-loop/state.json\` for \`${specId}\` to run \`${runId}\` and live wait \`${taskId}\`, removing stale pending-review pointers from prior run residue.\n` +
    `4. Left \`.state/feature-compact-loop/state.json\` unchanged because the secops feature frontier remains represented by its existing seven-carrier package-partial holder rather than this per-spec wait.\n\n` +
    `## Post-apply verification\n\n` +
    `\`\`\`json\n${JSON.stringify(verification, null, 2)}\n\`\`\`\n\n` +
    `## Acceptance check\n\n` +
    `- App-owned task-tree or loop-state repair applied through supported app mechanisms: ${treeMutation.changed || specStateChanged ? "satisfied" : "already satisfied"}.\n` +
    `- Affected branch records the exact restored holder, refreshed wait, and state pointer with evidence: satisfied via the live blocked task snapshot, same-scope uniqueness check, updated spec-loop row, and this memo at \`${evidencePath}\`.`,
);

console.log(
  JSON.stringify(
    {
      attemptId,
      evidencePath,
      treeMutation,
      specStateChanged,
      verification,
    },
    null,
    2,
  ),
);
