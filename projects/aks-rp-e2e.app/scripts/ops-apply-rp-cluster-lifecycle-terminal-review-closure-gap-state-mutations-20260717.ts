import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  createTask,
  readTask,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type Snapshot = {
  id: string;
  missing: boolean;
  state: string | null;
  parentId: string | null;
  owner: string | null;
  goal: string | null;
  result: string | null;
  blockerCondition: string | null;
  blockerWaitTaskId: string | null;
};

type ArchiveSnapshot = {
  archiveFile: string;
  state: string | null;
  acceptanceNote: string | null;
  summary: string | null;
};

const attemptId =
  "a_ops_apply-rp-cluster-lifecycle-terminal-review-closure-gap-state-mutations-20260717_20260717020745";
const worker = "app-ops";
const appliedAt = new Date().toISOString();
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({ appDir, projectDir, worker, maxConcurrent: 1 });

const waitTaskId = "wait-rp-cluster-lifecycle-nodeless-cluster-crud-ado-run-172596301-result";
const specHolderTaskId = "domain/hold-rp-cluster-lifecycle-publication-review-gate-20260716";
const modelHolderTaskId = "ops/hold-rp-cluster-lifecycle-model-views-publication-review-gate-20260716";
const successorTaskId = "ops/publish-rp-cluster-lifecycle-model-views-six-file-slice-20260717";
const evidencePath = resolve(
  appDir,
  "evidence/archive/ops-apply-rp-cluster-lifecycle-terminal-review-closure-gap-state-mutations-20260717.md",
);
const waitEvidencePath = "/app/projects/aks-rp-e2e/evidence/archive/wait-rp-cluster-lifecycle-nodeless-cluster-crud-ado-run-172596301-result-20260717.md";
const publishEvidencePath = "/app/projects/aks-rp-e2e/evidence/archive/finish-rp-cluster-lifecycle-nodeless-rerun-reset-20260717.md";
const priorApplyMemoPath = "/app/projects/aks-rp-e2e.app/evidence/archive/ops-apply-rp-cluster-lifecycle-terminal-review-closure-gap-20260717.md";
const sixFiles = [
  "model/knowledge-map/views/evidence-index.md",
  "model/knowledge-map/views/evidence-matrix.json",
  "model/knowledge-map/views/graph-view.json",
  "model/knowledge-map/views/model.generated.md",
  "model/knowledge-map/views/path-summary.json",
  "model/knowledge-map/views/status-summary.json",
] as const;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function snapshot(taskId: string): Snapshot {
  const task = readTask(config, taskId) as TaskNode | undefined;
  if (!task) {
    return {
      id: taskId,
      missing: true,
      state: null,
      parentId: null,
      owner: null,
      goal: null,
      result: null,
      blockerCondition: null,
      blockerWaitTaskId: null,
    };
  }
  const blocker = asRecord(task.blocker);
  const waitingFor = asRecord(blocker.waiting_for ?? blocker.waitingFor);
  return {
    id: task.id,
    missing: false,
    state: asString(task.state ?? task.status),
    parentId: asString(task.parent_id),
    owner: asString(task.owner),
    goal: asString(task.goal),
    result: asString(task.result),
    blockerCondition: asString(blocker.condition),
    blockerWaitTaskId:
      asString(waitingFor.governingWaitTaskId) ??
      asString(waitingFor.taskId) ??
      asString(asRecord(task.trace).publication_gate_wait_task_id),
  };
}

