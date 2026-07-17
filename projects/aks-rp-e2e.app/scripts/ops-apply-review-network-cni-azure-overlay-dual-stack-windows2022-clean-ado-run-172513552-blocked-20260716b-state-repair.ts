import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

type JsonRecord = Record<string, unknown>;

type ArchivedBundle = {
  tasks?: Array<JsonRecord>;
};

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-review-network-cni-azure-overlay-dual-stack-windows2022-clean-ado-run-172513552-blocked-20260716b-state-repair_20260716144309";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const restoreTaskId =
  "domain/review-network-cni-azure-overlay-dual-stack-windows2022-clean-ado-run-172513552-blocked-20260716b";
const liveParentId = "domain/normalize-scenario-tests-repo-frontier-20260715";
const archivedParentId =
  "domain/reconcile-network-cni-azure-overlay-dual-stack-windows2022-direct-repo-normalization-20260716";
const archivePath = resolve(
  appDir,
  ".state/tasks/archive/done-leaves-20260716144529229.json",
);
const domainEvidencePath =
  "../aks-rp-e2e/evidence/archive/recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716b.md";
const domainEvidenceAbsolute = resolve(
  projectDir,
  "evidence/archive/recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716b.md",
);
const appEvidencePath =
  "evidence/archive/ops-apply-review-network-cni-azure-overlay-dual-stack-windows2022-clean-ado-run-172513552-blocked-20260716b-state-repair.md";
const appEvidenceAbsolute = resolve(appDir, appEvidencePath);
const specId = "spec.network-cni.azure-overlay-dual-stack-windows2022";
const runId = "172513552";
const nextCheckAt = "2026-07-16T15:06:31Z";
const fallbackAt = "2026-07-16T16:36:31Z";
const evidenceRefs = [
  domainEvidencePath,
  "../aks-rp-e2e/workspace/domain-recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716b/20260716T143531Z/ado-run-show.json",
  "../aks-rp-e2e/workspace/domain-recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716b/20260716T143531Z/ado-artifact-list.json",
  "../aks-rp-e2e/workspace/domain-recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716b/20260716T143531Z/ado-timeline.json",
  "../aks-rp-e2e/workspace/domain-recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716b/20260716T143531Z/poll.log",
  "../aks-rp-e2e/workspace/domain-recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716b/20260716T143531Z/download-slice.exitcode.txt",
  "../aks-rp-e2e/workspace/domain-recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716b/20260716T143531Z/download-slice.stderr.txt",
];

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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const archivedBundle = readJson<ArchivedBundle>(archivePath);
const archivedTask = (archivedBundle.tasks ?? []).find(
  (task) => task.id === restoreTaskId,
);
assert(archivedTask, `Archived task ${restoreTaskId} not found in ${archivePath}`);
assert(
  readFileSync(domainEvidenceAbsolute, "utf8").includes(`Run \`${runId}\` is still **nonterminal and artifact-incomplete**.`),
  `Expected domain evidence memo ${domainEvidenceAbsolute} to describe the nonterminal/artifact-incomplete wait`,
);

const beforeTree = readTaskTree(config);
const liveParentBefore = beforeTree.tasks[liveParentId] as TaskNode | undefined;
const restoreBefore = beforeTree.tasks[restoreTaskId] as TaskNode | undefined;
assert(liveParentBefore, `Missing live parent ${liveParentId}`);

const beforeConflictMatches = Object.values(beforeTree.tasks)
  .filter((task) => {
    const scope = asStringArray(task.conflict_scope);
    return scope.includes(`ado-run:${runId}`) || scope.includes(`spec:${specId}`);
  })
  .map((task) => ({
    id: task.id,
    state: asString(task.state),
    parent_id: asString(task.parent_id),
  }))
  .sort((a, b) => String(a.id).localeCompare(String(b.id)));

const mutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const liveParent = tree.tasks[liveParentId] as TaskNode | undefined;
  if (!liveParent) throw new Error(`Missing live parent ${liveParentId} during repair`);

  const existing = tree.tasks[restoreTaskId] as TaskNode | undefined;
  const archived = clone(archivedTask) as TaskNode;
  const archivedTrace = asRecord(archived.trace);
  const archivedContext = asRecord(archived.context);
  const existingTrace = asRecord(existing?.trace);
  const existingContext = asRecord(existing?.context);

  const blocker: JsonRecord = {
    condition:
      `2026-07-16T14:35:31Z same-run evidence shows Azure DevOps run ${runId} for ${specId} remains notStarted/nonterminal with no published slice-01-test-results artifact, so the branch must stay on the exact same-run wait until the terminal artifact contract is satisfied.`,
    category: "external-wait",
    owner: "external",
    blocked_at: appliedAt,
    waiting_for: {
      kind: "external-run-terminal-artifact",
      runId,
      specId,
      resume_when: [
        "run status is terminal",
        "artifact list contains slice-01-test-results",
      ],
      next_check_at: nextCheckAt,
      fallback_check_at: fallbackAt,
      evidence: evidenceRefs,
    },
    observed_by: {
      workflow: "project-planner",
      schedule: "blocked-frontier-owner-review",
      trigger: "project.planning.requested",
    },
    observation_method:
      "Recheck the same Azure DevOps run and restore active review only after the exact run becomes terminal and publishes slice-01-test-results; otherwise keep or refresh this same-run wait with current evidence.",
    next_check_at: nextCheckAt,
    resume_condition:
      `Resume only when Azure DevOps run ${runId} reports a terminal status and the same-run artifact list includes slice-01-test-results for ${specId}. Then inspect the same-run aggregate and per-spec result artifacts before any product verdict.`,
    fallback_at: fallbackAt,
    fallback_action:
      `If run ${runId} is still nonterminal or artifact-incomplete at fallback, refresh or replace this exact same-run wait with newer same-run evidence or escalate the Azure DevOps queue/nonstart wait for this exact run/spec lineage; do not queue an unchanged rerun from this holder.`,
    resume_at: nextCheckAt,
  };

  const restoredTask: TaskNode = {
    ...archived,
    ...existing,
    id: restoreTaskId,
    parent_id: liveParentId,
    state: "blocked",
    status: "blocked",
    kind: "domain_leaf",
    priority: archived.priority ?? existing?.priority ?? "P2",
    owner: asString(archived.owner) ?? asString(existing?.owner) ?? "aks-explorer",
    children: [],
    goal:
      `Hold exact review for Azure DevOps run ${runId} until the same run becomes terminal and publishes slice-01-test-results for ${specId}.`,
    outputs: unique([
      ...asStringArray(archived.outputs),
      ...asStringArray(existing?.outputs),
      domainEvidencePath,
    ]),
    evidence: evidenceRefs,
    conflict_scope: unique([
      ...asStringArray(archived.conflict_scope),
      ...asStringArray(existing?.conflict_scope),
      `ado-run:${runId}`,
      `spec:${specId}`,
    ]),
    blocker,
    result:
      `${attemptId}: restored ${restoreTaskId} as the exact blocked same-run holder for Azure DevOps run ${runId}; the run is still notStarted/nonterminal and slice-01-test-results is unpublished, so no product verdict is truthful yet.`,
    context: {
      reviewedSource: {
        reviewedTaskId:
          asString(asRecord(archivedContext.reviewedTask).taskId) ??
          asString(asRecord(existingContext.reviewedTask).taskId),
        reviewedAttemptId:
          asString(asRecord(archivedContext.reviewedTask).attemptId) ??
          asString(asRecord(existingContext.reviewedTask).attemptId),
        decision:
          asString(asRecord(archivedContext.reviewedTask).decision) ??
          asString(asRecord(existingContext.reviewedTask).decision),
        sourceCommandKey:
          asString(asRecord(archivedContext.workCommand).key) ??
          asString(asRecord(existingContext.workCommand).key),
      },
      exactRunTerminalArtifactWait: true,
      appEvidencePath,
      domainEvidencePath,
      restoredFromArchivePath: ".state/tasks/archive/done-leaves-20260716144529229.json",
      restoredFromArchivedParentId: archivedParentId,
      restoredToLiveParentId: liveParentId,
    },
    trace: {
      ...archivedTrace,
      ...existingTrace,
      restored_from_archive_path: ".state/tasks/archive/done-leaves-20260716144529229.json",
      restored_from_archived_parent_id: archivedParentId,
      restored_to_live_parent_id: liveParentId,
      blocked_wait_restored_at: appliedAt,
      blocked_wait_restored_by: worker,
      blocked_wait_restore_attempt_id: attemptId,
      blocked_wait_restore_summary:
        `Restored exact blocked holder ${restoreTaskId} under ${liveParentId} after planner maintenance archived the successor while the same-run wait still remained true.`,
      current_attempt_id: undefined,
      requeued_at: undefined,
      requeued_by: undefined,
      requeue_reason: undefined,
      previous_nonterminal_status: undefined,
    },
    resolution: undefined,
    done_at: undefined,
    done_by: undefined,
  };

  tree.tasks[restoreTaskId] = restoredTask;
  liveParent.children = unique([...(asStringArray(liveParent.children) ?? []), restoreTaskId]);
  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    liveParentId,
    restoreTaskId,
    parentChildrenAfter: asStringArray(liveParent.children),
    restoredTask: clone(restoredTask),
  };
});

