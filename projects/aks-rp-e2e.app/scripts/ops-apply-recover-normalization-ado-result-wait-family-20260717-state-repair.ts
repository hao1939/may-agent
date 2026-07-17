import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  refreshBlockedWait,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";
import { defaultFeatureCompactLoopStatePath } from "../workflows/lib/feature-compact-loop-store.ts";
import { defaultSpecLoopStatePath } from "../workflows/lib/spec-loop-store.ts";

type JsonRecord = Record<string, unknown>;

type TaskSnapshot = {
  id: string;
  state: string | null;
  goal: string | null;
  result: string | null;
  inputs: string[];
  outputs: string[];
  context: JsonRecord | null;
  blocker: JsonRecord | null;
  trace: JsonRecord | null;
};

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-recover-normalization-ado-result-wait-family-20260717-state-repair_20260717081754";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const observedAt = "2026-07-17T08:12:45Z";
const nextCheckAt = "2026-07-17T08:22:45Z";
const fallbackAt = "2026-07-17T08:32:45Z";
const sourceMemoPath =
  "evidence/archive/ops-recover-normalization-ado-result-wait-family-20260717.md";
const evidencePath =
  "evidence/archive/ops-apply-recover-normalization-ado-result-wait-family-20260717-state-repair.md";
const evidenceAbsolute = resolve(appDir, evidencePath);
const taskId = "wait-traffic-api-proxy-access-control-ado-run-172644256-result";
const siblingTaskIds = [
  "wait-private-cluster-byo-dns-server-ado-run-172644231-result",
  "wait-traffic-managed-gateway-api-create-lifecycle-ado-run-172644147-result",
] as const;
const sourceTaskId = "domain/normalize-direct-traffic-api-proxy-access-control-20260717";
const sourceAttemptId =
  "a_domain_normalize-direct-traffic-api-proxy-access-control-20260717_20260717055250";
const runId = "172644256";
const specId = "spec.traffic-api-proxy.access-control";
const runUrl =
  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172644256&view=results";
const sourceVersion = "36fff28a9701313770d966715c3eb7c3cd9b4d7c";
const baseCommit = "e89677f6eaa1cc5e531077c7a1ff54267aaf77cd";
const summary =
  "2026-07-17T08:12:45Z refresh: same-run evidence for Azure DevOps run 172644256 now matches its sibling normalization waits. The run is inProgress on definition 467665 / queue 12818, plan completed successfully, and plan-inputs published, but Execute slice and Execute slice slice_01 remain pending with no startTime and no slice-01-test-results artifact yet. Keep this exact same-run wait blocked, align it to the external ADO completion contract used by the sibling waits, and do not queue a normalization rerun.";
const condition =
  "2026-07-17T08:12:45Z same-run evidence now shows Azure DevOps run 172644256 for spec.traffic-api-proxy.access-control is inProgress on definition 467665 / queue 12818, planning succeeded, plan-inputs published, and Execute slice plus Execute slice slice_01 remain pending with no startTime and no slice-01-test-results artifact yet. Keep this exact same-run holder blocked on the external Azure DevOps completion contract and do not queue a normalization rerun while the same run remains the controlling evidence source.";
const resumeCondition =
  "Resume when Azure DevOps run 172644256 is terminal and its artifacts are available for exact same-run review of spec.traffic-api-proxy.access-control.";
const fallbackAction =
  "If the 08:22:45Z / 08:32:45Z windows still show definition 467665 / queue 12818 stalled with only plan-inputs and Execute slice pending, refresh this exact same-run wait with newer evidence or escalate the shared execute-slice stall family; do not queue a normalization rerun while run 172644256 remains the controlling evidence source.";
const refreshedGoal =
  "Wait for Azure DevOps run 172644256 for spec.traffic-api-proxy.access-control queued by accepted task domain/normalize-direct-traffic-api-proxy-access-control-20260717. When it is terminal, inspect the artifacts and record the exact pass/fail/error result.";
const refreshedInputs = [
  `Reviewed task: ${sourceTaskId}`,
  `Attempt: ${sourceAttemptId}`,
  `ADO run: ${runId}`,
  `Spec: ${specId}`,
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : null;
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

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf8");
}