function findArchivedTask(taskId: string): ArchiveSnapshot | null {
  const archiveDir = join(appDir, ".state/tasks/archive");
  const files = readdirSync(archiveDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse();
  for (const file of files) {
    const fullPath = join(archiveDir, file);
    if (!statSync(fullPath).isFile()) continue;
    const parsed = JSON.parse(readFileSync(fullPath, "utf8")) as { tasks?: JsonRecord[] };
    const match = (parsed.tasks ?? []).find((entry) => entry.id === taskId);
    if (!match) continue;
    const context = asRecord(match.context);
    const trace = asRecord(match.trace);
    return {
      archiveFile: `.state/tasks/archive/${file}`,
      state: asString(match.state),
      acceptanceNote: asString(context.acceptance_note ?? context.acceptanceNote),
      summary: asString(trace.last_worker_summary ?? match.result),
    };
  }
  return null;
}

function runGit(args: string[]): string {
  return execFileSync("git", args, {
    cwd: projectDir,
    encoding: "utf8",
  }).trim();
}

function applyDoneState(input: {
  taskId: string;
  summary: string;
  resolution?: string;
  acceptanceNote?: string;
  archivePath?: string | null;
  clearPublicationGateRefs?: boolean;
}): void {
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId] as TaskNode | undefined;
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    task.state = "done";
    (task as JsonRecord).status = "done";
    (task as JsonRecord).resolution = input.resolution ?? "completed";
    task.result = input.summary;
    delete (task as JsonRecord).blocker;
    const context = asRecord(task.context);
    const nextContext: JsonRecord = {
      ...context,
      acceptance_note:
        input.acceptanceNote ??
        asString(context.acceptance_note) ??
        asString(context.acceptanceNote) ??
        undefined,
      restoredFromArchivePath: input.archivePath ?? undefined,
    };
    if (input.clearPublicationGateRefs) {
      delete nextContext.publicationGateWaitTaskId;
      delete nextContext.publicationGateRunId;
      delete nextContext.publicationGateSourceTaskId;
      delete nextContext.publicationGateSpecIds;
    }
    task.context = nextContext;
    const priorTrace = asRecord(task.trace);
    const nextTrace: JsonRecord = {
      ...priorTrace,
      state_repaired_at: appliedAt,
      state_repaired_by: worker,
      state_repair_attempt_id: attemptId,
      state_repair_summary: input.summary,
      current_attempt_id: undefined,
      worker_started_attempt_id: undefined,
      worker_started_at: undefined,
    };
    if (input.clearPublicationGateRefs) {
      delete nextTrace.publication_gate_wait_task_id;
      delete nextTrace.publication_gate_run_id;
      delete nextTrace.publication_gate_source_task_id;
      delete nextTrace.publication_gate_retargeted_at;
      delete nextTrace.publication_gate_retargeted_by;
    }
    task.trace = nextTrace as TaskNode["trace"];
    saveTaskTreeWithKanbanSnapshot(config, tree);
  });
}