const afterTree = readTaskTree(config);
const restoredAfter = afterTree.tasks[restoreTaskId] as TaskNode | undefined;
const liveParentAfter = afterTree.tasks[liveParentId] as TaskNode | undefined;
assert(restoredAfter, `Missing restored live task ${restoreTaskId} after repair`);
assert(liveParentAfter, `Missing live parent ${liveParentId} after repair`);
assert(
  asString(restoredAfter.state) === "blocked" &&
    asString((restoredAfter as TaskNode & { status?: unknown }).status) === "blocked",
  `Expected ${restoreTaskId} blocked/blocked after repair`,
);
assert(
  asRecord(restoredAfter.blocker).waiting_for &&
    asRecord(asRecord(restoredAfter.blocker).waiting_for).kind ===
      "external-run-terminal-artifact",
  `Expected ${restoreTaskId} waiting_for.kind=external-run-terminal-artifact after repair`,
);
assert(
  asStringArray(liveParentAfter.children).includes(restoreTaskId),
  `Expected ${liveParentId}.children to include ${restoreTaskId} after repair`,
);

const afterConflictMatches = Object.values(afterTree.tasks)
  .filter((task) => {
    const scope = asStringArray(task.conflict_scope);
    return scope.includes(`ado-run:${runId}`) || scope.includes(`spec:${specId}`);
  })
  .map((task) => ({
    id: task.id,
    state: asString(task.state),
    parent_id: asString(task.parent_id),
    waiting_for: asRecord(asRecord(task.blocker).waiting_for),
  }))
  .sort((a, b) => String(a.id).localeCompare(String(b.id)));

const memo = `# App apply — network-cni Azure Overlay dual-stack Windows2022 blocked wait restore — 2026-07-16

- Task: \`ops-apply-review-network-cni-azure-overlay-dual-stack-windows2022-clean-ado-run-172513552-blocked-20260716b-state-repair\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Worker: \`${worker}\`

## Scope

Applied the bounded app-owned task-tree repair only. No project/runtime events were emitted. No rerun task was created. No product pass/fail verdict was recorded. The runtime task tree file was not edited directly; the repair used \`readTaskTree(... )\` + \`withTreeLock(... )\` + \`saveTaskTreeWithKanbanSnapshot(... )\` in one app-local script.

## Baseline before repair

- Live parent \`${liveParentId}\` existed: \`${String(Boolean(liveParentBefore))}\`
- Archived immediate parent \`${archivedParentId}\` was absent from the live task map: \`${String(!beforeTree.tasks[archivedParentId])}\`
- Live holder \`${restoreTaskId}\` existed before repair: \`${String(Boolean(restoreBefore))}\`
- Same-run/source memo already existed: \`${domainEvidencePath}\`

Conflict-scope matches before repair:

\`\`\`json
${JSON.stringify(beforeConflictMatches, null, 2)}
\`\`\`

## Repair applied

Restored archived holder \`${restoreTaskId}\` from \`.state/tasks/archive/done-leaves-20260716144529229.json\` back into the live task tree and rehomed it under the nearest live branch root \`${liveParentId}\` because the archived immediate parent \`${archivedParentId}\` is no longer live.

Applied blocked wait contract:

- \`state/status = blocked/blocked\`
- \`blocker.waiting_for.kind = external-run-terminal-artifact\`
- \`blocker.waiting_for.runId = ${runId}\`
- \`blocker.waiting_for.specId = ${specId}\`
- \`blocker.waiting_for.resume_when = ["run status is terminal", "artifact list contains slice-01-test-results"]\`
- \`blocker.waiting_for.next_check_at = ${nextCheckAt}\`
- \`blocker.waiting_for.fallback_check_at = ${fallbackAt}\`
- blocker/result text cites the same-run evidence memo and underlying ADO artifact/timeline files

## Verification after repair

Conflict-scope matches after repair:

\`\`\`json
${JSON.stringify(afterConflictMatches, null, 2)}
\`\`\`

Restored task snapshot:

\`\`\`json
${JSON.stringify(
  {
    id: restoredAfter.id,
    parent_id: restoredAfter.parent_id ?? null,
    state: restoredAfter.state ?? null,
    status: (restoredAfter as TaskNode & { status?: unknown }).status ?? null,
    goal: restoredAfter.goal ?? null,
    conflict_scope: restoredAfter.conflict_scope ?? [],
    blocker: asRecord(restoredAfter.blocker),
    result: (restoredAfter as TaskNode & { result?: unknown }).result ?? null,
    evidence: (restoredAfter as TaskNode & { evidence?: unknown }).evidence ?? null,
    trace: asRecord(restoredAfter.trace),
  },
  null,
  2,
)}
\`\`\`

## Acceptance check

- App-owned task-tree repair applied through supported app mechanisms: satisfied.
- The affected branch records the exact restored holder and refreshed wait with evidence: satisfied via live blocked holder \`${restoreTaskId}\` under \`${liveParentId}\`, with the exact same-run wait contract and cited evidence above.
`;

writeText(appEvidenceAbsolute, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appEvidencePath,
      restoreTaskId,
      liveParentId,
      beforeConflictMatches,
      afterConflictMatches,
      mutation,
    },
    null,
    2,
  ),
);
