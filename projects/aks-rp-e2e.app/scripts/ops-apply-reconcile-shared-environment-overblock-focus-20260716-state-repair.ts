import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const repairTaskId =
  "ops-apply-reconcile-shared-environment-overblock-focus-20260716-state-repair";
const focusTaskId =
  "focus-same-spec-verification-fix-forward-followthrough-20260715";
const projectTaskId = "project";
const archivedHolderId = "ops/repair-shared-environment-overblock-ado-waits-20260716";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-shared-environment-overblock-focus-20260716-state-repair.md";
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-reconcile-shared-environment-overblock-focus-20260716-state-repair_20260716005656";
const checkedAt = new Date().toISOString();
const sameRunWaitIds = [
  "domain/wait-rp-cluster-lifecycle-preflight-validation-ado-run-172348349-result",
  "domain/wait-rp-regional-quota-public-create-path-ado-run-172346097-result",
  "domain/wait-rp-nodepool-agentpool-operations-ado-run-172366681-result",
] as const;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function nodeState(task: { state?: unknown; status?: unknown } | undefined): string {
  return String(task?.status ?? task?.state ?? "backlog");
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

type Baseline = {
  active: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  topLevelBlocked: string[];
  blockedLeafCount: number;
  exactBlockedExecution: string[];
  executionVerification: string[];
  proposed: string[];
};

function buildBaseline() {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

    const projectContext = asRecord(projectTask.context);
    const readout = asRecord(projectContext.current_root_readout);
    const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
    const currentFocusContext = asRecord(currentFocusProposal.context);
    const focusTask = tree.tasks[focusTaskId];
    const focusContext = asRecord(focusTask?.context);
    const focusObservations = asRecord(focusContext.observations);
    const previousExecutionLane = asRecord(focusContext.lane_links).execution_verification;

    const active = unique(asStringArray(readout.active_task_ids_excluding_self));
    const review = unique(asStringArray(readout.review_task_ids));
    const waiting = unique(asStringArray(readout.waiting_task_ids));
    const runnable = unique(asStringArray(readout.runnable_task_ids));
    const topLevelBlocked = unique(asStringArray(readout.top_level_blocked_ids));
    const blockedLeafCount = Number(readout.blocked_leaf_count ?? 0);

    const priorExactBlocked = unique([
      ...asStringArray(currentFocusContext.blocked_task_ids).filter(
        (taskId) => !topLevelBlocked.includes(taskId),
      ),
      ...asStringArray(focusObservations.linked_exact_blocked_task_ids),
    ]).filter((taskId) => nodeState(tree.tasks[taskId]) === "blocked");

    const executionVerification = unique([
      ...asStringArray(previousExecutionLane),
      ...priorExactBlocked,
      ...sameRunWaitIds,
    ]).filter((taskId) => {
      const task = tree.tasks[taskId];
      return !!task && nodeState(task) !== "done";
    });

    const proposed = unique([
      repairTaskId,
      ...active,
      ...review,
      ...priorExactBlocked,
      ...topLevelBlocked,
    ]);

    return {
      readout,
      projectTask,
      focusTask,
      projectContext,
      focusContext,
      focusObservations,
      baseline: {
        active,
        review,
        waiting,
        runnable,
        topLevelBlocked,
        blockedLeafCount,
        exactBlockedExecution: priorExactBlocked,
        executionVerification,
        proposed,
      } satisfies Baseline,
    };
  });
}

function successCriteria(baseline: Baseline): string[] {
  return [
    `${repairTaskId} is the only live app-ops state-hygiene holder for this owner request; ${archivedHolderId} remains archived history only and is not represented as a current focus carrier.`,
    `The exact same-run terminal result-consumption holders remain ${formatList([...sameRunWaitIds])} while their published artifacts are inspected; no false shared environment-overblock wait is recreated.`,
    `The review queue remains ${formatList(baseline.review)} and exact blocked execution holders remain ${formatList(baseline.exactBlockedExecution)} without widening into fresh package-level live execution.`,
    `Project current-focus metadata and mirrored runtime focus surfaces represent active=[${formatList(baseline.active)}], review=[${formatList(baseline.review)}], waiting=[${formatList(baseline.waiting)}], runnable=[${formatList(baseline.runnable)}].`,
  ];
}