function taskSnapshot(task: TaskNode | undefined, id: string): TaskSnapshot {
  return {
    id,
    state: asString(task?.state),
    goal: asString(task?.goal),
    result: asString(task?.result),
    inputs: asStringArray(task?.inputs),
    outputs: asStringArray(task?.outputs),
    context: task?.context ? clone(task.context as JsonRecord) : null,
    blocker: task?.blocker ? clone(task.blocker as JsonRecord) : null,
    trace: task?.trace ? clone(task.trace as JsonRecord) : null,
  };
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const featureCompactStatePath = defaultFeatureCompactLoopStatePath(appDir);
const specLoopStatePath = defaultSpecLoopStatePath(appDir);
const featureCompactHashBefore = sha256(featureCompactStatePath);
const specLoopHashBefore = sha256(specLoopStatePath);

const beforeTree = readTaskTree(config);
const targetBefore = beforeTree.tasks[taskId] as TaskNode | undefined;
assert(targetBefore, `Missing live task ${taskId}`);
const siblingBefore = Object.fromEntries(
  siblingTaskIds.map((id) => {
    const task = beforeTree.tasks[id] as TaskNode | undefined;
    assert(task, `Missing live sibling wait ${id}`);
    return [id, taskSnapshot(task, id)];
  }),
) as Record<string, TaskSnapshot>;
const taskCountBefore = Object.keys(beforeTree.tasks).length;
const parentBefore = beforeTree.tasks[targetBefore.parent_id ?? ""] as TaskNode | undefined;
const representedSetBefore = unique([
  taskId,
  ...siblingTaskIds,
].filter((id) => {
  const task = beforeTree.tasks[id] as TaskNode | undefined;
  return task && asString(task.state) === "blocked" ? id : null;
}));

refreshBlockedWait(config, {
  taskId,
  condition,
  resumeCondition,
  summary,
  category: "external-wait",
  owner: "ado",
  nextCheckAt,
  fallbackAt,
  fallbackAction,
});

const mutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const target = tree.tasks[taskId] as TaskNode | undefined;
  assert(target, `Missing task during mutation: ${taskId}`);

  const blockerBefore = asRecord(target.blocker) ?? {};
  const traceBefore = asRecord(target.trace) ?? {};
  const contextBefore = asRecord(target.context) ?? {};

  target.state = "blocked";
  target.status = "blocked";
  target.goal = refreshedGoal;
  target.result = summary;
  target.inputs = refreshedInputs;
  target.outputs = unique([...asStringArray(target.outputs), sourceMemoPath, evidencePath]);
  target.context = {
    ...contextBefore,
    acceptedQueuedPipelineRun: {
      sourceTaskId,
      sourceAttemptId,
      runId,
      runUrl,
      specIds: [specId],
      summary:
        "The normalization and isolated queued-run lineage are sufficiently evidenced, but the task acceptance is not complete because same-run live ADO artifacts for run 172644256 are still pending.",
      baseRef: "origin/dev",
      baseCommit,
      sourceVersion,
      sourceCommit: sourceVersion,
      firstParentCommits: [sourceVersion],
      changedFiles: [
        "features/traffic-api-proxy/compact/staging.plan.json",
        "features/traffic-api-proxy/specs/traffic-api-proxy-access-control.json",
        "features/traffic-api-proxy/tests/traffic-api-proxy-access-control.test.ts",
        "features/traffic-api-proxy/tests/traffic-api-proxy-access-control.ts",
      ],
      worktreePath:
        "/app/projects/aks-rp-e2e/workspace/normalize-direct-traffic-api-proxy-access-control-20260717-wt",
    },
    terminalPipelineWaitReview: {
      runId,
      runUrl,
      namedSpecIds: [specId],
    },
    latestRepairEvidencePath: evidencePath,
    latestRepairSourceMemoPath: sourceMemoPath,
  };
  target.blocker = {
    ...blockerBefore,
    condition,
    category: "external-wait",
    owner: "ado",
    waiting_for: {
      type: "ado.pipeline_run.completed",
      runId,
      runUrl,
      specIds: [specId],
      sourceTaskId,
      sourceAttemptId,
      baseRef: "origin/dev",
      baseCommit,
      sourceVersion,
      sourceCommit: sourceVersion,
    },
    observed_by: {
      workflow: "project-execution-watchdog",
      trigger: "project.task.reviewed",
    },
    observation_method:
      "Watchdog checks the named Azure DevOps run and moves this wait to review when the run is terminal; the reviewer then consumes artifacts and records the exact result.",
    next_check_at: nextCheckAt,
    resume_condition: resumeCondition,
    fallback_at: fallbackAt,
    fallback_action: fallbackAction,
    resume_at: nextCheckAt,
    last_observed_at: observedAt,
    last_observed_status: "inProgress",
  };
  target.trace = {
    ...traceBefore,
    accepted_queued_pipeline_wait_created_at:
      asString(traceBefore.accepted_queued_pipeline_wait_created_at) ??
      asString(asRecord(targetBefore.trace)?.accepted_queued_pipeline_wait_created_at) ??
      appliedAt,
    accepted_queued_pipeline_source_task_id: sourceTaskId,
    accepted_queued_pipeline_source_attempt_id: sourceAttemptId,
    accepted_queued_pipeline_run_id: runId,
    pipeline_wait_last_checked_at: observedAt,
    pipeline_wait_last_status: "inProgress",
    pipeline_wait_last_run_id: runId,
    pipeline_wait_next_check_refreshed_by: worker,
    blocked_wait_refreshed_at: appliedAt,
    blocked_wait_refreshed_by: worker,
    blocked_wait_refresh_summary: summary,
    blocked_wait_refresh_apply_attempt_id: attemptId,
    blocked_wait_refresh_apply_evidence_path: evidencePath,
    blocked_wait_refresh_source_memo_path: sourceMemoPath,
    current_attempt_id: undefined,
  };
  target.updated_at = appliedAt;

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    targetAfter: taskSnapshot(target, taskId),
    siblingAfter: Object.fromEntries(
      siblingTaskIds.map((id) => {
        const task = tree.tasks[id] as TaskNode | undefined;
        assert(task, `Missing live sibling wait after mutation ${id}`);
        return [id, taskSnapshot(task, id)];
      }),
    ) as Record<string, TaskSnapshot>,
    representedSetAfter: unique([
      taskId,
      ...siblingTaskIds,
    ].filter((id) => {
      const task = tree.tasks[id] as TaskNode | undefined;
      return task && asString(task.state) === "blocked" ? id : null;
    })),
    taskCountAfter: Object.keys(tree.tasks).length,
    parentChildrenAfter: asStringArray(
      (tree.tasks[target.parent_id ?? ""] as TaskNode | undefined)?.children,
    ),
  };
});

