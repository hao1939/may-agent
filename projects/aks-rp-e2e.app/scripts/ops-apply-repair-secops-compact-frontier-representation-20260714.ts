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

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ];
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

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const worker = process.env.WORKER ?? "app-ops";
const now = new Date().toISOString();

const featureKey = "secops";
const loopTaskId = "aks-feature-compact-loop";
const compactTaskId = "hold-compact-secops-package-partial-frontier-20260714";
const memoPath =
  "evidence/archive/metric-alert-3655-fix-root-cause-20260714.md";
const representedTaskIds = [
  "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
  "wait-secops-identity-sp-workflow-secret-contract-return-20260704",
  "wait-secops-identity-user-assigned-row153-runtime-return-20260709",
  "wait-secops-identity-system-assigned-breadth-execute-approval-return-20260710",
  "hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708",
  "wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708",
  "hold-spec-shared-authenticated-artifact-result-recovery-family-20260714",
] as const;

const blockerCondition =
  "Represented by the current exact secops compact split frontier: wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702 for automatic-sku capacity recovery, wait-secops-identity-sp-workflow-secret-contract-return-20260704 for the SP workflow-secret contract pair, wait-secops-identity-user-assigned-row153-runtime-return-20260709 for the row-153 user-assigned runtime frontier, wait-secops-identity-system-assigned-breadth-execute-approval-return-20260710 for the system-assigned breadth boundary, hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708 for the residual 5-member secops-fips no-rerun umbrella, wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708 for the terminal GitHub-auth artifact family, and hold-spec-shared-authenticated-artifact-result-recovery-family-20260714 for the shared-auth returned-run artifact/result recovery family covering the secops-fips slice1/shared-cluster branch. Do not reopen an unchanged broad secops compact rerun while those represented blockers remain true.";
const resumeCondition =
  "Resume only when one of the represented exact secops frontier carriers materially changes, returns a bounded decision, or is replaced by a sharper same-lineage holder; then reopen only the changed secops branch instead of broad-rerunning the whole compact package.";
const fallbackAction =
  "If the same represented secops frontier is still true at fallback time, refresh this compact-facing carrier from the latest exact downstream waits and same-lineage review evidence instead of reopening an unchanged broad secops rerun.";
const ownerReason =
  "All feature-owned specs are already selected into the compact package, so the remaining controller-visible secops compact frontier is the current exact split across shared capacity, workflow-secret, runtime, breadth-boundary, residual FIPS umbrella, terminal artifact-visibility, and shared-auth returned-run recovery carriers rather than missing package membership or a truthful broad rerun candidate.";
const lastSummary =
  "Current secops compact partial is represented by exact downstream carriers only: the automatic-sku capacity-family wait, the SP workflow-secret contract wait, the row-153 runtime wait, the system-assigned breadth boundary wait, the residual secops-fips mixed-frontier umbrella, the terminal GitHub-auth artifact-visibility family, and the shared-auth returned-run artifact/result recovery family. No broad compact rerun is truthful. See evidence/archive/metric-alert-3655-fix-root-cause-20260714.md.";
