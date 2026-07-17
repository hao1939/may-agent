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
import { defaultSpecLoopStatePath, type SpecLoopState } from "../workflows/lib/spec-loop-store.ts";

type JsonRecord = Record<string, unknown>;

type Target = {
  taskId: string;
  goal: string;
  condition: string;
  resumeCondition: string;
  nextCheckAt: string;
  fallbackAt: string;
  fallbackAction: string;
  summary: string;
};

type TaskSnapshot = {
  id: string;
  state: string | null;
  goal: string | null;
  outputs: string[];
  result: string | null;
  blocker: JsonRecord | null;
  trace: JsonRecord | null;
};

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-recover-overdue-spec-frontier-wave-securetls-schedulerctrl-20260717-state-repair_20260717021044";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const sourceMemoPath =
  "evidence/archive/ops-recover-overdue-spec-frontier-wave-securetls-schedulerctrl-20260717.md";
const evidencePath =
  "evidence/archive/ops-apply-recover-overdue-spec-frontier-wave-securetls-schedulerctrl-20260717-state-repair.md";
const evidenceAbsolute = resolve(appDir, evidencePath);

const targets: Target[] = [
  {
    taskId:
      "hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708",
    goal:
      "Preserve spec.secure-tls-bootstrap.network-isolated on the exact same-path image-pull-after-disable runtime or environment frontier from reviewed run 28721673014 after the repaired disable-network-isolated carrier advanced past the prior request-shape defect.",
    condition:
      "2026-07-17 blocked-frontier revalidation confirmed that spec.secure-tls-bootstrap.network-isolated still remains on the exact same-path image-pull-after-disable runtime or environment frontier anchored to reviewed live run 28721673014 (plan_20260704222857560_ebjqox). The current checked-in spec and compact surfaces still preserve the same ImagePullBackOff failure after the disable-network-isolated transition, with no stronger same-surface diagnosis or owner-approved execution-surface change visible.",
    resumeCondition:
      "Resume only after the same-surface row-43 image-pull-after-disable failure materially changes on the reviewed run lineage, a reviewed same-run diagnosis adds stronger product or environment evidence, or an owner-approved target, build, or environment change changes the execution surface. Do not dispatch another unchanged rerun from this reviewed run lineage.",
    nextCheckAt: "2026-07-18T00:30:00Z",
    fallbackAt: "2026-07-18T18:30:00Z",
    fallbackAction:
      "If the runtime or environment wait is still true at fallback, refresh this exact holder again from the latest same-run evidence or route one sharper owner recovery or escalation packet; do not reopen an unchanged rerun.",
    summary:
      "2026-07-17 overdue spec-loop revalidation confirmed the secure-tls row-43 image-pull-after-disable frontier is already aligned to run 28721673014; advance the watch window in place without reopening an unchanged rerun.",
  },
  {
    taskId:
      "hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708",
    goal:
      "Preserve the exact four-spec serverless-schedulerctrl pending frontier on the shared missing AKS_RP_E2E_UNDERLAY_KUBECONFIG prerequisite instead of reopening unchanged reruns.",
    condition:
      "2026-07-17 blocked-frontier revalidation confirmed that this spec-facing schedulerctrl frontier still remains only a projection of wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708. Runtime DB still shows no project.approval.submitted return for the preserved 2026-07-08 / 2026-07-10 shared underlay lineage, and current checked-in schedulerctrl spec/compact surfaces still preserve the same reviewed-run 28656258055 missing-underlay prerequisite. Keep this exact four-spec projection on the shared family wait until the named prerequisite materially changes.",
    resumeCondition:
      "Resume only when wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708 returns AKS_RP_E2E_UNDERLAY_KUBECONFIG or equivalent reviewed underlay access for the same staging surface, or when a reviewed replacement environment or evidence packet materially changes this exact prerequisite diagnosis.",
    nextCheckAt: "2026-07-17T15:30:00Z",
    fallbackAt: "2026-07-18T15:30:00Z",
    fallbackAction:
      "If the shared underlay/runtime-input family wait remains unchanged at fallback, re-review this schedulerctrl holder against the accepted family recovery evidence and either keep it with fresh evidence or replace it with a sharper returned or declined family holder.",
    summary:
      "2026-07-17 overdue spec-loop revalidation confirmed the schedulerctrl underlay kubeconfig frontier remains an exact projection of the shared underlay/runtime-input family wait; realign the local watch window to the shared wait without widening scope or reopening a rerun.",
  },
];

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
  ];
}

