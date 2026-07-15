import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

const attemptId =
  "a_ops-apply-domain-reconcile-windows-gpu-vm-prerelease-holder-vs-model-202_20260715010806";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const loopTaskId = "aks-spec-verification-loop";
const featureKey = "windows";
const specId = "spec.windows-gpu.vm-prerelease-matrix";
const restoredWaitId =
  "wait-windows-gpu-vm-prerelease-vms-source-parity-or-reframe-20260715";
const previousRepairTaskId =
  "ops/repair-spec-loop-controller-windows-draft-gap-wait-closure-20260715";
const windowsCompactHolderTaskId = "hold-compact-windows-eligibility-frontier-20260707";
const archivedWaitPath = resolve(
  appDir,
  ".state/tasks/archive/done-leaves-20260715010519238.json",
);
const domainMemoPath =
  "../aks-rp-e2e/evidence/archive/domain-reconcile-windows-gpu-vm-prerelease-holder-vs-model-20260715.md";
const appMemoPath =
  "evidence/archive/ops-apply-domain-reconcile-windows-gpu-vm-prerelease-holder-vs-model-20260715.md";
const appMemoAbsolute = resolve(appDir, appMemoPath);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function plusHours(baseIso: string, hours: number): string {
  return new Date(Date.parse(baseIso) + hours * 60 * 60 * 1000).toISOString();
}

type ArchivedBundle = {
  tasks?: Array<Record<string, unknown>>;
};

const archivedBundle = readJson<ArchivedBundle>(archivedWaitPath);
const archivedTask = (archivedBundle.tasks ?? []).find(
  (task) => task.id === restoredWaitId,
);
assert(archivedTask, `Archived wait ${restoredWaitId} not found in ${archivedWaitPath}`);

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const specLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 5,
});
const specState = specLoaded.state;
const specBefore = clone(specState.specs[specId]);
assert(specBefore, `Missing spec-loop row ${specId}`);

const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactLoaded.state;
const windowsBefore = clone(compactState.features[featureKey]);
assert(windowsBefore, `Missing feature-compact state for ${featureKey}`);

const treeBefore = readTaskTree(config);
const loopTaskBefore = treeBefore.tasks[loopTaskId];
const compactHolderBefore = treeBefore.tasks[windowsCompactHolderTaskId];
assert(loopTaskBefore, `Missing loop task ${loopTaskId}`);
assert(compactHolderBefore, `Missing compact holder ${windowsCompactHolderTaskId}`);
const repairTaskBefore = treeBefore.tasks[previousRepairTaskId];
const waitBefore = treeBefore.tasks[restoredWaitId] ?? null;

const blockerCondition =
  "Current mounted GPU prerelease source keeps the Windows GRID and CUDA plans on VirtualMachineScaleSets while the accepted repo-local spec/model still preserve Windows GPU VirtualMachines as a draft-gap carrier. Keep this exact wait until same-surface mounted VirtualMachines parity exists or an owner-approved repo-local reframe/retirement replaces the boundary.";
const resumeCondition =
  "Resume only when reviewed same-surface evidence shows an exact current mounted Windows GPU VirtualMachines carrier for spec.windows-gpu.vm-prerelease-matrix, or when an owner-approved repo-local reframe/retirement replaces this draft-gap boundary. Do not rerun the unchanged carrier or merge it into generic Windows or GPU family waits.";
const fallbackAction =
  "If the same draft-gap wait still holds at fallback, refresh this exact wait from current mounted-source and model/spec evidence or replace it only with one accepted sharper successor; do not broaden the Windows compact holder or reopen an unchanged live rerun.";