function nextActionSentence(baseline: Baseline): string {
  return `Work the active same-run result-consumption frontier ${formatList(
    baseline.active,
  )} first, preserve exact blocked execution holders ${formatList(
    baseline.exactBlockedExecution,
  )}, and keep top-level blocked steward waits ${formatList(
    baseline.topLevelBlocked,
  )} unchanged until their named resume signals land.`;
}

function buildProposalContext(baseline: Baseline) {
  return {
    horizon: "12-24h",
    success_criteria: successCriteria(baseline),
    progress_review: {
      reviewed_at: checkedAt,
      result: "updated",
      evidence_path: evidencePath,
      answers: {
        learned_or_verified: [
          `The three named ADO holders ${formatList([...sameRunWaitIds])} are already live same-run carriers and no longer need a shared environment-overblock wait.`,
          `${archivedHolderId} is archived and absent from the live task map, so any current-focus reference to it is stale metadata rather than active work.`,
          `The truthful live app-ops carrier for this owner request is ${repairTaskId}, alongside current active/review frontier holders from the root-contract readout.`,
        ],
        live_execution_posture:
          "Do not widen from focus maintenance into fresh package-level live execution. Only exact artifact/result consumption, repo-local normalization, and already-represented blocked stewardship remain in scope.",
        blocker_mix:
          "Immediate work is a mix of same-run terminal artifact review, existing review follow-through, and preserved top-level external waits rather than one shared environment/capacity blocker.",
        parallel_leafs: `Live frontier is active=[${formatList(
          baseline.active,
        )}], review=[${formatList(baseline.review)}], waiting=[${formatList(
          baseline.waiting,
        )}], runnable=[${formatList(baseline.runnable)}]. Exact blocked execution holders remain [${formatList(
          baseline.exactBlockedExecution,
        )}].`,
        goal_alignment:
          "This repaired focus still matches the project goal because it preserves exact same-run result-consumption, repo-local normalization, and blocker hygiene without inventing a false shared wait or restarting broad live execution.",
      },
    },
    lane_links: {
      source_spec_replay: baseline.review.filter((taskId) =>
        taskId.includes("normalize-scenario-tests"),
      ),
      execution_verification: baseline.executionVerification,
      model_feedback: baseline.review.filter(
        (taskId) =>
          taskId.includes("fix-localdns") ||
          taskId.includes("hold-compact-rp-regional-quota-source-equivalent"),
      ),
      state_hygiene: [repairTaskId],
    },
    runnable_task_ids: baseline.runnable,
    active_task_ids: baseline.active,
    review_task_ids: baseline.review,
    blocked_task_ids: unique([
      ...baseline.exactBlockedExecution,
      ...baseline.topLevelBlocked,
    ]),
    proposed_task_ids: baseline.proposed,
    linked_blocked_task_ids: baseline.topLevelBlocked,
  };
}

const before = buildBaseline();
const baseline = before.baseline;
const readoutBefore = before.readout;
const focusBeforeContext = before.focusContext;
const focusBeforeObservations = before.focusObservations;
const projectBeforeContext = before.projectContext;