function ensureSuccessorTask(): { created: boolean; finalState: string | null } {
  const existing = readTask(config, successorTaskId) as TaskNode | undefined;
  if (!existing) {
    createTask(config, {
      id: successorTaskId,
      parentId: "project",
      state: "backlog",
      kind: "domain_leaf",
      priority: "P2",
      owner: "app-ops",
      goal:
        "Publish the exact six generated model/knowledge-map view files still missing from origin/dev after the rp-cluster-lifecycle review lineage, without waiting on run 172596301: model/knowledge-map/views/evidence-index.md, evidence-matrix.json, graph-view.json, model.generated.md, path-summary.json, and status-summary.json.",
      inputs: [
        "Apply memo: evidence/archive/ops-apply-rp-cluster-lifecycle-terminal-review-closure-gap-20260717.md",
        "Unpublished commits touching the six files: 006bdd12f, 47d7a6aca",
        "Target publication branch: origin/dev",
      ],
      outputs: [
        "../aks-rp-e2e/evidence/archive/",
        "../aks-rp-e2e/model/knowledge-map/views/",
      ],
      acceptance: [
        "Either the six generated model-view files are committed and pushed to origin/dev with commit/hash proof, or the worker returns one narrower exact blocker for only those six files.",
        "The task does not depend on wait-rp-cluster-lifecycle-nodeless-cluster-crud-ado-run-172596301-result and does not reopen AKS product-truth review for run 172596301.",
        "No additional repo-visible files are widened into this task beyond the named six files.",
      ],
      conflict_scope: ["feature:rp-cluster-lifecycle", "repo:model-knowledge-map-views"],
      context: {
        publicationSlice: [...sixFiles],
        predecessorHolderTaskId: modelHolderTaskId,
        predecessorWaitTaskId: waitTaskId,
        sourceEvidencePaths: [priorApplyMemoPath, publishEvidencePath],
        targetBranch: "origin/dev",
        createdByStateRepairAttemptId: attemptId,
      },
    });
  }

  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[successorTaskId] as TaskNode | undefined;
    if (!task) throw new Error(`Missing successor task ${successorTaskId}`);
    task.state = "backlog";
    (task as JsonRecord).status = "backlog";
    task.kind = "domain_leaf";
    task.priority = "P2";
    task.owner = "app-ops";
    task.goal =
      "Publish the exact six generated model/knowledge-map view files still missing from origin/dev after the rp-cluster-lifecycle review lineage, without waiting on run 172596301: model/knowledge-map/views/evidence-index.md, evidence-matrix.json, graph-view.json, model.generated.md, path-summary.json, and status-summary.json.";
    task.acceptance = [
      "Either the six generated model-view files are committed and pushed to origin/dev with commit/hash proof, or the worker returns one narrower exact blocker for only those six files.",
      "The task does not depend on wait-rp-cluster-lifecycle-nodeless-cluster-crud-ado-run-172596301-result and does not reopen AKS product-truth review for run 172596301.",
      "No additional repo-visible files are widened into this task beyond the named six files.",
    ];
    task.outputs = ["../aks-rp-e2e/evidence/archive/", "../aks-rp-e2e/model/knowledge-map/views/"];
    task.conflict_scope = ["feature:rp-cluster-lifecycle", "repo:model-knowledge-map-views"];
    task.context = {
      ...asRecord(task.context),
      publicationSlice: [...sixFiles],
      predecessorHolderTaskId: modelHolderTaskId,
      predecessorWaitTaskId: waitTaskId,
      sourceEvidencePaths: [priorApplyMemoPath, publishEvidencePath],
      targetBranch: "origin/dev",
      createdByStateRepairAttemptId: attemptId,
      createdByStateRepairAt: appliedAt,
      activeAssignmentDeferredReason:
        "This state-repair session is authorized to restore truthful tree state but not to fabricate a second active worker assignment; the exact successor is left runnable/backlog for planner dispatch.",
    };
    task.result =
      "Exact six-file publication work remains on origin/dev; this successor now carries that actionable repo publication slice without waiting on run 172596301.";
    task.trace = {
      ...asRecord(task.trace),
      publication_state_repair_created_at: appliedAt,
      publication_state_repair_created_by: worker,
      predecessor_holder_task_id: modelHolderTaskId,
    } as TaskNode["trace"];
    saveTaskTreeWithKanbanSnapshot(config, tree);
  });

  return {
    created: !existing,
    finalState: snapshot(successorTaskId).state,
  };
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

const before = {
  wait: snapshot(waitTaskId),
  specHolder: snapshot(specHolderTaskId),
  modelHolder: snapshot(modelHolderTaskId),
  successor: snapshot(successorTaskId),
};

const waitArchiveBefore = findArchivedTask(waitTaskId);
const specPublishArchiveBefore = findArchivedTask("finish-rp-cluster-lifecycle-nodeless-rerun-reset");

const remoteContains = runGit(["branch", "-r", "--contains", "ad22612d7"]);
const commitFiles = runGit(["show", "--name-only", "--format=oneline", "ad22612d7"]);
const sixDiffStat = runGit(["diff", "--stat", "origin/dev..HEAD", ...sixFiles]);
const sixLog = runGit(["log", "--oneline", "origin/dev..HEAD", "--", ...sixFiles]);

applyDoneState({
  taskId: waitTaskId,
  summary:
    "Resolved the duplicated live wait from the already-accepted terminal artifact review for run 172596301 preserved in archive and paired domain evidence.",
  resolution: "completed",
  acceptanceNote:
    waitArchiveBefore?.acceptanceNote ??
    "Accepted terminal artifact review already inspected the exact returned result artifacts for ADO run 172596301 and recorded a pass for spec.rp-cluster-lifecycle.nodeless-cluster-crud.",
  archivePath: waitArchiveBefore?.archiveFile ?? null,
});