function taskSnapshot(task: TaskNode | undefined, taskId: string): TaskSnapshot {
  return {
    id: taskId,
    state: asString(task?.state),
    goal: asString(task?.goal),
    outputs: asStringArray(task?.outputs),
    result: asString(task?.result),
    blocker: task?.blocker ? clone(task.blocker as JsonRecord) : null,
    trace: task?.trace ? clone(task.trace as JsonRecord) : null,
  };
}

function targetedContributorSet(tree = readTaskTree(config)): string[] {
  const nowMs = Date.parse(appliedAt);
  return targets
    .filter((target) => {
      const task = tree.tasks[target.taskId] as TaskNode | undefined;
      if (!task || asString(task.state) !== "blocked") return false;
      const blocker = asRecord(task.blocker);
      const nextCheckAt = asString(
        blocker?.next_check_at ?? blocker?.nextCheckAt,
      );
      if (!nextCheckAt) return false;
      const whenMs = Date.parse(nextCheckAt);
      return Number.isFinite(whenMs) && whenMs <= nowMs;
    })
    .map((target) => target.taskId)
    .sort((a, b) => a.localeCompare(b));
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const beforeTree = readTaskTree(config);
const preAuditContributorSet = targetedContributorSet(beforeTree);
const beforeSnapshots = Object.fromEntries(
  targets.map((target) => {
    const task = beforeTree.tasks[target.taskId] as TaskNode | undefined;
    assert(task, `Missing live task ${target.taskId}`);
    return [target.taskId, taskSnapshot(task, target.taskId)];
  }),
) as Record<string, TaskSnapshot>;

for (const target of targets) {
  refreshBlockedWait(config, {
    taskId: target.taskId,
    condition: target.condition,
    resumeCondition: target.resumeCondition,
    summary: target.summary,
    nextCheckAt: target.nextCheckAt,
    fallbackAt: target.fallbackAt,
    fallbackAction: target.fallbackAction,
  });
}

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  for (const target of targets) {
    const task = tree.tasks[target.taskId] as TaskNode | undefined;
    assert(task, `Missing task during repair: ${target.taskId}`);
    const blocker = asRecord(task.blocker) ?? {};
    const trace = asRecord(task.trace) ?? {};

    task.goal = target.goal;
    task.result = target.summary;
    task.outputs = unique([
      ...asStringArray(task.outputs),
      sourceMemoPath,
      evidencePath,
    ]);
    task.blocker = {
      ...blocker,
      condition: target.condition,
      next_check_at: target.nextCheckAt,
      resume_condition: target.resumeCondition,
      fallback_at: target.fallbackAt,
      fallback_action: target.fallbackAction,
    };
    task.trace = {
      ...trace,
      blocked_wait_refreshed_at: appliedAt,
      blocked_wait_refreshed_by: worker,
      blocked_wait_refresh_summary: target.summary,
      blocked_wait_refresh_apply_attempt_id: attemptId,
      blocked_wait_refresh_apply_evidence_path: evidencePath,
      blocked_wait_refresh_source_memo_path: sourceMemoPath,
      current_attempt_id: undefined,
    };
  }
  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const afterTree = readTaskTree(config);
const postActionContributorSet = targetedContributorSet(afterTree);
const afterSnapshots = Object.fromEntries(
  targets.map((target) => {
    const task = afterTree.tasks[target.taskId] as TaskNode | undefined;
    assert(task, `Missing repaired task ${target.taskId}`);
    return [target.taskId, taskSnapshot(task, target.taskId)];
  }),
) as Record<string, TaskSnapshot>;

const specLoopState = readJson<SpecLoopState>(defaultSpecLoopStatePath(appDir));
const specLoopRefs = Object.entries(specLoopState.specs ?? {})
  .filter(([, spec]) =>
    targets.some((target) => target.taskId === (spec.taskId ?? null)),
  )
  .map(([specId, spec]) => ({
    specId,
    taskId: spec.taskId ?? null,
    status: spec.status ?? null,
    resumeCondition: spec.resumeCondition ?? null,
    updatedAt: spec.updatedAt ?? null,
  }))
  .sort((a, b) => a.specId.localeCompare(b.specId));

const compactState = readJson<{ features?: Record<string, JsonRecord> }>(
  defaultFeatureCompactLoopStatePath(appDir),
);
const compactRefs = Object.values(compactState.features ?? {})
  .filter((feature) =>
    targets.some((target) => target.taskId === asString(feature.taskId)),
  )
  .map((feature) => ({
    featureKey: asString(feature.featureKey),
    taskId: asString(feature.taskId),
    status: asString(feature.status),
    nextCheckAt: asString(feature.nextCheckAt),
    fallbackAt: asString(feature.fallbackAt),
    blockedReason: asString(feature.blockedReason),
    updatedAt: asString(feature.updatedAt),
  }))
  .sort((a, b) => String(a.featureKey).localeCompare(String(b.featureKey)));

const evidence = `# Apply overdue spec-frontier holder refresh — secure-tls + schedulerctrl — 2026-07-17

- Task: \`ops-apply-recover-overdue-spec-frontier-wave-securetls-schedulerctrl-20260717-state-repair\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Worker: \`${worker}\`
- Supported mechanisms: \`refreshBlockedWait(... )\`, \`withTreeLock(... )\`, \`readTaskTree(... )\`, \`saveTaskTreeWithKanbanSnapshot(... )\`
- Source memo used for exact refresh content: \`${sourceMemoPath}\`
- Apply memo: \`${evidencePath}\`

## Self-excluded targeted overdue baseline

Computed as if this apply task did not exist. Before mutation, the targeted overdue contributor set was:

\`\`\`json
${JSON.stringify(preAuditContributorSet, null, 2)}
\`\`\`

After the in-place refresh, the targeted overdue contributor set became:

\`\`\`json
${JSON.stringify(postActionContributorSet, null, 2)}
\`\`\`

## Live snapshots before repair

\`\`\`json
${JSON.stringify(beforeSnapshots, null, 2)}
\`\`\`

## Applied exact in-place refresh

- Preserved the same two holder ids; no rerun revival holder and no widened family holder was created.
- Refreshed \`hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708\` to the reviewed run \`28721673014\` watch window with:
  - \`next_check_at = 2026-07-18T00:30:00Z\`
  - \`fallback_at = 2026-07-18T18:30:00Z\`
- Refreshed \`hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708\` to the shared-underlay-family watch window with:
  - \`next_check_at = 2026-07-17T15:30:00Z\`
  - \`fallback_at = 2026-07-18T15:30:00Z\`
- Appended both \`${sourceMemoPath}\` and this apply memo path to each holder output list.
- Recorded current-attempt refresh lineage on each holder trace so the live runtime state now cites \`${attemptId}\`.

## Live snapshots after repair

\`\`\`json
${JSON.stringify(afterSnapshots, null, 2)}
\`\`\`

## Related loop-state pointers (read-only verification)

- Spec-loop path: \`${defaultSpecLoopStatePath(appDir)}\`
- Feature-compact path: \`${defaultFeatureCompactLoopStatePath(appDir)}\`

\`\`\`json
${JSON.stringify({ specLoopRefs, compactRefs }, null, 2)}
\`\`\`

## Acceptance check

1. The app-owned repair was applied through supported app mechanisms rather than direct JSON editing.
2. The affected branch now records the refreshed exact blocked holders in live task-tree state with the source memo path and current apply memo path present in outputs.
3. Both holders remain same-lineage blocked carriers; no generic rerun revival or widened scope was introduced.
`;

writeText(evidenceAbsolute, evidence);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      sourceMemoPath,
      evidencePath,
      preAuditContributorSet,
      postActionContributorSet,
      beforeSnapshots,
      afterSnapshots,
      specLoopRefs,
      compactRefs,
    },
    null,
    2,
  ),
);