const waitGoal =
  "Hold the exact draft-gap frontier for spec.windows-gpu.vm-prerelease-matrix until current mounted source restores an exact Windows GPU VirtualMachines carrier or an owner-approved repo-local reframe/retirement changes the truthful next action.";

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[loopTaskId];
  if (!loopTask) throw new Error(`Missing loop task ${loopTaskId} during apply`);

  const existing = tree.tasks[restoredWaitId] as TaskNode | undefined;
  const blocker = asRecord(existing?.blocker);
  const blockedAt =
    typeof blocker.blocked_at === "string" && blocker.blocked_at.trim()
      ? blocker.blocked_at
      : appliedAt;

  const restoredTask: TaskNode = {
    ...(existing ? clone(existing) : {}),
    id: restoredWaitId,
    parent_id: loopTaskId,
    state: "blocked",
    status: "blocked",
    kind: "domain_leaf",
    priority: "P2",
    owner: "human",
    children: [],
    goal: waitGoal,
    inputs: [
      domainMemoPath,
      "model/knowledge-map/views/path-summary.json",
      "features/windows/specs/windows-gpu-vm-prerelease-matrix.json",
      "/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json",
      "/app/projects/aks-rp-e2e.app/.state/tasks/tree.json",
    ],
    outputs: unique([appMemoPath]),
    acceptance: [
      "The leaf records spec.windows-gpu.vm-prerelease-matrix / path.windows-gpu.vm-prerelease-matrix as a repo-local Windows GPU VirtualMachines draft-gap marker, not a current source-grounded live verdict.",
      "The leaf cites the exact mounted-source evidence that current windows_gpu_grid.go and windows_gpu_cuda.go provision VirtualMachineScaleSets, so the old Windows GPU VirtualMachines parity claim is no longer exact.",
      "The leaf explicitly states this path is excluded from hold-compact-windows-eligibility-frontier-20260707, wait-windows-nonlive-carriers-authoring-or-source-change-20260702, and wait-spec-gpu-classic-westus2-sku-support-family-return-20260704.",
      "The leaf forbids blind unchanged live reruns and resumes only on exact mounted-source parity or explicit owner-approved reframe.",
    ],
    forbidden: [],
    conflict_scope: ["feature:windows", `spec:${specId}`],
    depends_on: [],
    blocker: {
      ...blocker,
      condition: blockerCondition,
      category: "external-wait",
      owner: "human",
      blocked_at: blockedAt,
      waiting_for: {
        type: "frontier.changed",
        taskId: restoredWaitId,
        specId,
      },
      observed_by: {
        workflow: "project-planner",
        schedule: "blocked-frontier-owner-review",
        trigger: "project.planning.requested",
      },
      observation_method:
        "Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
      next_check_at: plusHours(appliedAt, 24),
      resume_condition: resumeCondition,
      fallback_at: plusHours(appliedAt, 48),
      fallback_action: fallbackAction,
    },
    trace: {
      ...(existing?.trace && typeof existing.trace === "object" && !Array.isArray(existing.trace)
        ? clone(existing.trace)
        : {}),
      created_at:
        typeof existing?.trace?.created_at === "string"
          ? existing.trace.created_at
          : appliedAt,
      created_by:
        typeof existing?.trace?.created_by === "string"
          ? existing.trace.created_by
          : "app-ops-apply-script",
      restored_from_archived_wait_id: restoredWaitId,
      restored_from_archive_path: ".state/tasks/archive/done-leaves-20260715010519238.json",
      restored_after_stale_wait_close_at: appliedAt,
      restored_after_stale_wait_close_by: "app-ops-apply-script",
      restored_after_stale_wait_close_attempt_id: attemptId,
    },
    result:
      `${attemptId}: restored exact Windows GPU VirtualMachines draft-gap wait ${restoredWaitId} after stale auto-closure so the branch stays represented until exact mounted-source parity or owner-approved reframe.`,
    context: {
      ...(existing?.context && typeof existing.context === "object" && !Array.isArray(existing.context)
        ? clone(existing.context)
        : {}),
      exactDraftGapWait: true,
      specId,
      featureKey,
      domainEvidencePath: domainMemoPath,
      appEvidencePath: appMemoPath,
      previousRepairTaskId,
      excludedHolderTaskIds: [
        windowsCompactHolderTaskId,
        "wait-windows-nonlive-carriers-authoring-or-source-change-20260702",
        "wait-spec-gpu-classic-westus2-sku-support-family-return-20260704",
      ],
    },
    resolution: undefined,
    done_at: undefined,
    done_by: undefined,
  };

  tree.tasks[restoredWaitId] = restoredTask;
  loopTask.children = [...new Set([...(loopTask.children ?? []), restoredWaitId])];
  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    waitExistedBefore: Boolean(existing),
    loopChildren: asStringArray(loopTask.children),
    restoredTask: clone(restoredTask),
  };
});

updateSpecLoopSpec(specState, specId, {
  status: "pending",
  taskId: restoredWaitId,
  catalogStatus: "draft",
  catalogSpecState: "reviewed-exception",
  terminalDisposition: true,
  successorDisposition: "windows_gpu_virtualmachines_draft_gap_wait_restored",
  successorEvidencePath: appMemoAbsolute,
  successorStateReason:
    "Restored the exact Windows GPU VirtualMachines draft-gap wait after the earlier blocked leaf auto-closed as stale. The historical same-spec live pass remains preserved as background evidence only; current accepted model/spec authority still treats this path as a repo-local draft-gap boundary until exact mounted-source VirtualMachines parity or owner-approved reframe exists.",
  resumeCondition,
  review: {
    classification: "draft_gap_wait_restored_after_stale_auto_close",
    lastRootCause:
      "The dedicated Windows GPU blocked wait was archived because controller-visible state still looked pass-shaped, but current accepted domain/model authority keeps this path on a reviewed-exception draft-gap boundary rather than an exact mounted-source live verdict.",
    lastAction:
      `Restored exact blocked wait ${restoredWaitId} and repointed spec-loop state to it. Keep pending until exact mounted-source VirtualMachines parity or owner-approved reframe/retirement changes the boundary.`,
    reviewedAt: appliedAt,
  },
});
const specMirrorPath = resolve(projectDir, ".state/spec-loop/state.json");
saveSpecLoopState(
  specLoaded.path,
  specState,
  existsSync(specMirrorPath) ? [specMirrorPath] : [],
);