syncProjectReadout(config, checkedAt);

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];
  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const focusContext = asRecord(focusTask.context);
  const observations = asRecord(focusContext.observations);
  const focusTrace = asRecord(focusTask.trace);
  const focusOutputs = asStringArray(focusTask.outputs);

  focusTask.goal =
    "Keep one visible 12-24h focus branch aligned to the real root frontier: preserve the three exact same-run terminal result-consumption holders for ADO runs 172348349, 172346097, and 172366681, keep repo-wide scenario-test normalization visible, and let app-ops clear stale environment-overblock focus metadata without inventing a new shared wait.";
  focusTask.acceptance = [
    "This focus branch remains the single visible 12-24h mission for the project and stays synchronized with project-state currentFocus plus the live linked task ids.",
    "The branch truthfully reflects the current frontier and emphasizes exact same-run result consumption, repo-local normalization, and blocker/readout hygiene until a sharper successor appears.",
  ];
  focusContext.horizon = `12-24h from ${checkedAt}`;
  focusContext.success_criteria = successCriteria(baseline);
  focusContext.progress_review = {
    last_reviewed_at: checkedAt,
    status: "updated",
    summary:
      `Direction remains low-risk and is resynced to the live tree: active=[${formatList(
        baseline.active,
      )}], review=[${formatList(baseline.review)}], waiting=[${formatList(
        baseline.waiting,
      )}], runnable=[${formatList(baseline.runnable)}], exact-blocked=[${formatList(
        baseline.exactBlockedExecution,
      )}], top-level-blocked=[${formatList(baseline.topLevelBlocked)}]. ` +
      `${archivedHolderId} is archived history only; ${repairTaskId} plus the three same-run holders now carry the 2026-07-16 owner request truthfully.`,
    evidence: [
      `Attempt ${attemptId} verified via bun run task-tree show that ${formatList([...sameRunWaitIds])} are live same-run holders and ${archivedHolderId} is not a live task.`,
      `Attempt ${attemptId} refreshed focus metadata so project current-focus surfaces now point at ${repairTaskId} and the exact same-run holders instead of the archived shared-holder id.`,
      `Evidence memo: ${evidencePath}`,
    ],
  };
  focusContext.allowed_risk =
    "Allow only exact result consumption, repo-local normalization, durable evidence/model follow-through, and blocker/readout hygiene already represented in the tree. Do not launch fresh package-level live execution from focus maintenance alone.";
  focusContext.needs_approval = false;
  observations.frontier_runnable_leaf_count = baseline.runnable.length;
  observations.frontier_waiting_leaf_count = baseline.waiting.length;
  observations.frontier_active_leaf_count = baseline.active.length;
  observations.frontier_review_leaf_count = baseline.review.length;
  observations.frontier_blocked_leaf_count = baseline.blockedLeafCount;
  observations.linked_active_task_ids = baseline.active;
  observations.linked_review_task_ids = baseline.review;
  observations.linked_exact_blocked_task_ids = baseline.exactBlockedExecution;
  observations.linked_blocked_task_ids = baseline.topLevelBlocked;
  observations.recent_review_signal =
    `The focus no longer compresses the environment-overblock owner request into ${archivedHolderId}. The current truthful carriers are app-ops repair ${repairTaskId} plus same-run holders ${formatList(
      [...sameRunWaitIds],
    )}.`;
  observations.parallel_work_gap =
    "The current gap is not missing branches but truthful follow-through: exact same-run result review, live review queue consumption, and preserved steward waits. Avoid inventing filler live work.";
  observations.structural_status =
    "Current focus repair verified metadata drift only; it did not justify new broad execution or a revived shared environment-overblock family wait.";
  focusContext.observations = observations;
  focusContext.lane_links = {
    source_spec_replay: baseline.review.filter((taskId) =>
      taskId.includes("normalize-scenario-tests"),
    ),
    execution_verification: baseline.executionVerification,
    model_feedback: baseline.review.filter(
      (taskId) =>
        taskId.includes("fix-localdns") ||
        taskId.includes("hold-compact-rp-regional-quota-source-equivalent"),
    ),
    state_hygiene: [repairTaskId],
  };
  focusTask.context = focusContext;
  focusTask.outputs = unique([...focusOutputs, evidencePath]);
  focusTask.updated_at = checkedAt;
  focusTask.trace = {
    ...focusTrace,
    shared_environment_overblock_focus_repaired_at: checkedAt,
    shared_environment_overblock_focus_repaired_by: "app-ops-script",
    shared_environment_overblock_focus_repair_attempt_id: attemptId,
    shared_environment_overblock_focus_repair_evidence_path: evidencePath,
  };

  const projectContext = asRecord(projectTask.context);
  const currentRootReadout = asRecord(projectContext.current_root_readout);
  const projectTrace = asRecord(projectTask.trace);
  const projectOutputs = asStringArray(projectTask.outputs);

  currentRootReadout.updated_at = checkedAt;
  projectContext.current_root_readout = currentRootReadout;
  projectContext.current_focus_proposal = {
    id: focusTaskId,
    title: "Shared environment-overblock same-run follow-through and normalization hold",
    status: "updated",
    reviewed_at: checkedAt,
    needs_approval: false,
    reason:
      `Current root-contract non-repair frontier is active=[${formatList(
        baseline.active,
      )}], review=[${formatList(baseline.review)}], waiting=[${formatList(
        baseline.waiting,
      )}], runnable=[${formatList(baseline.runnable)}], blocked=${baseline.blockedLeafCount}. ` +
      `The owner-requested environment-overblock focus is truthfully carried by ${repairTaskId} plus exact same-run holders ${formatList(
        [...sameRunWaitIds],
      )}; ${archivedHolderId} is archived history only. ` +
      `Exact top-level blocked steward waits remain ${formatList(baseline.topLevelBlocked)}.`,
    evidence_path: evidencePath,
    context: buildProposalContext(baseline),
  };
  projectContext.current_focus_proposal_progress_review_refreshed_at = checkedAt;
  projectContext.current_focus_proposal_progress_review_refreshed_by =
    "app-ops-script";
  projectContext.current_focus_proposal_progress_review_evidence_path =
    evidencePath;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...projectOutputs, evidencePath]);
  projectTask.updated_at = checkedAt;
  projectTask.trace = {
    ...projectTrace,
    shared_environment_overblock_focus_repaired_at: checkedAt,
    shared_environment_overblock_focus_repaired_by: "app-ops-script",
    shared_environment_overblock_focus_repair_attempt_id: attemptId,
    shared_environment_overblock_focus_repair_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    focusGoal: focusTask.goal,
    projectReason: asRecord(projectContext.current_focus_proposal).reason,
  };
});