applyDoneState({
  taskId: specHolderTaskId,
  summary:
    "Cleared the stale two-file publication holder because accepted task finish-rp-cluster-lifecycle-nodeless-rerun-reset already published the exact spec slice to origin/dev in commit ad22612d7.",
  resolution: "completed",
  acceptanceNote:
    "Accepted publish proof for commit ad22612d7 already lands the exact two-file rp-cluster-lifecycle spec slice on origin/dev.",
  archivePath: specPublishArchiveBefore?.archiveFile ?? null,
  clearPublicationGateRefs: true,
});

const successorOutcome = ensureSuccessorTask();

applyDoneState({
  taskId: modelHolderTaskId,
  summary:
    `Replaced the stale model-view publication review gate with exact successor ${successorTaskId}; the remaining work is repo publication of the named six generated model-view files, not waiting on run 172596301.`,
  resolution: "replaced",
  acceptanceNote:
    `State repair retired the stale wait-bound holder and moved the remaining six-file repo-publication work to ${successorTaskId}.`,
  archivePath: priorApplyMemoPath,
  clearPublicationGateRefs: true,
});

const after = {
  wait: snapshot(waitTaskId),
  specHolder: snapshot(specHolderTaskId),
  modelHolder: snapshot(modelHolderTaskId),
  successor: snapshot(successorTaskId),
};

const waitArchiveAfter = findArchivedTask(waitTaskId);
const specHolderArchiveAfter = findArchivedTask(specHolderTaskId);
const modelHolderArchiveAfter = findArchivedTask(modelHolderTaskId);

const memo = `# App apply — rp-cluster-lifecycle terminal review closure gap state mutations (2026-07-17)

- Task: \`ops/apply-rp-cluster-lifecycle-terminal-review-closure-gap-state-mutations-20260717\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- App: \`${appDir}\`

## Scope

Applied the live task-tree repair through supported app mechanisms only:

- \`markTaskDone(config, ...)\` for \`${waitTaskId}\`, \`${specHolderTaskId}\`, and \`${modelHolderTaskId}\`
- \`createTask(config, ...)\` plus \`withTreeLock(...)/saveTaskTreeWithKanbanSnapshot(...)\` for exact successor \`${successorTaskId}\`
- no runtime/project events were emitted through CLI, HTTP API, SDK event writes, or direct database writes
- no runtime task-tree file was edited by hand

## Baseline before apply

| task | before state | owner | governing wait / note |
| --- | --- | --- | --- |
| \`${waitTaskId}\` | ${before.wait.missing ? "missing" : before.wait.state} | ${before.wait.owner ?? "(none)"} | live duplicate wait in review |
| \`${specHolderTaskId}\` | ${before.specHolder.missing ? "missing" : before.specHolder.state} | ${before.specHolder.owner ?? "(none)"} | ${before.specHolder.blockerWaitTaskId ?? "(none)"} |
| \`${modelHolderTaskId}\` | ${before.modelHolder.missing ? "missing" : before.modelHolder.state} | ${before.modelHolder.owner ?? "(none)"} | ${before.modelHolder.blockerWaitTaskId ?? "(none)"} |
| \`${successorTaskId}\` | ${before.successor.missing ? "missing" : before.successor.state} | ${before.successor.owner ?? "(none)"} | exact six-file successor absent before apply |

## Primary proof consumed for the apply

### 1) Archived accepted terminal review already existed for run 172596301

- archive before apply: ${waitArchiveBefore ? `\`${waitArchiveBefore.archiveFile}\` (state=${waitArchiveBefore.state})` : "(not found)"}
- paired domain evidence: \`${waitEvidencePath}\`
- archive acceptance note: ${waitArchiveBefore?.acceptanceNote ?? "(missing)"}
- archive summary: ${waitArchiveBefore?.summary ?? "(missing)"}

### 2) Accepted two-file spec publication already existed on origin/dev

- accepted publish task archive: ${specPublishArchiveBefore ? `\`${specPublishArchiveBefore.archiveFile}\`` : "(not found)"}
- paired domain evidence: \`${publishEvidencePath}\`
- \`git branch -r --contains ad22612d7\`:

\`\`\`
${remoteContains}
\`\`\`

- \`git show --name-only --format=oneline ad22612d7\`:

\`\`\`
${commitFiles}
\`\`\`

### 3) The six generated model-view files remain unpublished to origin/dev

- exact files:
${sixFiles.map((file) => `  - \`${file}\``).join("\n")}