const windowsFrontierTaskIds = unique([
  ...asStringArray(windowsBefore.frontierTaskIds),
  restoredWaitId,
]);
const windowsResumeCondition =
  "Resume only when accepted same-surface evidence materially changes or reclassifies one of these exact represented blockers: the westus2 managed-cluster capacity family for spec.windows-calico.vm-prerelease-containerd, the GitHub auth preflight 401 family for spec.windows.mixed-os-combination-virtualmachines or spec.windows.node-pool-create-virtualmachines-gen2, the pipeline-only residual for spec.windows.runner-pipeline-harness-virtualmachines, or the dedicated Windows GPU VirtualMachines draft-gap wait wait-windows-gpu-vm-prerelease-vms-source-parity-or-reframe-20260715.";
const windowsBlockedReason =
  "2026-07-15 app-ops repair restored the dedicated Windows GPU VirtualMachines draft-gap wait wait-windows-gpu-vm-prerelease-vms-source-parity-or-reframe-20260715 and kept controller-visible windows compact state on hold-compact-windows-eligibility-frontier-20260707. The current compact holder still governs the same four wait-governed members, while the separate Windows GPU draft-gap branch is now again represented by its own exact wait rather than a stale archived closure. Do not queue an unchanged broad Windows compact rerun.";
const windowsSummary =
  `${attemptId}: restored the dedicated Windows GPU draft-gap wait ${restoredWaitId}, kept windows compact state bound to ${windowsCompactHolderTaskId}, and refreshed the controller-visible windows frontier to include that exact downstream wait alongside the existing compact blockers.`;
updateFeatureCompactItem(compactState, featureKey, {
  status: windowsBefore.status,
  taskId: windowsCompactHolderTaskId,
  frontierTaskIds: windowsFrontierTaskIds,
  retryReason: windowsResumeCondition,
  resumeCondition: windowsResumeCondition,
  blockedReason: windowsBlockedReason,
  waitingCondition:
    "Resume only when one exact represented blocker materially changes, including the restored Windows GPU draft-gap wait, or a new current-head review reclassifies one of the four wait-governed windows compact frontier members.",
  evidencePaths: unique([...(windowsBefore.evidencePaths ?? []), appMemoPath]),
  reviewEvidencePath: appMemoPath,
  verificationBlocker: windowsResumeCondition,
  lastSummary:
    "Windows compact remains package-partial on the same four wait-governed members plus a separately represented Windows GPU draft-gap boundary; no unchanged broad rerun is truthful. See evidence/archive/ops-apply-domain-reconcile-windows-gpu-vm-prerelease-holder-vs-model-20260715.md.",
  summary: windowsSummary,
});
const compactMirrorPath = resolve(projectDir, ".state/feature-compact-loop/state.json");
saveFeatureCompactLoopState(
  compactLoaded.path,
  compactState,
  existsSync(compactMirrorPath) ? [compactMirrorPath] : [],
);

const treeAfter = readTaskTree(config);
const waitAfter = treeAfter.tasks[restoredWaitId];
const specAfter = specState.specs[specId];
const windowsAfter = compactState.features[featureKey];
assert(waitAfter, `Missing restored wait ${restoredWaitId} after apply`);
assert(specAfter?.taskId === restoredWaitId, `Expected ${specId}.taskId=${restoredWaitId}`);
assert(specAfter?.status === "pending", `Expected ${specId}.status=pending`);
assert(
  asStringArray(waitAfter.conflict_scope).includes(`spec:${specId}`),
  `Restored wait ${restoredWaitId} missing spec conflict scope`,
);
assert(
  asStringArray(windowsAfter?.frontierTaskIds).includes(restoredWaitId),
  `Windows compact state missing frontierTaskId ${restoredWaitId}`,
);