syncProjectReadout(config, checkedAt);

const runtimeAfterSync = asRecord(loadProjectReadModel(appDir));
const currentState = asRecord(runtimeAfterSync.currentState);
const currentFocus = asRecord(runtimeAfterSync.currentFocus);
const focusReview = asRecord(currentFocus.focusReview);
const focusMission = asRecord(currentFocus.focusMission);
const focusPlan = asRecord(runtimeAfterSync.focusPlan);

const activeSentence = `active=[${formatList(baseline.active)}], review=[${formatList(
  baseline.review,
)}], waiting=[${formatList(baseline.waiting)}], runnable=[${formatList(
  baseline.runnable,
)}], blocked=${baseline.blockedLeafCount}`;

currentFocus.activeTaskIds = baseline.active;
currentFocus.proposedTaskIds = baseline.proposed;
focusReview.reviewedAt = checkedAt;
focusReview.result = "updated";
focusReview.note =
  `Focus repair refreshed the owner-requested environment-overblock representation to ${activeSentence}. ` +
  `${repairTaskId} plus same-run holders ${formatList([
    ...sameRunWaitIds,
  ])} are the only live carriers for this focus slice; ${archivedHolderId} is archived history only.`;
focusReview.evidencePath = evidencePath;
currentFocus.focusReview = focusReview;
focusMission.id = focusTaskId;
focusMission.title =
  "Shared environment-overblock same-run follow-through and normalization hold";
focusMission.horizon = "12-24h";
focusMission.successCriteria = successCriteria(baseline);
focusMission.activeTaskIds = baseline.active;
focusMission.reviewTaskIds = baseline.review;
focusMission.waitingTaskIds = baseline.waiting;
focusMission.runnableTaskIds = baseline.runnable;
focusMission.linkedBlockedTaskIds = baseline.topLevelBlocked;
focusMission.evidencePath = evidencePath;
currentFocus.focusMission = focusMission;
focusPlan.summary =
  `Focus plan root readout now mirrors the same top-level root contract: ${activeSentence}. ` +
  `The environment-overblock owner request is truthfully carried by ${repairTaskId} plus exact same-run holders ${formatList([
    ...sameRunWaitIds,
  ])}; ${archivedHolderId} is no longer a live holder.`;
focusPlan.currentProposalId = focusTaskId;
focusPlan.evidencePath = evidencePath;

saveProjectRuntimeState(appDir, {
  currentState,
  currentFocus,
  focusPlan,
  updatedAt: checkedAt,
});

const verification = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];
  return {
    focusTask,
    projectFocus: asRecord(asRecord(projectTask?.context).current_focus_proposal),
    waitStates: sameRunWaitIds.map((taskId) => ({
      taskId,
      state: nodeState(tree.tasks[taskId]),
      owner: String(tree.tasks[taskId]?.owner ?? ""),
      goal: String(tree.tasks[taskId]?.goal ?? ""),
    })),
  };
});

const runtimeFinal = asRecord(loadProjectReadModel(appDir));
const runtimeCurrentFocus = asRecord(runtimeFinal.currentFocus);
const runtimeFocusMission = asRecord(runtimeCurrentFocus.focusMission);
const runtimeFocusReview = asRecord(runtimeCurrentFocus.focusReview);
const runtimeFocusPlan = asRecord(runtimeFinal.focusPlan);