const summary =
  "App-owned secops compact state now points at a truthful compact-facing frontier holder with explicit exact downstream carrier ids, restoring live representation for the remaining secops package-partial frontier.";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const treeRepair = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[loopTaskId];
  if (!loopTask) throw new Error(`Task not found: ${loopTaskId}`);

  for (const taskId of representedTaskIds) {
    const task = tree.tasks[taskId];
    if (!task) throw new Error(`Represented frontier task missing: ${taskId}`);
    if (task.state !== "blocked") {
      throw new Error(
        `Represented frontier task must stay blocked: ${taskId}=${String(task.state)}`,
      );
    }
  }

  const existing = tree.tasks[compactTaskId];
  const holder: TaskNode =
    existing ??
    ({
      id: compactTaskId,
      parent_id: loopTaskId,
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal:
        "Hold compact feature secops on exact package-partial wait until the named condition changes.",
      inputs: [
        "feature:secops",
        "errorClass:package-partial",
        "target:staging",
        "state:.state/feature-compact-loop/state.json",
      ],
      outputs: [".state/feature-compact-loop/state.json", "evidence/archive/"],
      acceptance: [
        "The holder remains blocked only while the represented exact secops frontier carriers remain true.",
        "Resume by reopening only the changed secops branch when one represented carrier materially changes.",
        "Do not broad-rerun the secops compact package while the same represented frontier remains unchanged.",
      ],
      forbidden: [],
      conflict_scope: [
        "feature-compact:secops",
        "feature:secops",
        "feature-compact-wait:package-partial",
      ],
      depends_on: [],
      trace: {
        created_at: now,
        created_by: worker,
      },
    } as TaskNode);

  holder.parent_id = loopTaskId;
  holder.state = "blocked";
  holder.status = "blocked";
  holder.owner = "aks-explorer";
  holder.goal =
    "Hold compact feature secops on exact package-partial wait until the named condition changes.";
  holder.inputs = [
    "feature:secops",
    "errorClass:package-partial",
    "target:staging",
    "state:.state/feature-compact-loop/state.json",
  ];
  holder.outputs = [".state/feature-compact-loop/state.json", "evidence/archive/"];
  holder.acceptance = [
    "The holder remains blocked only while the represented exact secops frontier carriers remain true.",
    "Resume by reopening only the changed secops branch when one represented carrier materially changes.",
    "Do not broad-rerun the secops compact package while the same represented frontier remains unchanged.",
  ];
  holder.conflict_scope = [
    "feature-compact:secops",
    "feature:secops",
    "feature-compact-wait:package-partial",
  ];
  holder.context = {
    ...asRecord(holder.context),
    featureCompactExactWait: true,
    featureKey,
    errorClass: "package-partial",
    target: "staging",
    compactFrontierTaskIds: [...representedTaskIds],
    frontierTaskIds: [...representedTaskIds],
    reviewEvidencePath: memoPath,
  };
  holder.blocker = {
    condition: blockerCondition,
    category: "external-wait",
    owner: "human",
    blocked_at:
      asRecord(holder.blocker).blocked_at &&
      typeof asRecord(holder.blocker).blocked_at === "string"
        ? (asRecord(holder.blocker).blocked_at as string)
        : now,
    waiting_for: {
      type: "compact.frontier.changed",
      taskId: compactTaskId,
      featureKey,
      target: "staging",
      errorClass: "package-partial",
      scope: "feature-compact",
    },
    observed_by: {
      workflow: "project-planner",
      schedule: "blocked-frontier-app-ops-review",
      trigger: "project.planning.requested",
    },
    observation_method:
      "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
    resume_condition: resumeCondition,
    next_check_at: "2026-07-14T18:00:00Z",
    fallback_at: "2026-07-15T18:00:00Z",
    fallback_action: fallbackAction,
  };
  holder.result =
    "Compact-facing secops frontier holder restored so the loop root is represented by the exact current downstream secops waits and review families rather than an unrepresented package-partial residue.";
  holder.trace = {
    ...asRecord(holder.trace),
    repaired_at: now,
    repaired_by: worker,
    represented_frontier_task_ids: [...representedTaskIds],
  };

  tree.tasks[compactTaskId] = holder;
  const loopChildren = asStringArray(loopTask.children);
  if (!loopChildren.includes(compactTaskId)) {
    loopTask.children = [...loopChildren, compactTaskId];
  }

  const loopContext = asRecord(loopTask.context);
  const workflowProgress = asRecord(loopContext.workflowProgress);
  const representedFeatureKeys = unique([
    ...asStringArray(workflowProgress.representedFeatureKeys),
    featureKey,
  ]).sort((a, b) => a.localeCompare(b));
  const unrepresentedBlockedFeatureKeys = asStringArray(
    workflowProgress.unrepresentedBlockedFeatureKeys,
  ).filter((value) => value !== featureKey);
  const unrepresentedNonTerminalFeatureKeys = asStringArray(
    workflowProgress.unrepresentedNonTerminalFeatureKeys,
  ).filter((value) => value !== featureKey);
  const unrepresentedErrorFeatureKeys = asStringArray(
    workflowProgress.unrepresentedErrorFeatureKeys,
  ).filter((value) => value !== featureKey);
  const nextUnrepresentedBlockedCount = Math.max(
    0,
    (typeof workflowProgress.unrepresentedBlockedCount === "number"
      ? workflowProgress.unrepresentedBlockedCount
      : 0) - 1,
  );
  const nextUnrepresentedNonTerminalCount = Math.max(
    0,
    (typeof workflowProgress.unrepresentedNonTerminalCount === "number"
      ? workflowProgress.unrepresentedNonTerminalCount
      : 0) - 1,
  );
  const pending =
    typeof workflowProgress.pending === "number" ? workflowProgress.pending : 0;
  const running =
    typeof workflowProgress.running === "number" ? workflowProgress.running : 0;
  const blocked =
    typeof workflowProgress.blocked === "number" ? workflowProgress.blocked : 0;
  const openChildren =
    typeof workflowProgress.openChildren === "number"
      ? workflowProgress.openChildren
      : 0;
  const openSupportChildren =
    typeof workflowProgress.openSupportChildren === "number"
      ? workflowProgress.openSupportChildren
      : 0;
  const priorBlockedWaitChildren =
    typeof workflowProgress.blockedWaitChildren === "number"
      ? workflowProgress.blockedWaitChildren
      : 0;
  const priorBlockedWaitBlockedCount =
    typeof workflowProgress.blockedWaitBlockedCount === "number"
      ? workflowProgress.blockedWaitBlockedCount
      : 0;
  const nextBlockedWaitChildren = loopChildren.includes(compactTaskId)
    ? priorBlockedWaitChildren
    : priorBlockedWaitChildren + 1;
  const nextBlockedWaitBlockedCount = loopChildren.includes(compactTaskId)
    ? priorBlockedWaitBlockedCount
    : priorBlockedWaitBlockedCount + 1;
  const noRefillNow =
    pending === 0 &&
    running === 0 &&
    openChildren === 0 &&
    openSupportChildren === 0 &&
    nextUnrepresentedNonTerminalCount === 0 &&
    blocked > 0 &&
    nextBlockedWaitChildren > 0;

  loopContext.workflowProgress = {
    ...workflowProgress,
    representedFeatureKeys,
    blockedWaitChildren: nextBlockedWaitChildren,
    blockedWaitBlockedCount: nextBlockedWaitBlockedCount,
    unrepresentedBlockedCount: nextUnrepresentedBlockedCount,
    unrepresentedErrorFeatureKeys,
    unrepresentedBlockedFeatureKeys,
    unrepresentedNonTerminalCount: nextUnrepresentedNonTerminalCount,
    unrepresentedNonTerminalFeatureKeys,
    noRefillNow: noRefillNow ? true : undefined,
    reason: noRefillNow
      ? "feature-compact loop has no runnable planner or support children; the remaining frontier is exact blocked wait stewardship until a stated resume signal lands"
      : (typeof workflowProgress.reason === "string" && workflowProgress.reason) ||
        "feature-compact loop state still has non-terminal features",
    updatedAt: now,
  };
  loopTask.context = loopContext;

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return {
    holderCreated: !existing,
    loopWorkflowProgress: loopContext.workflowProgress,
    holderContext: holder.context,
    holderBlocker: holder.blocker,
  };
});

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});

