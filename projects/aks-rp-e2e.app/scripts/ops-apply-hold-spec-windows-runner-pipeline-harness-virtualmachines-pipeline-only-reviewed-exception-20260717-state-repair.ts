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
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";

type JsonRecord = Record<string, unknown>;

type ArchivedBundle = {
  tasks?: Array<JsonRecord>;
};

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717-state-repa_20260717012522";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const holderTaskId =
  "hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717";
const holderParentId = "aks-spec-verification-loop";
const compactResidualTaskId =
  "hold-compact-windows-eligibility-residual-frontier-20260717";
const specId = "spec.windows.runner-pipeline-harness-virtualmachines";
const staleTaskId = "wait-windows-nonlive-carriers-authoring-or-source-change-20260702";
const evidencePath =
  "evidence/archive/ops-apply-hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717-state-repair.md";
const evidenceAbsolute = resolve(appDir, evidencePath);
const nextCheckAt = "2026-07-17T18:30:00.000Z";
const fallbackAt = "2026-07-18T00:30:00.000Z";

const holderCondition =
  "Mounted and checked-in evidence still preserves spec.windows.runner-pipeline-harness-virtualmachines as an intentionally nonlive reviewed-exception carrier: Scenario_Windows_Runner_vms remains only a VirtualMachines + use_shared_identity=true matrix carrier, mounted windows_info.go still marks it as No meaningful validation, mounted runner source still exposes only generic create/upgrade/scale harness behavior, the checked-in probe check still passes only by preserving terminalClassification=pipeline_only with metadata.noExecutionCoverageClaim=true, and unchanged standalone dispatch still fails live admission as source-check-only.";
const holderResumeCondition =
  "Resume only when authoritative mounted source or exact checked-in carrier authoring materially changes this boundary: the No meaningful validation ignore rule is removed or changed, distinct Scenario_Windows_Runner_vms Windows-product assertions appear, metadata.noExecutionCoverageClaim is removed, terminalClassification stops being pipeline_only, or the carrier otherwise becomes truthfully live-admissible. Do not rerun unchanged before one of those signals exists.";
const holderFallbackAction =
  "If the boundary is still unchanged at fallback, keep or refresh this exact reviewed-exception holder from the latest same-lineage evidence and do not reopen an unchanged live rerun.";
const holderGoal =
  "Create the exact current blocked holder that preserves spec.windows.runner-pipeline-harness-virtualmachines as a source-check-only / pipeline-only reviewed-exception boundary, replacing archived wait-windows-nonlive-carriers-authoring-or-source-change-20260702 as the runner-harness residual lineage and keeping unchanged live reruns blocked until mounted source or exact carrier authoring materially changes.";
const compactAcceptance =
  "The holder cites only current truthful downstream lineage: wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704 for the repaired Windows auth-capable rerun members, ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized for the separate create-surface owner-return lineage, and blocked reviewed-exception holder hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717 for the runner-harness residual while that exact source-check-only / pipeline-only boundary remains true.";
const compactCondition =
  "2026-07-17 metric-recovery follow-up revalidated that the residual Windows compact holder should name only current live residual lineage. Keep this holder blocked only while wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704 preserves the mixed-os Windows auth-capable rerun family, ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized preserves the create-surface owner-arbitration family, and blocked reviewed-exception holder hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717 preserves the runner-harness source-check-only boundary. Do not widen back into a broad Windows rerun or cite archived/nonexistent successor ids as live blockers.";
const compactResumeCondition =
  "Resume only when wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704, ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized, or hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717 materially changes the exact residual Windows member set or yields a runnable next step.";
const specSuccessorStateReason =
  "The row-190 runner harness remains a source-check-only pipeline-only exclusion and is intentionally nonlive. The exact current open holder is hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717, and current single-spec live admission still rejects unchanged dispatch for this reason.";
const specResumeCondition =
  "Resume only when hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717 receives a material mounted-source or exact carrier-authoring change that makes spec.windows.runner-pipeline-harness-virtualmachines truthfully live-verifiable. Do not redispatch unchanged while metadata.noExecutionCoverageClaim=true and the carrier explicitly blocks --execute.";
const specLastAction =
  "Keep pending under hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717. Do not rerun unchanged unless mounted source or exact carrier authoring materially changes this row from pipeline-only/nonlive.";

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
  ];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function deleteKey(record: JsonRecord, key: string): void {
  delete record[key];
}