const memo = `# App-ops apply — Windows GPU draft-gap wait restore — 2026-07-15

Attempt: ${attemptId}

## Summary

Restored the exact blocked wait \`${restoredWaitId}\` in the live task tree, repointed \`${specId}\` in app-owned \`spec-loop\` state to that live wait, and refreshed app-owned windows compact state so the separate Windows GPU draft-gap boundary is once again visible as a current downstream wait instead of a stale archived closure.

## Baseline before repair

- Archived wait bundle: \`.state/tasks/archive/done-leaves-20260715010519238.json\`
- Archived wait status: \`${String(archivedTask.state)}\`
- Archived wait done_by: \`${String(archivedTask.done_by)}\`
- Archived wait result: \`${String(archivedTask.result)}\`
- Live task-tree before repair: \`bun run task-tree show ${restoredWaitId}\` returned not found.
- Spec-loop before repair:
  - \`status = ${specBefore.status}\`
  - \`taskId = ${specBefore.taskId ?? "null"}\`
  - \`catalogStatus = ${specBefore.catalogStatus ?? "null"}\`
  - \`catalogSpecState = ${specBefore.catalogSpecState ?? "null"}\`
  - \`terminalDisposition = ${String(specBefore.terminalDisposition ?? null)}\`
- Windows compact before repair:
  - \`taskId = ${windowsBefore.taskId ?? "null"}\`
  - \`frontierTaskIds = ${JSON.stringify(windowsBefore.frontierTaskIds ?? [])}\`

## Repair applied

### Live task-tree restore

- Restored live blocked wait id: \`${restoredWaitId}\`
- Parent: \`${waitAfter.parent_id}\`
- State/status: \`${waitAfter.state}\` / \`${waitAfter.status}\`
- Owner: \`${waitAfter.owner}\`
- Conflict scope: \`${JSON.stringify(waitAfter.conflict_scope ?? [])}\`
- Wait existed before this apply pass: \`${String(treeMutation.waitExistedBefore)}\`

### Spec-loop state normalization

Updated \`${specId}\` in \`.state/spec-loop/state.json\` from the stale repair-task pointer to the restored wait and removed the pass-shaped contradiction:

- before: \`status=${specBefore.status}\`, \`taskId=${specBefore.taskId ?? "null"}\`
- after: \`status=${specAfter.status}\`, \`taskId=${specAfter.taskId ?? "null"}\`
- after review classification: \`${String(asRecord(specAfter.review).classification ?? "null")}\`

### Feature-compact state refresh

Kept windows compact bound to \`${windowsCompactHolderTaskId}\`, but refreshed the downstream frontier list so the separate Windows GPU draft-gap wait is represented in app-owned compact state:

- before frontierTaskIds: \`${JSON.stringify(windowsBefore.frontierTaskIds ?? [])}\`
- after frontierTaskIds: \`${JSON.stringify(windowsAfter?.frontierTaskIds ?? [])}\`
- review evidence path: \`${windowsAfter?.reviewEvidencePath ?? "null"}\`

## Why restore rather than accept superseding closure

Current accepted domain/model authority still keeps \`${specId}\` / \`path.windows-gpu.vm-prerelease-matrix\` as a draft/reviewed-exception Windows GPU VirtualMachines boundary because mounted source is only VMSS-adjacent. The archived wait was therefore not truthfully superseded; it was a stale auto-closure caused by controller-visible mismatch, so the exact blocked successor needed to be restored.

## Verification

Use this supported read after this apply pass:

    cd /app/projects/aks-rp-e2e.app && bun run task-tree show ${restoredWaitId}

Expected live facts now present:

- \`parent_id = ${loopTaskId}\`
- \`state = blocked\`
- \`owner = human\`
- \`conflict_scope\` contains both \`feature:windows\` and \`spec:${specId}\`

And in app-owned loop state:

- \`.state/spec-loop/state.json\` now has \`${specId}.status = pending\`
- \`.state/spec-loop/state.json\` now has \`${specId}.taskId = ${restoredWaitId}\`
- \`.state/feature-compact-loop/state.json\` now includes \`${restoredWaitId}\` in \`features.windows.frontierTaskIds\`

## Reviewer follow-up

This task restored the holder/state representation itself. The separate active repair task \`${previousRepairTaskId}\` now has a concrete repaired successor to review against; planner/reviewer can judge whether that older repair task should be accepted/closed from this evidence rather than leaving the branch on the stale repair-task pointer.
`;

writeText(appMemoAbsolute, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      memoPath: appMemoPath,
      restoredWaitId,
      waitState: waitAfter.state,
      waitOwner: waitAfter.owner,
      specId,
      specStatus: specAfter.status,
      specTaskId: specAfter.taskId,
      windowsTaskId: windowsAfter?.taskId ?? null,
      windowsFrontierTaskIds: windowsAfter?.frontierTaskIds ?? null,
      previousRepairTaskPresent: Boolean(repairTaskBefore),
      previousRepairTaskId,
    },
    null,
    2,
  ),
);