const existingFeature = state.features[featureKey];
if (!existingFeature) throw new Error(`Compact feature not found: ${featureKey}`);

const beforeFeature = {
  taskId: existingFeature.taskId ?? null,
  frontierTaskIds: existingFeature.frontierTaskIds ?? null,
  ownerReason: existingFeature.ownerReason ?? null,
  lastSummary: existingFeature.lastSummary ?? null,
};

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  errorClass: "package-partial",
  taskId: compactTaskId,
  frontierTaskIds: [...representedTaskIds],
  retryable: false,
  retryReason: resumeCondition,
  blockedReason: blockerCondition,
  waitingFor: {
    type: "compact.frontier.changed",
    taskId: compactTaskId,
    featureKey,
    target: "staging",
    errorClass: "package-partial",
    scope: "feature-compact",
  },
  waitingCondition: resumeCondition,
  observedBy: {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.planning.requested",
  },
  observationMethod:
    "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  nextCheckAt: "2026-07-14T18:00:00Z",
  blockerOwner: "human",
  fallbackAt: "2026-07-15T18:00:00Z",
  fallbackAction,
  ownerReason,
  lastSummary,
  summary,
  reviewEvidencePath: memoPath,
  evidencePaths: unique([memoPath, ...(existingFeature.evidencePaths ?? [])]),
  attemptedFixes: unique([
    ...(existingFeature.attemptedFixes ?? []),
    "Restored a compact-facing secops frontier holder that explicitly names the current exact downstream secops waits/review families and cleared stale unrepresented loop-root residue.",
  ]),
  lastCheckedAt: now,
});

saveFeatureCompactLoopState(path, state);

const afterFeature = state.features[featureKey];

console.log(
  JSON.stringify(
    {
      memoPath,
      paths: {
        compactStatePath: path,
      },
      representedTaskIds,
      treeRepair,
      beforeFeature,
      afterFeature: {
        taskId: afterFeature?.taskId ?? null,
        frontierTaskIds: afterFeature?.frontierTaskIds ?? null,
        ownerReason: afterFeature?.ownerReason ?? null,
        lastSummary: afterFeature?.lastSummary ?? null,
        reviewEvidencePath: afterFeature?.reviewEvidencePath ?? null,
        nextCheckAt: afterFeature?.nextCheckAt ?? null,
      },
    },
    null,
    2,
  ),
);