function findArchivedTask(taskId: string): { archivePath: string; task: TaskNode } {
  const archiveDir = resolve(appDir, ".state/tasks/archive");
  const files = readdirSync(archiveDir)
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a));

  for (const file of files) {
    const archivePath = resolve(archiveDir, file);
    const bundle = readJson<ArchivedBundle>(archivePath);
    const task = (bundle.tasks ?? []).find((entry) => entry.id === taskId);
    if (task) {
      return {
        archivePath,
        task: clone(task as TaskNode),
      };
    }
  }

  throw new Error(`Archived task ${taskId} not found under ${archiveDir}`);
}

function taskSnapshot(task: TaskNode | undefined, taskId = "(missing)") {
  if (!task) {
    return {
      id: taskId,
      present: false,
    };
  }
  return {
    id: task.id,
    present: true,
    revision: task.revision ?? null,
    parent_id: asString(task.parent_id),
    state: asString(task.state),
    goal: asString(task.goal),
    acceptance: asStringArray(task.acceptance),
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

const archived = findArchivedTask(holderTaskId);
const beforeTree = readTaskTree(config);
const beforeHolder = beforeTree.tasks[holderTaskId] as TaskNode | undefined;
const beforeParent = beforeTree.tasks[holderParentId] as TaskNode | undefined;
const beforeCompact = beforeTree.tasks[compactResidualTaskId] as TaskNode | undefined;
assert(beforeParent, `Missing live parent ${holderParentId}`);
assert(beforeCompact, `Missing live compact residual task ${compactResidualTaskId}`);

const specStateBefore = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: holderParentId,
  windowSize: 5,
}).state.specs[specId];
assert(specStateBefore, `Missing spec-loop row for ${specId}`);

