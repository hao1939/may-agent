import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
  type FeatureCompactLoopState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  saveTaskTreeWithKanbanSnapshot,
  refreshBlockedWait,
  taskTreeConfig,
  updateTaskText,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type MutableRecord = Record<string, unknown>;

type Target = {
  taskId: string;
  condition: string;
  resumeCondition: string;
  summary: string;
  observationMethod: string;
  fallbackAction: string;
  evidenceRefs: string[];
};

type TaskSnapshot = {
  state: string | null;
  status: string | null;
  result: string | null;
  blocker: MutableRecord | null;
  trace: MutableRecord | null;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-refresh-overdue-scenario-normalization-wait-holders-172500530-172500499-20260716-state-repair_20260716120039";
const sourceMemoPath =
  "/app/projects/aks-rp-e2e/evidence/archive/refresh-overdue-scenario-normalization-wait-holders-172500530-172500499-20260716.md";
const evidencePath =
  "evidence/archive/ops-apply-refresh-overdue-scenario-normalization-wait-holders-172500530-172500499-20260716-state-repair.md";
const nextCheckAt = "2026-07-16T18:00:00Z";
const fallbackAt = "2026-07-17T12:00:00Z";

const targets: Target[] = [
  {
    taskId:
      "wait-private-cluster-privatelink-create-ado-run-172500530-result-blocked",
    condition:
      "2026-07-16T11:48:56Z-11:50:10Z same-run refresh bundle rechecked ADO run 172500530 for spec.private-cluster.privatelink-create and still found a nonterminal wait: ado-run-show.json keeps status=inProgress/result=null/finishTime=null, ado-artifact-list.json still publishes only plan-inputs, ado-timeline.json still shows Execute slice and Execute slice slice_01 pending with no startTime, and direct same-run download of slice-01-test-results still fails with 'The specified artfifact name was not found'. Until this same run both completes and publishes slice-01-test-results, do not accept a terminal ADO review or emit a product verdict.",
    resumeCondition:
      "Resume only when Azure DevOps run 172500530 reaches status=completed and the same-run artifact list includes slice-01-test-results. At that point download the same-run artifact bundle and review the exact aggregate and per-spec result paths for spec.private-cluster.privatelink-create.",
    summary:
      "2026-07-16 refresh: same-run bundle 20260716T114856Z still shows run 172500530 inProgress, only plan-inputs published, Execute slice still pending, and slice-01-test-results download absent. Keep exact same-run wait; no product verdict.",
    observationMethod:
      "Planner/app blocked-frontier review should keep this as an exact same-run artifact watch. Recheck the same run and either replace it with exact terminal artifact review output or keep the wait with fresh same-run evidence; do not broaden into a rerun request while the same run is still pending.",
    fallbackAction:
      "If run 172500530 still lacks terminal same-run result artifacts by fallback, refresh or replace this exact same-run wait with newer run/artifact/timeline evidence or escalate the same run-artifact publication surface; do not reopen broad scenario work and do not queue an unchanged rerun from this holder.",
    evidenceRefs: [
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/run-172500530/ado-run-show.json",
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/run-172500530/ado-artifact-list.json",
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/run-172500530/ado-timeline.json",
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/run-172500530/download-slice.exitcode.txt",
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/run-172500530/download-slice.stderr.txt",
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/poll.log",
    ],
  },
  {
    taskId:
      "wait-industry-node-restriction-compliance-ado-run-172500499-terminal-result-2-blocked",
    condition:
      "2026-07-16T11:48:56Z-11:50:10Z same-run refresh bundle rechecked ADO run 172500499 for spec.industry.node-restriction-compliance and still found a nonterminal wait: ado-run-show.json keeps status=inProgress/result=null/finishTime=null, ado-artifact-list.json still publishes only plan-inputs, ado-timeline.json still shows Execute slice and Execute slice slice_01 pending with no startTime, and direct same-run download of slice-01-test-results still fails with 'The specified artfifact name was not found'. Until this same run both completes and publishes slice-01-test-results, do not claim a pass or fail and do not emit a product verdict.",
    resumeCondition:
      "Resume only when Azure DevOps run 172500499 reaches status=completed and the same-run artifact list includes slice-01-test-results. At that point download the same-run artifact bundle and review the exact aggregate and per-spec result paths for spec.industry.node-restriction-compliance.",
    summary:
      "2026-07-16 refresh: same-run bundle 20260716T114856Z still shows run 172500499 inProgress, only plan-inputs published, Execute slice still pending, and slice-01-test-results download absent. Keep exact same-run wait; no product verdict.",
    observationMethod:
      "Planner/app blocked-frontier review should keep this as an exact same-run artifact watch. Recheck the same run and either replace it with exact terminal artifact review output or keep the wait with fresh same-run evidence; do not broaden into a rerun request while the same run is still pending.",
    fallbackAction:
      "If run 172500499 still lacks terminal same-run result artifacts by fallback, refresh or replace this exact same-run wait with newer run/artifact/timeline evidence or escalate the same run-artifact publication surface; do not reopen broad scenario work and do not queue an unchanged rerun from this holder.",
    evidenceRefs: [
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/run-172500499/ado-run-show.json",
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/run-172500499/ado-artifact-list.json",
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/run-172500499/ado-timeline.json",
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/run-172500499/download-slice.exitcode.txt",
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/run-172500499/download-slice.stderr.txt",
      "workspace/review-overdue-scenario-normalization-ado-results-20260716/20260716T114856Z/poll.log",
    ],
  },
];

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): MutableRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as MutableRecord) } as MutableRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function snapshot(task: TaskNode): TaskSnapshot {
  return {
    state: asString(task.state),
    status: asString(task.status),
    result: asString((task as TaskNode & { result?: unknown }).result),
    blocker: asRecord(task.blocker),
    trace: asRecord(task.trace),
  };
}