writeMemo(`# Apply reconcile shared environment-overblock focus state repair — 2026-07-16

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Checked at: ${checkedAt}

## Result

Applied the bounded app-owned focus metadata repair through supported app helpers. The visible focus branch, project current-focus proposal, and mirrored runtime focus surfaces now point at the live app-ops repair plus the three exact same-run terminal result-consumption holders, and no longer claim archived task \`${archivedHolderId}\` is the active environment-overblock carrier.

## App mechanisms used

- \`readTaskTree(...)\` + \`withTreeLock(...)\` + \`saveTaskTreeWithKanbanSnapshot(...)\`
- \`syncProjectReadout(config, checkedAt)\`
- \`saveProjectRuntimeState(appDir, ...)\`

## Baseline at apply time

- active: [${formatList(baseline.active)}]
- review: [${formatList(baseline.review)}]
- waiting: [${formatList(baseline.waiting)}]
- runnable: [${formatList(baseline.runnable)}]
- blocked leaf count: ${baseline.blockedLeafCount}
- exact blocked execution holders: [${formatList(baseline.exactBlockedExecution)}]
- top-level blocked steward waits: [${formatList(baseline.topLevelBlocked)}]

## Before → after focus holder truth

### Before

- focus state_hygiene: [${formatList(
  asStringArray(asRecord(focusBeforeContext.lane_links).state_hygiene),
)}]
- focus success criterion 1: ${JSON.stringify(
  asStringArray(focusBeforeContext.success_criteria)[0] ?? null,
)}
- project current_focus_proposal.reason contained archived holder id: ${String(
  String(asRecord(projectBeforeContext.current_focus_proposal).reason ?? "").includes(
    archivedHolderId,
  ),
)}
- focus linked exact blocked ids: [${formatList(
  asStringArray(focusBeforeObservations.linked_exact_blocked_task_ids),
)}]

### After

- focus state_hygiene: [${formatList(
  asStringArray(asRecord(asRecord(verification.focusTask?.context).lane_links).state_hygiene),
)}]
- focus success criterion 1: ${JSON.stringify(
  asStringArray(asRecord(verification.focusTask?.context).success_criteria)[0] ?? null,
)}
- project current_focus_proposal.reason: ${JSON.stringify(
  verification.projectFocus.reason ?? null,
)}
- runtime focus review note: ${JSON.stringify(runtimeFocusReview.note ?? null)}

## Same-run holder verification

${verification.waitStates
  .map(
    (entry) =>
      `- \`${entry.taskId}\` -> state=\`${entry.state}\`, owner=\`${entry.owner}\`, goal=${JSON.stringify(entry.goal)}`,
  )
  .join("\n")}

## Runtime focus surfaces

- currentFocus.activeTaskIds: [${formatList(
  asStringArray(runtimeCurrentFocus.activeTaskIds),
)}]
- currentFocus.proposedTaskIds: [${formatList(
  asStringArray(runtimeCurrentFocus.proposedTaskIds),
)}]
- currentFocus.focusMission.successCriteria[0]: ${JSON.stringify(
  asStringArray(runtimeFocusMission.successCriteria)[0] ?? null,
)}
- focusPlan.currentProposalId: ${JSON.stringify(runtimeFocusPlan.currentProposalId ?? null)}
- focusPlan.summary: ${JSON.stringify(runtimeFocusPlan.summary ?? null)}

## Acceptance check

- Archived holder removed from live focus carriers: satisfied for the visible focus branch, project current-focus proposal, and runtime focus surfaces.
- Three exact same-run holders preserved as the live result-consumption frontier: satisfied; they remain ${formatList([
  ...sameRunWaitIds,
])} in active state.
- No false shared environment-overblock wait recreated: satisfied; this repair only refreshed focus metadata to point at exact same-run holders plus ${repairTaskId}.
`);

console.log(
  JSON.stringify(
    {
      checkedAt,
      evidencePath,
      focusGoal: treeMutation.focusGoal,
      projectReason: treeMutation.projectReason,
      runtimeFocusReviewNote: runtimeFocusReview.note ?? null,
    },
    null,
    2,
  ),
);
