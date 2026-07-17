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
type ArchivedBundle = { tasks?: Array<JsonRecord> };

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717-state-repa_20260717014104";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const repairedAt = new Date().toISOString();

const holderTaskId =
  "hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717";
const holderParentId = "aks-spec-verification-loop";
const compactResidualTaskId =
  "hold-compact-windows-mixed-os-auth-preflight-residual-20260717";
const specId = "spec.windows.runner-pipeline-harness-virtualmachines";
const staleTaskId = "wait-windows-nonlive-carriers-authoring-or-source-change-20260702";
const evidencePath =
  "evidence/archive/ops-apply-hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717-state-repair.md";
const evidenceAbsolute = resolve(appDir, evidencePath);
const nextCheckAt = "2026-07-17T18:30:00.000Z";
const fallbackAt = "2026-07-18T00:30:00.000Z";

const holderGoal =
  "Create the exact current blocked holder that preserves spec.windows.runner-pipeline-harness-virtualmachines as a source-check-only / pipeline-only reviewed-exception boundary, replacing archived wait-windows-nonlive-carriers-authoring-or-source-change-20260702 as the runner-harness residual lineage and keeping unchanged live reruns blocked until mounted source or exact carrier authoring materially changes.";
const holderCondition =
  "Mounted and checked-in evidence still preserves spec.windows.runner-pipeline-harness-virtualmachines as an intentionally nonlive reviewed-exception carrier: Scenario_Windows_Runner_vms remains only a VirtualMachines + use_shared_identity=true matrix carrier, mounted windows_info.go still marks it as No meaningful validation, mounted runner source still exposes only generic create/upgrade/scale harness behavior, the checked-in probe check still passes only by preserving terminalClassification=pipeline_only with metadata.noExecutionCoverageClaim=true, and unchanged standalone dispatch still fails live admission as source-check-only.";
const holderResumeCondition =
  "Resume only when authoritative mounted source or exact checked-in carrier authoring materially changes this boundary: the No meaningful validation ignore rule is removed or changed, distinct Scenario_Windows_Runner_vms Windows-product assertions appear, metadata.noExecutionCoverageClaim is removed, terminalClassification stops being pipeline_only, or the carrier otherwise becomes truthfully live-admissible. Do not rerun unchanged before one of those signals exists.";
const holderFallbackAction =
  "If the boundary is still unchanged at fallback, keep or refresh this exact reviewed-exception holder from the latest same-lineage evidence and do not reopen an unchanged live rerun.";
const specSuccessorStateReason =
  "The row-190 runner harness remains a source-check-only pipeline-only exclusion and is intentionally nonlive. The exact current open holder is hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717, and current single-spec live admission still rejects unchanged dispatch for this reason.";
const specResumeCondition =
  "Resume only when hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717 receives a material mounted-source or exact carrier-authoring change that makes spec.windows.runner-pipeline-harness-virtualmachines truthfully live-verifiable. Do not redispatch unchanged while metadata.noExecutionCoverageClaim=true and the carrier explicitly blocks --execute.";
const specLastAction =
  "Keep pending under hold-spec-windows-runner-pipeline-harness-virtualmachines-pipeline-only-reviewed-exception-20260717. Do not rerun unchanged unless mounted source or exact carrier authoring materially changes this row from pipeline-only/nonlive.";

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
  ];
}

function deleteKeys(record: JsonRecord, keys: string[]): void {
  for (const key of keys) delete record[key];
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
  if (!task) return { id: taskId, present: false };
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
assert(beforeCompact, `Missing live compact residual ${compactResidualTaskId}`);

const specStateLoadedBefore = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: holderParentId,
  windowSize: 5,
});
const specRowBefore = specStateLoadedBefore.state.specs[specId];
assert(specRowBefore, `Missing spec-loop row for ${specId}`);

const compactMentionsHolderBefore = JSON.stringify(beforeCompact).includes(holderTaskId);