const afterTree = readTaskTree(config);
const targetAfter = afterTree.tasks[taskId] as TaskNode | undefined;
assert(targetAfter, `Missing live task after mutation ${taskId}`);
const blockerAfter = asRecord(targetAfter.blocker);
assert(asString(targetAfter.state) === "blocked", `${taskId} is not blocked after repair`);
assert(
  asString(asRecord(blockerAfter?.waiting_for)?.type) === "ado.pipeline_run.completed",
  `${taskId} waiting_for.type was not repaired to ado.pipeline_run.completed`,
);
assert(
  asString(asRecord(blockerAfter?.waiting_for)?.runId) === runId,
  `${taskId} waiting_for.runId does not equal ${runId}`,
);
assert(
  asString(blockerAfter?.last_observed_status) === "inProgress",
  `${taskId} last_observed_status is not inProgress`,
);
assert(
  asString(blockerAfter?.last_observed_at) === observedAt,
  `${taskId} last_observed_at does not match ${observedAt}`,
);
assert(
  asString(blockerAfter?.next_check_at) === nextCheckAt,
  `${taskId} next_check_at does not match ${nextCheckAt}`,
);
assert(
  asString(blockerAfter?.fallback_at) === fallbackAt,
  `${taskId} fallback_at does not match ${fallbackAt}`,
);
assert(
  Date.parse(nextCheckAt) > Date.parse(observedAt) &&
    Date.parse(fallbackAt) > Date.parse(nextCheckAt),
  "Expected future next_check_at / fallback_at windows relative to observedAt",
);
const contextAfter = asRecord(targetAfter.context);
assert(
  asString(asRecord(contextAfter?.acceptedQueuedPipelineRun)?.runId) === runId,
  `acceptedQueuedPipelineRun.runId missing on ${taskId}`,
);
assert(
  asString(asRecord(contextAfter?.terminalPipelineWaitReview)?.runId) === runId,
  `terminalPipelineWaitReview.runId missing on ${taskId}`,
);
assert(
  mutation.taskCountAfter === taskCountBefore,
  `Task count changed unexpectedly (${taskCountBefore} -> ${mutation.taskCountAfter})`,
);
assert(
  JSON.stringify(mutation.siblingAfter) === JSON.stringify(siblingBefore),
  "Sibling wait tasks changed unexpectedly during targeted repair",
);
assert(
  mutation.parentChildrenAfter.includes(taskId),
  `${taskId} was lost from parent children during repair`,
);