const baseline = {
  archivePath: archived.archivePath.replace(`${appDir}/`, ""),
  archivedHolder: taskSnapshot(archived.task, holderTaskId),
  liveHolder: taskSnapshot(beforeHolder, holderTaskId),
  parentHasHolder: asStringArray(beforeParent.children).includes(holderTaskId),
  specRow: clone(specStateBefore),
  compactAcceptance: asStringArray(beforeCompact.acceptance),
  compactBlocker: clone(beforeCompact.blocker ?? null),
};

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const liveParent = tree.tasks[holderParentId] as TaskNode | undefined;
  const compactTask = tree.tasks[compactResidualTaskId] as TaskNode | undefined;
  if (!liveParent) throw new Error(`Missing live parent ${holderParentId}`);
  if (!compactTask) {
    throw new Error(`Missing live compact residual task ${compactResidualTaskId}`);
  }

  const archivedTask = clone(archived.task);
  const trace = asRecord(archivedTask.trace);
  const context = asRecord(archivedTask.context);

  deleteKey(trace, "assigned_at");
  deleteKey(trace, "assigned_by");
  deleteKey(trace, "assigned_worker");
  deleteKey(trace, "current_attempt_id");
  deleteKey(trace, "worker_started_attempt_id");
  deleteKey(trace, "worker_started_at");
  deleteKey(trace, "last_session");
  deleteKey(trace, "workflowResult");
  deleteKey(trace, "late_worker_completions");
  deleteKey(trace, "late_worker_completion_recorded_at");
  deleteKey(trace, "late_worker_completion_attempt_id");
  deleteKey(trace, "last_worker_result");
  deleteKey(trace, "last_worker_claim");
  deleteKey(trace, "last_worker_summary");
  deleteKey(trace, "last_worker_completed_at");
  deleteKey(trace, "last_worker_task_revision");
  deleteKey(trace, "last_worker_evidence");
  trace.restored_from_archive_path = archived.archivePath.replace(`${appDir}/`, "");
  trace.blocked_wait_restored_at = appliedAt;
  trace.blocked_wait_restored_by = worker;
  trace.blocked_wait_restore_attempt_id = attemptId;
  trace.blocked_wait_restore_summary =
    `Restored ${holderTaskId} from archived done state to the live blocked reviewed-exception holder and repointed the spec-loop/compact lineage back to this exact task.`;
  trace.previous_nonterminal_status = "blocked";
  trace.current_task_revision = Number.isInteger(archivedTask.revision)
    ? Number(archivedTask.revision) + 1
    : 1;

  context.acceptance_note =
    `2026-07-17 app-owned state repair restored ${holderTaskId} as the live blocked reviewed-exception holder, repointed spec-loop lineage from ${staleTaskId}, and kept unchanged reruns blocked pending material mounted-source or exact carrier-authoring change.`;
  context.restoredFromArchivePath = archived.archivePath.replace(`${appDir}/`, "");
  context.appEvidencePath = evidencePath;

  const desiredHolder: TaskNode = {
    ...archivedTask,
    id: holderTaskId,
    parent_id: holderParentId,
    state: "blocked",
    revision: Number.isInteger(archivedTask.revision)
      ? Number(archivedTask.revision) + 1
      : 1,
    goal: holderGoal,
    inputs: asStringArray(archivedTask.inputs),
    outputs: unique([...asStringArray(archivedTask.outputs)]),
    acceptance: asStringArray(archivedTask.acceptance),
    conflict_scope: unique([...asStringArray(archivedTask.conflict_scope)]),
    blocker: {
      condition: holderCondition,
      category: "blocked-wait",
      owner: "aks-explorer",
      blocked_at: appliedAt,
      waiting_for: {
        type: "blocker.resolved",
        taskId: holderTaskId,
      },
      observed_by: {
        workflow: "project-planner",
        schedule: "blocked-frontier-app-ops-review",
        trigger: "project.owner.requested",
      },
      observation_method:
        "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
      next_check_at: nextCheckAt,
      resume_condition: holderResumeCondition,
      fallback_at: fallbackAt,
      fallback_action: holderFallbackAction,
      resume_at: nextCheckAt,
    },
    context,
    trace,
    result:
      `${attemptId}: restored ${holderTaskId} as the live blocked reviewed-exception holder and repointed the controller-visible spec lineage away from archived ${staleTaskId}; unchanged reruns remain intentionally blocked pending material mounted-source or exact carrier-authoring change.`,
    resolution: undefined,
    done_at: undefined,
    done_by: undefined,
    session_history: asStringArray(archivedTask.session_history),
    children: [],
  };
  delete (desiredHolder as TaskNode & { session_id?: unknown }).session_id;
  delete (desiredHolder as TaskNode & { evidence?: unknown }).evidence;
  delete (desiredHolder as TaskNode & { status?: unknown }).status;

  const desiredCompact = clone(compactTask);
  const compactAcceptanceList = asStringArray(desiredCompact.acceptance);
  compactAcceptanceList[2] = compactAcceptance;
  desiredCompact.acceptance = compactAcceptanceList;
  desiredCompact.blocker = {
    ...asRecord(desiredCompact.blocker),
    condition: compactCondition,
    resume_condition: compactResumeCondition,
  } as TaskNode["blocker"];
  const compactTrace = asRecord(desiredCompact.trace);
  compactTrace.runner_harness_lineage_repaired_at = appliedAt;
  compactTrace.runner_harness_lineage_repaired_by = worker;
  compactTrace.runner_harness_lineage_repair_attempt_id = attemptId;
  compactTrace.runner_harness_lineage_repair_evidence_path = evidencePath;
  desiredCompact.trace = compactTrace;

  const holderBeforeLive = tree.tasks[holderTaskId] as TaskNode | undefined;
  const compactBeforeLive = tree.tasks[compactResidualTaskId] as TaskNode;
  const parentChildrenBefore = asStringArray(liveParent.children);
  const parentChildrenAfter = unique([...parentChildrenBefore, holderTaskId]);

  const holderChanged = JSON.stringify(holderBeforeLive ?? null) !== JSON.stringify(desiredHolder);
  const compactChanged = JSON.stringify(compactBeforeLive) !== JSON.stringify(desiredCompact);
  const parentChanged = JSON.stringify(parentChildrenBefore) !== JSON.stringify(parentChildrenAfter);

  if (holderChanged) tree.tasks[holderTaskId] = desiredHolder;
  if (compactChanged) tree.tasks[compactResidualTaskId] = desiredCompact;
  if (parentChanged) liveParent.children = parentChildrenAfter;

  if (holderChanged || compactChanged || parentChanged) {
    saveTaskTreeWithKanbanSnapshot(config, tree);
  }

  return {
    changed: holderChanged || compactChanged || parentChanged,
    holderChanged,
    compactChanged,
    parentChanged,
    holderAfter: taskSnapshot(tree.tasks[holderTaskId] as TaskNode | undefined, holderTaskId),
    compactAfter: taskSnapshot(tree.tasks[compactResidualTaskId] as TaskNode | undefined, compactResidualTaskId),
    parentHasHolderAfter: asStringArray((tree.tasks[holderParentId] as TaskNode).children).includes(holderTaskId),
  };
});

const specStateLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: holderParentId,
  windowSize: 5,
});
const specState = specStateLoaded.state;
const liveSpecBefore = clone(specState.specs[specId]);
assert(liveSpecBefore, `Missing spec-loop row for ${specId} during apply`);

updateSpecLoopSpec(specState, specId, {
  taskId: holderTaskId,
  successorStateReason: specSuccessorStateReason,
  resumeCondition: specResumeCondition,
  review: {
    ...asRecord(liveSpecBefore.review),
    classification: asString(asRecord(liveSpecBefore.review).classification) ?? "pipeline_only_nonlive",
    lastAction: specLastAction,
  },
});

const specStateChanged =
  JSON.stringify(liveSpecBefore) !== JSON.stringify(specState.specs[specId]);
if (specStateChanged) {
  saveSpecLoopState(specStateLoaded.path, specState);
}

const afterTree = readTaskTree(config);
const afterHolder = afterTree.tasks[holderTaskId] as TaskNode | undefined;
const afterCompact = afterTree.tasks[compactResidualTaskId] as TaskNode | undefined;
const afterSpecRow = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: holderParentId,
  windowSize: 5,
}).state.specs[specId];
assert(afterHolder, `Expected ${holderTaskId} to exist after repair`);
assert(afterCompact, `Expected ${compactResidualTaskId} to exist after repair`);
assert(afterSpecRow, `Expected spec-loop row ${specId} after repair`);

const verification = {
  holderShow: taskSnapshot(afterHolder, holderTaskId),
  compactShow: taskSnapshot(afterCompact, compactResidualTaskId),
  specRow: clone(afterSpecRow),
  archivedWaitLivePresent: Boolean(afterTree.tasks[staleTaskId]),
  sameScopeLiveTasks: Object.values(afterTree.tasks)
    .filter((task) =>
      asStringArray(task.conflict_scope).includes(`spec:${specId}`),
    )
    .map((task) => ({
      id: task.id,
      state: asString(task.state),
      parent_id: asString(task.parent_id),
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id))),
};

writeText(
  evidenceAbsolute,
  `# App apply — windows runner pipeline-only reviewed-exception holder state repair\n\n` +
    `- Task: \`ops-apply-hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717-state-repa\`\n` +
    `- Attempt: \`${attemptId}\`\n` +
    `- Applied at: \`${appliedAt}\`\n` +
    `- Supported mechanisms: \`readTaskTree(... )\` + \`withTreeLock(... )\` + \`saveTaskTreeWithKanbanSnapshot(... )\`, plus \`loadSpecLoopState(... )\` + \`updateSpecLoopSpec(... )\` + \`saveSpecLoopState(... )\`\n\n` +
    `## Baseline before apply\n\n` +
    `\`bun run task-tree show ${holderTaskId}\` returned not found because planner compaction had already archived the reviewed holder after the follow-up task was opened.\n\n` +
    `\`\`\`json\n${JSON.stringify(baseline, null, 2)}\n\`\`\`\n\n` +
    `## Applied repair\n\n` +
    `1. Restored \`${holderTaskId}\` from archived done state to the live blocked reviewed-exception holder under \`${holderParentId}\` instead of creating a duplicate task id.\n` +
    `2. Repaired \`${specId}\` in \`.state/spec-loop/state.json\` so \`taskId\`, \`successorStateReason\`, \`resumeCondition\`, and \`review.lastAction\` now point at the restored holder instead of archived \`${staleTaskId}\`.\n` +
    `3. Refreshed \`${compactResidualTaskId}\` acceptance plus blocker text so the runner-harness residual now cites the restored blocked holder directly rather than a review-leaf/temporary lineage.\n` +
    `4. Did not restore archived \`${staleTaskId}\` as a live task and did not queue an unchanged rerun.\n\n` +
    `## Post-apply verification\n\n` +
    `\`\`\`json\n${JSON.stringify(verification, null, 2)}\n\`\`\`\n\n` +
    `## Acceptance check\n\n` +
    `- App-owned task-tree or loop-state repair applied through supported app mechanisms: ${treeMutation.changed || specStateChanged ? "satisfied" : "already satisfied"}.\n` +
    `- Affected branch records the exact restored holder/state pointer or refreshed wait with evidence: satisfied via the live holder snapshot, the updated spec-loop row, and this memo at \`${evidencePath}\`.`,
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