const baseline = {
  archivePath: archived.archivePath.replace(`${appDir}/`, ""),
  archivedHolder: taskSnapshot(archived.task, holderTaskId),
  liveHolder: taskSnapshot(beforeHolder, holderTaskId),
  parentHasHolder: asStringArray(beforeParent.children).includes(holderTaskId),
  compactResidualTaskId,
  compactResidualMentionsHolder: compactMentionsHolderBefore,
  specRow: clone(specRowBefore),
};

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const liveParent = tree.tasks[holderParentId] as TaskNode | undefined;
  const compactResidual = tree.tasks[compactResidualTaskId] as TaskNode | undefined;
  assert(liveParent, `Missing live parent ${holderParentId}`);
  assert(compactResidual, `Missing live compact residual ${compactResidualTaskId}`);

  const sourceTask = clone(archived.task);
  const existingLive = tree.tasks[holderTaskId] as TaskNode | undefined;
  const priorState = asString(existingLive?.state) ?? "archived-done";
  const revisionBase = Math.max(
    Number.isInteger(sourceTask.revision) ? Number(sourceTask.revision) : 0,
    Number.isInteger(existingLive?.revision) ? Number(existingLive?.revision) : 0,
  );
  const revision = revisionBase + 1;

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
    "requeued_at",
    "requeued_by",
    "requeue_reason",
  ]);
  trace.restored_from_archive_path = archived.archivePath.replace(`${appDir}/`, "");
  trace.blocked_wait_restored_at = repairedAt;
  trace.blocked_wait_restored_by = worker;
  trace.blocked_wait_restore_attempt_id = attemptId;
  trace.blocked_wait_restore_summary =
    `Restored ${holderTaskId} as the live blocked reviewed-exception holder after planner archiving/review completion left the spec-loop pointer without a live blocked carrier.`;
  trace.previous_nonterminal_status = priorState;
  trace.current_task_revision = revision;

  const context = {
    ...asRecord(sourceTask.context),
    ...asRecord(existingLive?.context),
    acceptance_note:
      `2026-07-17 app-owned state repair restored ${holderTaskId} as the live blocked reviewed-exception holder, repointed spec-loop lineage from ${staleTaskId}, and kept unchanged reruns blocked pending material mounted-source or exact carrier-authoring change.`,
    restoredFromArchivePath: archived.archivePath.replace(`${appDir}/`, ""),
    appEvidencePath: evidencePath,
  };

  const restoredHolder: TaskNode = {
    ...sourceTask,
    ...existingLive,
    id: holderTaskId,
    parent_id: holderParentId,
    state: "blocked",
    revision,
    goal: holderGoal,
    inputs: asStringArray(sourceTask.inputs),
    outputs: unique([...asStringArray(sourceTask.outputs), evidencePath]),
    acceptance: asStringArray(sourceTask.acceptance),
    conflict_scope: unique([...asStringArray(sourceTask.conflict_scope)]),
    blocker: {
      condition: holderCondition,
      category: "blocked-wait",
      owner: "aks-explorer",
      blocked_at:
        asString(asRecord(existingLive?.blocker).blocked_at) ?? repairedAt,
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
      `${attemptId}: restored ${holderTaskId} as the live blocked reviewed-exception holder and preserved the controller-visible spec lineage away from archived ${staleTaskId}; unchanged reruns remain intentionally blocked pending material mounted-source or exact carrier-authoring change.`,
    resolution: undefined,
    done_at: undefined,
    done_by: undefined,
    session_history: unique([
      ...asStringArray(sourceTask.session_history),
      ...asStringArray(existingLive?.session_history),
    ]),
    children: [],
  };
  delete (restoredHolder as TaskNode & { session_id?: unknown }).session_id;
  delete (restoredHolder as TaskNode & { evidence?: unknown }).evidence;
  delete (restoredHolder as TaskNode & { status?: unknown }).status;

  const parentChildrenBefore = asStringArray(liveParent.children);
  const parentChildrenAfter = unique([...parentChildrenBefore, holderTaskId]);
  const holderChanged =
    JSON.stringify(existingLive ?? null) !== JSON.stringify(restoredHolder);
  const parentChanged =
    JSON.stringify(parentChildrenBefore) !== JSON.stringify(parentChildrenAfter);

  if (holderChanged) tree.tasks[holderTaskId] = restoredHolder;
  if (parentChanged) liveParent.children = parentChildrenAfter;

  if (holderChanged || parentChanged) {
    saveTaskTreeWithKanbanSnapshot(config, tree);
  }

  return {
    changed: holderChanged || parentChanged,
    holderChanged,
    parentChanged,
    compactResidualMentionsHolder: JSON.stringify(compactResidual).includes(holderTaskId),
    holderAfter: taskSnapshot(tree.tasks[holderTaskId] as TaskNode | undefined, holderTaskId),
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
assert(liveSpecBefore, `Missing spec-loop row for ${specId} during repair`);

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
if (specStateChanged) saveSpecLoopState(specStateLoaded.path, specState);

const afterTree = readTaskTree(config);
const afterHolder = afterTree.tasks[holderTaskId] as TaskNode | undefined;
const afterCompact = afterTree.tasks[compactResidualTaskId] as TaskNode | undefined;
const afterSpecRow = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: holderParentId,
  windowSize: 5,
}).state.specs[specId];
assert(afterHolder, `Expected ${holderTaskId} to be live after repair`);
assert(afterCompact, `Expected ${compactResidualTaskId} to remain live after repair`);
assert(afterSpecRow, `Expected spec-loop row ${specId} after repair`);