const featureCompactHashAfter = sha256(featureCompactStatePath);
const specLoopHashAfter = sha256(specLoopStatePath);

const evidence = `# App apply — recover normalization ADO result wait family state repair (2026-07-17)\n\n- Task: \`ops-apply-recover-normalization-ado-result-wait-family-20260717-state-repair\`\n- Attempt: \`${attemptId}\`\n- Applied at: \`${appliedAt}\`\n- Supported mechanisms: \`refreshBlockedWait(... )\` plus \`withTreeLock(... )\` + \`saveTaskTreeWithKanbanSnapshot(... )\`\n- Source evidence memo: \`${sourceMemoPath}\`\n\n## Scope\n\nApplied the bounded app-owned repair only to \`${taskId}\`. No project/runtime events were emitted. No task was created, reassigned, accepted, rejected, or rolled up. No normalization rerun was created.\n\n## Baseline represented same-run wait set (excluding this repair task itself)\n\n${representedSetBefore.map((id) => `- \`${id}\``).join("\n")}\n\n## Baseline before mutation\n\n### Target wait before\n\n\`\`\`json\n${JSON.stringify(taskSnapshot(targetBefore, taskId), null, 2)}\n\`\`\`\n\n### Sibling waits before\n\n\`\`\`json\n${JSON.stringify(siblingBefore, null, 2)}\n\`\`\`\n\n### App-owned loop-state file hashes before\n\n- \`${featureCompactStatePath}\`: \`${featureCompactHashBefore}\`\n- \`${specLoopStatePath}\`: \`${specLoopHashBefore}\`\n\n## Applied repair\n\n1. Refreshed \`${taskId}\` through \`refreshBlockedWait(... )\` with the 2026-07-17T08:12:45Z same-run evidence, the restored next-check window \`${nextCheckAt}\`, and fallback window \`${fallbackAt}\`.\n2. Replaced the self-referential \`blocker.waiting_for.type=blocker.resolved\` contract with the external \`ado.pipeline_run.completed\` contract for run \`${runId}\`.\n3. Restored missing lineage context on the wait via \`context.acceptedQueuedPipelineRun\` and \`context.terminalPipelineWaitReview\`.\n4. Normalized the wait metadata to the sibling watchdog contract: owner \`ado\`, observed-by \`project-execution-watchdog\`, observation method text, last observed status \`inProgress\`, and same-run no-rerun fallback guidance.\n5. Preserved the two sibling waits unchanged and left the represented same-run wait set intact.\n\n## Verification after mutation\n\n### Target wait after\n\n\`\`\`json\n${JSON.stringify(mutation.targetAfter, null, 2)}\n\`\`\`\n\n### Sibling waits after\n\n\`\`\`json\n${JSON.stringify(mutation.siblingAfter, null, 2)}\n\`\`\`\n\n### Represented set after mutation\n\n${mutation.representedSetAfter.map((id) => `- \`${id}\``).join("\n")}\n\n### App-owned loop-state file hashes after\n\n- \`${featureCompactStatePath}\`: \`${featureCompactHashAfter}\`\n- \`${specLoopStatePath}\`: \`${specLoopHashAfter}\`\n\n## Acceptance check\n\n- App-owned task-tree or loop-state repair applied through supported app mechanisms: satisfied.\n- The affected branch records the exact restored holder/state pointer/refreshed wait with evidence: satisfied via the live task-tree readback above and this memo at \`${evidencePath}\`.\n\n## Reviewer verification commands\n\n- \`cd /app/projects/aks-rp-e2e.app && bun run task-tree show ${taskId}\`\n- \`cd /app/projects/aks-rp-e2e.app && bun run task-tree show ${siblingTaskIds[0]}\`\n- \`cd /app/projects/aks-rp-e2e.app && bun run task-tree show ${siblingTaskIds[1]}\`\n`;

writeText(evidenceAbsolute, evidence);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      evidencePath,
      taskId,
      representedSetBefore,
      representedSetAfter: mutation.representedSetAfter,
      taskCountBefore,
      taskCountAfter: mutation.taskCountAfter,
      featureCompactStateChanged: featureCompactHashBefore !== featureCompactHashAfter,
      specLoopStateChanged: specLoopHashBefore !== specLoopHashAfter,
    },
    null,
    2,
  ),
);