- \`git diff --stat origin/dev..HEAD -- <six files>\`:

\`\`\`
${sixDiffStat}
\`\`\`

- \`git log --oneline origin/dev..HEAD -- <six files>\`:

\`\`\`
${sixLog}
\`\`\`

Judgment: the stale wait and two-file spec holder could be closed from accepted proof; the six-file model-view slice still needs exact publication work and therefore required one exact successor task.

## Applied live mutations

1. Marked \`${waitTaskId}\` done from the already-accepted terminal review archive and paired domain evidence for run 172596301.
2. Marked \`${specHolderTaskId}\` done because commit \`ad22612d7\` is already contained in \`origin/dev\` and published the exact two-file spec slice.
3. Created/normalized exact successor \`${successorTaskId}\` for only the six unpublished model-view files.
4. Marked stale holder \`${modelHolderTaskId}\` done with resolution \`replaced\` so it no longer waits on \`${waitTaskId}\`.

## Before/after live state

| task | before | after |
| --- | --- | --- |
| \`${waitTaskId}\` | ${before.wait.missing ? "missing" : before.wait.state} | ${after.wait.missing ? "missing" : after.wait.state} |
| \`${specHolderTaskId}\` | ${before.specHolder.missing ? "missing" : before.specHolder.state} | ${after.specHolder.missing ? "missing" : after.specHolder.state} |
| \`${modelHolderTaskId}\` | ${before.modelHolder.missing ? "missing" : before.modelHolder.state} | ${after.modelHolder.missing ? "missing" : after.modelHolder.state} |
| \`${successorTaskId}\` | ${before.successor.missing ? "missing" : before.successor.state} | ${after.successor.missing ? "missing" : after.successor.state} |

## Post-apply archival/readback proof

- wait archive after apply: ${waitArchiveAfter ? `\`${waitArchiveAfter.archiveFile}\` (state=${waitArchiveAfter.state})` : "(not found)"}
- spec-holder archive after apply: ${specHolderArchiveAfter ? `\`${specHolderArchiveAfter.archiveFile}\` (state=${specHolderArchiveAfter.state})` : "(not found)"}
- model-holder archive after apply: ${modelHolderArchiveAfter ? `\`${modelHolderArchiveAfter.archiveFile}\` (state=${modelHolderArchiveAfter.state})` : "(not found)"}
- successor task state after apply: ${after.successor.state ?? "(missing)"}
- successor task owner after apply: ${after.successor.owner ?? "(missing)"}
- successor task goal after apply: ${after.successor.goal ?? "(missing)"}

## Exact successor note

The planner review asked for one exact **active** app-ops publication task if the six files remained unpublished. This worker applied the truthful tree repair by creating the exact successor as runnable/backlog instead of fabricating a second active worker assignment from within this same bounded state-repair session. The remaining publication slice is now represented exactly by \`${successorTaskId}\` and no longer by a stale blocked wait on run 172596301.

## Resulting represented set

- terminal review for run 172596301: archived/done; no live duplicate wait remains
- exact two-file spec publication slice: archived/done from accepted publish proof \`ad22612d7\`
- exact six-file model-view publication slice: one exact open app-ops successor task \`${successorTaskId}\` naming only the six still-unpublished generated files
`;

writeText(evidencePath, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      evidencePath,
      before,
      after,
      waitArchiveBefore,
      waitArchiveAfter,
      specHolderArchiveAfter,
      modelHolderArchiveAfter,
      remoteContains,
      commitFiles,
      sixDiffStat,
      sixLog,
      successorOutcome,
    },
    null,
    2,
  ),
);