const verification = {
  holderShow: taskSnapshot(afterHolder, holderTaskId),
  compactResidualShow: taskSnapshot(afterCompact, compactResidualTaskId),
  compactResidualMentionsHolder: JSON.stringify(afterCompact).includes(holderTaskId),
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
    `- Applied at: \`${repairedAt}\`\n` +
    `- Supported mechanisms: \`readTaskTree(... )\` + \`withTreeLock(... )\` + \`saveTaskTreeWithKanbanSnapshot(... )\`, plus \`loadSpecLoopState(... )\` + \`updateSpecLoopSpec(... )\` + \`saveSpecLoopState(... )\`\n\n` +
    `## Baseline before apply\n\n` +
    `The live task tree no longer carried \`${holderTaskId}\` even though the archived task and the spec-loop row still pointed at that id. The current live compact residual holder \`${compactResidualTaskId}\` already cited \`${holderTaskId}\`, so the remaining drift was restoring one open blocked live holder rather than rewriting compact lineage again.\n\n` +
    `\`\`\`json\n${JSON.stringify(baseline, null, 2)}\n\`\`\`\n\n` +
    `## Applied repair\n\n` +
    `1. Restored \`${holderTaskId}\` from archived done state back into the live task tree under \`${holderParentId}\`, clearing terminal fields and reapplying the blocked reviewed-exception contract instead of creating a duplicate task id.\n` +
    `2. Reconfirmed \`.state/spec-loop/state.json\` for \`${specId}\` so \`taskId\`, \`successorStateReason\`, \`resumeCondition\`, and \`review.lastAction\` continue to point at the restored holder instead of archived \`${staleTaskId}\`.\n` +
    `3. Verified the current live compact residual holder \`${compactResidualTaskId}\` already cites \`${holderTaskId}\` as the runner-harness downstream lineage, so no additional compact-holder mutation was required in this retry.\n` +
    `4. Did not revive archived \`${staleTaskId}\` as a live task and did not queue an unchanged rerun.\n\n` +
    `## Post-apply verification\n\n` +
    `\`\`\`json\n${JSON.stringify(verification, null, 2)}\n\`\`\`\n\n` +
    `## Acceptance check\n\n` +
    `- App-owned task-tree or loop-state repair applied through supported app mechanisms: ${treeMutation.changed || specStateChanged ? "satisfied" : "already satisfied"}.\n` +
    `- Affected branch records the exact restored holder/state pointer or refreshed wait with evidence: satisfied via the live holder snapshot, the spec-loop row, the compact residual verification, and this memo at \`${evidencePath}\`.`,
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