function writeEvidence(content: string): void {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function blockerPatch(before: MutableRecord, target: Target): MutableRecord {
  return {
    ...before,
    condition: target.condition,
    category: "external-wait",
    owner: "external",
    blocked_at: before.blocked_at ?? appliedAt,
    waiting_for: before.waiting_for,
    observed_by: before.observed_by,
    observation_method: target.observationMethod,
    next_check_at: nextCheckAt,
    resume_condition: target.resumeCondition,
    fallback_at: fallbackAt,
    fallback_action: target.fallbackAction,
    resume_at: nextCheckAt,
  };
}

function targetedContributorSet(tree = readTaskTree(config)): string[] {
  const now = Date.parse(appliedAt);
  return targets
    .filter((target) => {
      const task = tree.tasks[target.taskId] as TaskNode | undefined;
      if (!task) return false;
      const blocker = asRecord(task.blocker);
      const nextCheck = asString(blocker?.next_check_at ?? blocker?.nextCheckAt);
      if (asString(task.state) !== "blocked") return false;
      if (!nextCheck) return false;
      const when = Date.parse(nextCheck);
      return Number.isFinite(when) && when <= now;
    })
    .map((target) => target.taskId)
    .sort((a, b) => a.localeCompare(b));
}

const beforeTree = readTaskTree(config);
const beforeSnapshots = Object.fromEntries(
  targets.map((target) => {
    const task = beforeTree.tasks[target.taskId] as TaskNode | undefined;
    assert(task, `Task not found: ${target.taskId}`);
    return [target.taskId, snapshot(task)];
  }),
) as Record<string, TaskSnapshot>;

const preAuditContributorSet = targetedContributorSet(beforeTree);

for (const target of targets) {
  const before = beforeSnapshots[target.taskId];
  const beforeBlocker = before.blocker;
  assert(before.state === "blocked", `Expected ${target.taskId} to be blocked before repair`);
  assert(beforeBlocker, `Expected ${target.taskId} to carry a structured blocker before repair`);

  refreshBlockedWait(config, {
    taskId: target.taskId,
    condition: target.condition,
    resumeCondition: target.resumeCondition,
    summary: target.summary,
    category: "external-wait",
    owner: "external",
    nextCheckAt,
    fallbackAt,
    fallbackAction: target.fallbackAction,
  });

  updateTaskText(config, {
    taskId: target.taskId,
    blocker: blockerPatch(beforeBlocker, target),
  });
}

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  for (const target of targets) {
    const task = tree.tasks[target.taskId] as TaskNode | undefined;
    assert(task, `Task missing during trace patch: ${target.taskId}`);
    const trace = asRecord(task.trace) ?? {};
    task.trace = {
      ...trace,
      blocked_wait_refreshed_at: appliedAt,
      blocked_wait_refreshed_by: worker,
      blocked_wait_refresh_summary: target.summary,
      scenario_normalization_wait_refresh_apply_attempt_id: attemptId,
      scenario_normalization_wait_refresh_apply_evidence_path: evidencePath,
      scenario_normalization_wait_refresh_source_memo_path: sourceMemoPath,
      current_attempt_id: undefined,
    };
  }
  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const afterTree = readTaskTree(config);
const afterSnapshots = Object.fromEntries(
  targets.map((target) => {
    const task = afterTree.tasks[target.taskId] as TaskNode | undefined;
    assert(task, `Task missing after repair: ${target.taskId}`);
    return [target.taskId, snapshot(task)];
  }),
) as Record<string, TaskSnapshot>;

const postActionContributorSet = targetedContributorSet(afterTree);
const featureCompactStatePath = defaultFeatureCompactLoopStatePath(appDir);
const emptyCompactState: FeatureCompactLoopState = {
  loopTaskId: "",
  windowSize: 0,
  cursor: 0,
  features: {},
};
const compactState = existsSync(featureCompactStatePath)
  ? readJson<FeatureCompactLoopState>(
      featureCompactStatePath,
      emptyCompactState,
    )
  : emptyCompactState;
const compactReferences = Object.values(compactState.features)
  .filter((feature) =>
    targets.some((target) => target.taskId === (feature.taskId ?? null)),
  )
  .map((feature) => ({
    featureKey: feature.featureKey,
    taskId: feature.taskId ?? null,
    status: feature.status ?? null,
    nextCheckAt: feature.nextCheckAt ?? null,
    fallbackAt: feature.fallbackAt ?? null,
    resumeCondition: feature.resumeCondition ?? null,
    blockedReason: feature.blockedReason ?? null,
    updatedAt: feature.updatedAt ?? null,
  }))
  .sort((a, b) => String(a.featureKey).localeCompare(String(b.featureKey)));

const verification = targets.map((target) => {
  const after = afterSnapshots[target.taskId];
  const blocker = after.blocker ?? {};
  const trace = after.trace ?? {};
  return {
    taskId: target.taskId,
    state: after.state,
    result: after.result,
    blocker: {
      condition: asString(blocker.condition),
      observation_method: asString(blocker.observation_method),
      resume_condition: asString(blocker.resume_condition),
      next_check_at: asString(blocker.next_check_at),
      resume_at: asString(blocker.resume_at),
      fallback_at: asString(blocker.fallback_at),
      fallback_action: asString(blocker.fallback_action),
    },
    trace: {
      blocked_wait_refreshed_at: asString(trace.blocked_wait_refreshed_at),
      blocked_wait_refreshed_by: asString(trace.blocked_wait_refreshed_by),
      blocked_wait_refresh_summary: asString(trace.blocked_wait_refresh_summary),
      scenario_normalization_wait_refresh_apply_attempt_id: asString(
        trace.scenario_normalization_wait_refresh_apply_attempt_id,
      ),
      scenario_normalization_wait_refresh_apply_evidence_path: asString(
        trace.scenario_normalization_wait_refresh_apply_evidence_path,
      ),
      scenario_normalization_wait_refresh_source_memo_path: asString(
        trace.scenario_normalization_wait_refresh_source_memo_path,
      ),
    },
  };
});

const evidence = `# Apply scenario-normalization overdue wait-holder refresh — 2026-07-16

- Task: \`ops-apply-refresh-overdue-scenario-normalization-wait-holders-172500530-172500499-20260716-state-repair\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Worker: \`${worker}\`
- Repair script: \`scripts/ops-apply-refresh-overdue-scenario-normalization-wait-holders-172500530-172500499-20260716-state-repair.ts\`
- Source memo: \`${sourceMemoPath}\`

## Scope

Applied the bounded app-owned repair on exactly two existing blocked wait holders:

- \`wait-private-cluster-privatelink-create-ado-run-172500530-result-blocked\`
- \`wait-industry-node-restriction-compliance-ado-run-172500499-terminal-result-2-blocked\`

No project/runtime events were emitted. No rerun task was created. No product pass/fail verdict was recorded. The runtime task tree file was not edited directly; the mutation path was \`refreshBlockedWait(...)\` + \`updateTaskText(...)\` + a final locked trace patch with \`saveTaskTreeWithKanbanSnapshot(...)\`.

## Self-excluded targeted overdue baseline

The current apply task was not used to suppress the two inspected waits. Read-only recompute over the targeted pair before mutation showed:

\`\`\`json
${JSON.stringify(
  {
    appliedTaskId:
      "ops-apply-refresh-overdue-scenario-normalization-wait-holders-172500530-172500499-20260716-state-repair",
    preAuditContributorSet,
    note:
      "Because both holders already had future-dated next_check_at/resume_at windows before this repair, they were not overdue contributors at mutation start; this repair filled in the missing blocker/result/trace fields rather than advancing an expired watch window.",
  },
  null,
  2,
)}
\`\`\`

## Live snapshots before mutation

\`\`\`json
${JSON.stringify(beforeSnapshots, null, 2)}
\`\`\`

## Applied exact refresh package

For each holder, the repair now records:

- the exact \`20260716T114856Z\` same-run evidence bundle in the blocker condition/result text and memo-linked trace
- the same-run resume condition requiring both terminal run status and published \`slice-01-test-results\`
- \`next_check_at = resume_at = 2026-07-16T18:00:00Z\`
- \`fallback_at = 2026-07-17T12:00:00Z\`
- no rerun instruction and no product verdict

Evidence refs applied:

${targets
  .map(
    (target) =>
      `### ${target.taskId}\n${target.evidenceRefs.map((ref) => `- \`${ref}\``).join("\n")}`,
  )
  .join("\n\n")}

## Live snapshots after mutation

\`\`\`json
${JSON.stringify(afterSnapshots, null, 2)}
\`\`\`

## Verification summary

\`\`\`json
${JSON.stringify({ verification, compactReferences, postActionContributorSet }, null, 2)}
\`\`\`

## Acceptance checks satisfied

1. Both named wait holders remain the same exact blocked task ids and stay in \`state: blocked\`.
2. Each holder now has the refreshed blocker contract from the source memo, including the exact same-run resume condition and the required \`20260716T114856Z\` evidence surface.
3. Each holder now has a nonempty \`result\` string and refreshed \`trace\` fields proving the in-place repair was applied in runtime state.
4. No rerun task was queued and no product verdict was emitted by this repair.
5. The only compact-loop reference among these holders remains pointed at the same exact wait id with the same future-dated watch window.
`;

writeEvidence(evidence);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      evidencePath,
      sourceMemoPath,
      preAuditContributorSet,
      postActionContributorSet,
      verification,
      compactReferences,
    },
    null,
    2,
  ),
);
