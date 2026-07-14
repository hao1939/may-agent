import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
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

type MutableRecord = Record<string, unknown>;

type SpecRepair = {
  specId: string;
  previousTaskId: string | null;
  lastRunId: string | null;
  updatedAt: string | null;
  reviewReviewedAt: string | null;
};

const attemptId =
  "a_ops_repair-secops-fips-slice1-shared-cluster-holder-drift-20260714_20260714074322";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const apply = process.argv.includes("--apply");
const repairedAt = new Date().toISOString();

const appEvidencePath =
  "evidence/archive/ops-repair-secops-fips-slice1-shared-cluster-holder-drift-20260714.md";
const domainEvidencePath =
  "../aks-rp-e2e/evidence/archive/review-spec-secops-fips-slice1-shared-cluster-ado171755307-returned-run-artifact-recovery-20260712.md";
const specLoopTaskId = "aks-spec-verification-loop";
const governingWaitTaskId =
  "ops/wait-project-approval-owner-return-primary-blocker-20260713";
const retiredSharedAuthTaskId =
  "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized";
const exactHolderTaskId =
  "hold-spec-secops-fips-slice1-shared-cluster-run-171755307-artifact-frontier-20260714";
const familyPathId = "shared-authenticated-artifact-result-recovery-family-20260712";
const sharedAuthPacketPath =
  "evidence/archive/ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md";
const sharedAuthApprovalId =
  "aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md";
const sharedAuthWaitId =
  "wait:aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md";
const splitBackOutRule =
  "If only one represented branch sharpens later, split that changed branch back out into its own exact holder (or sharper returned wait) while the unchanged sibling stays on this family carrier or its direct successor; do not reopen an unchanged rerun for both branches together.";

const specIds = [
  "spec.secops-fips.blocked-addon-boundary.slice1",
  "spec.secops-fips.blocked-addon-boundary.shared-cluster",
] as const;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
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

function stableUnique(values: string[]): string[] {
  return unique(values).sort((a, b) => a.localeCompare(b));
}

function timestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeTask(task: TaskNode | undefined) {
  if (!task) return null;
  const blocker = asRecord(task.blocker);
  const waitingFor = asRecord(blocker.waiting_for);
  return {
    id: task.id,
    parent_id: asString(task.parent_id) || null,
    state: asString(task.state) || asString((task as MutableRecord).status) || null,
    goal: asString(task.goal) || null,
    representedSpecIds: asStringArray(asRecord(task.context).representedSpecIds),
    representedRunIds: asStringArray(asRecord(task.context).representedRunIds),
    blocker: {
      condition: asString(blocker.condition) || null,
      next_check_at: asString(blocker.next_check_at) || null,
      fallback_at: asString(blocker.fallback_at) || null,
      waiting_for: {
        type: asString(waitingFor.type) || null,
        taskId: asString(waitingFor.taskId) || null,
        pathId: asString(waitingFor.pathId) || null,
        approvalId: asString(waitingFor.approvalId) || null,
        waitId: asString(waitingFor.waitId) || null,
      },
    },
  };
}

const specLoopPath = defaultSpecLoopStatePath(appDir);
const mirrorSpecLoopPath = resolve(projectDir, ".state/spec-loop/state.json");
const stateBefore = readJson<SpecLoopState>(specLoopPath);
const treeBefore = readTaskTree(config);
const loopTaskBefore = treeBefore.tasks[specLoopTaskId];
const governingWaitBefore = treeBefore.tasks[governingWaitTaskId];
const existingExactHolderBefore = treeBefore.tasks[exactHolderTaskId];
const retiredSharedAuthTaskBefore = treeBefore.tasks[retiredSharedAuthTaskId];

if (!loopTaskBefore) throw new Error(`Missing task ${specLoopTaskId}`);
if (!governingWaitBefore) throw new Error(`Missing task ${governingWaitTaskId}`);
if (retiredSharedAuthTaskBefore) {
  throw new Error(
    `Expected ${retiredSharedAuthTaskId} to be absent from live tree; task still exists with state ${asString(retiredSharedAuthTaskBefore.state) || asString((retiredSharedAuthTaskBefore as MutableRecord).status) || "(unknown)"}`,
  );
}

const governingBlocker = asRecord(governingWaitBefore.blocker);
const governingNextCheckAt =
  asString(governingBlocker.next_check_at) || repairedAt;
const governingFallbackAt = asString(governingBlocker.fallback_at) || repairedAt;
const governingResumeAt =
  asString(governingBlocker.resume_at) || governingNextCheckAt;

const specRepairs: SpecRepair[] = specIds.map((specId) => {
  const spec = stateBefore.specs[specId];
  if (!spec) throw new Error(`Missing spec-loop row for ${specId}`);
  return {
    specId,
    previousTaskId:
      typeof spec.taskId === "string" && spec.taskId.trim() ? spec.taskId : null,
    lastRunId: typeof spec.lastRunId === "string" ? spec.lastRunId : null,
    updatedAt: typeof spec.updatedAt === "string" ? spec.updatedAt : null,
    reviewReviewedAt:
      typeof asRecord(spec.review).reviewedAt === "string"
        ? (asRecord(spec.review).reviewedAt as string)
        : null,
  };
});

const unexpectedBindings = specRepairs.filter(
  (repair) =>
    repair.previousTaskId !== retiredSharedAuthTaskId &&
    repair.previousTaskId !== exactHolderTaskId,
);
if (unexpectedBindings.length > 0) {
  throw new Error(
    `Unexpected current spec-loop taskId binding(s): ${JSON.stringify(unexpectedBindings, null, 2)}`,
  );
}

const missingRunIds = specRepairs.filter((repair) => repair.lastRunId !== "171755307");
if (missingRunIds.length > 0) {
  throw new Error(
    `Expected both repaired specs to preserve lastRunId=171755307; found ${JSON.stringify(missingRunIds, null, 2)}`,
  );
}

const blockedAt =
  specRepairs
    .map((repair) =>
      timestampMs(repair.reviewReviewedAt) ?? timestampMs(repair.updatedAt),
    )
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)[0] ?? Date.now();
const blockedAtIso = new Date(blockedAt).toISOString();

const holderWaitingFor = {
  type: "project.approval.submitted",
  approvalKind: "approval-packet-dispatch",
  taskId: exactHolderTaskId,
  pathId: familyPathId,
  approvalId: sharedAuthApprovalId,
  waitId: sharedAuthWaitId,
  packetPath: sharedAuthPacketPath,
  projectPath: "projects/aks-rp-e2e.app",
  acceptedDecisions: ["approve", "adjust", "hold", "decline", "reroute"],
  representedSpecIds: [...specIds],
  representedRunIds: ["171755307"],
};

const holderTaskPlan: TaskNode = {
  id: exactHolderTaskId,
  parent_id: specLoopTaskId,
  state: "blocked",
  status: "blocked",
  kind: "domain_leaf",
  priority: "P2",
  owner: "aks-explorer",
  children: [],
  goal:
    "Preserve one exact Azure DevOps returned-run artifact-recovery holder for spec.secops-fips.blocked-addon-boundary.slice1 and spec.secops-fips.blocked-addon-boundary.shared-cluster while same-run results for run 171755307 remain unavailable and the shared-auth approval-return lineage is still pending.",
  inputs: [],
  outputs: stableUnique([domainEvidencePath, appEvidencePath]),
  acceptance: [
    "One blocked family carrier preserves only spec.secops-fips.blocked-addon-boundary.slice1 and spec.secops-fips.blocked-addon-boundary.shared-cluster under the exact ADO run 171755307 returned-run artifact-recovery frontier.",
    "Resume only when project.approval.submitted carries the shared-auth approval-return lineage, or when app-visible same-run bundle/diagnosis for ADO run 171755307 materially changes one represented branch; do not reopen an unchanged rerun first.",
    splitBackOutRule,
  ],
  forbidden: [],
  conflict_scope: specIds.map((specId) => `spec:${specId}`),
  depends_on: [],
  context: {
    representedSpecIds: [...specIds],
    representedRunIds: ["171755307"],
    retiredStaleTaskId: retiredSharedAuthTaskId,
    governingStewardTaskId: governingWaitTaskId,
    approvalFamilyPathId: familyPathId,
    splitBackOutRule,
    reviewEvidencePath: domainEvidencePath,
    appEvidencePath,
  },
  blocker: {
    condition:
      `Blocked on the exact same-run ADO 171755307 returned-run artifact-recovery frontier for slice1/shared-cluster. ${retiredSharedAuthTaskId} was already replaced by ${governingWaitTaskId}, no matching returned project.approval.submitted decision exists yet for ${familyPathId}, no app-visible per-spec spec-runner/result.json bundle is available for run 171755307, and no narrower exact holder has been published. Preserve both represented branches under one exact carrier without reopening an unchanged rerun.`,
    category: "external-wait",
    owner: "human",
    blocked_at: blockedAtIso,
    waiting_for: holderWaitingFor,
    observed_by: {
      workflow: "project-planner",
      trigger: "project.approval.submitted",
    },
    observation_method:
      `Planner/app-ops should reconcile the exact shared-auth approval return or equivalent reviewed same-run bundle/diagnosis for ADO run 171755307 into this carrier. ${splitBackOutRule}`,
    next_check_at: governingNextCheckAt,
    resume_condition:
      `Resume when project.approval.submitted carries the exact shared-auth approvalId/waitId for ${familyPathId}, when an app-visible same-run bundle appears for ADO run 171755307, when reviewed helper/result evidence materially changes one represented spec, or when a narrower exact holder truthfully replaces this carrier. ${splitBackOutRule}`,
    resume_at: governingResumeAt,
    fallback_at: governingFallbackAt,
    fallback_action:
      `If no same-lineage return lands by fallback, keep this exact holder aligned to ${governingWaitTaskId} and refresh only with sharper same-lineage evidence. ${splitBackOutRule}`,
  },
  trace: {
    created_at: repairedAt,
    created_by:
      "ops-apply-repair-secops-fips-slice1-shared-cluster-holder-drift-20260714-script",
    created_from_attempt_id: attemptId,
  },
};

const specBeforeSummary = specIds.map((specId) => {
  const spec = stateBefore.specs[specId];
  const review = asRecord(spec?.review);
  return {
    specId,
    taskId: typeof spec?.taskId === "string" ? spec.taskId : null,
    pendingReviewTaskId:
      typeof review.pendingReviewTaskId === "string"
        ? (review.pendingReviewTaskId as string)
        : null,
    successorStateReason:
      typeof spec?.successorStateReason === "string"
        ? spec.successorStateReason
        : null,
    reviewLastAction:
      typeof review.lastAction === "string" ? (review.lastAction as string) : null,
  };
});

const dryRunPlan = {
  attemptId,
  apply,
  appDir,
  projectDir,
  governingWait: summarizeTask(governingWaitBefore),
  exactHolderBefore: summarizeTask(existingExactHolderBefore),
  stalePointerBefore: {
    retiredSharedAuthTaskId,
    liveTaskPresent: Boolean(retiredSharedAuthTaskBefore),
  },
  specBindingsBefore: specBeforeSummary,
  plannedExactHolder: summarizeTask(holderTaskPlan),
  plannedSpecBindingsAfter: specIds.map((specId) => ({
    specId,
    taskId: exactHolderTaskId,
    pendingReviewTaskId: exactHolderTaskId,
  })),
  plannerApplyCommand:
    `cd ${appDir} && APP_DIR=${appDir} PROJECT_DIR=${projectDir} WORKER=app-ops bun run ./scripts/ops-apply-repair-secops-fips-slice1-shared-cluster-holder-drift-20260714.ts --apply`,
};

if (!apply) {
  console.log(JSON.stringify(dryRunPlan, null, 2));
  process.exit(0);
}

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[specLoopTaskId];
  if (!loopTask) throw new Error(`Missing task ${specLoopTaskId} during apply`);
  const governingWait = tree.tasks[governingWaitTaskId];
  if (!governingWait) {
    throw new Error(`Missing task ${governingWaitTaskId} during apply`);
  }
  if (tree.tasks[retiredSharedAuthTaskId]) {
    throw new Error(
      `Expected ${retiredSharedAuthTaskId} to stay absent during apply, but it reappeared in the live tree`,
    );
  }

  const existing = tree.tasks[exactHolderTaskId];
  if (!existing) {
    tree.tasks[exactHolderTaskId] = holderTaskPlan;
    const children = asStringArray(loopTask.children);
    if (!children.includes(exactHolderTaskId)) {
      loopTask.children = [...children, exactHolderTaskId];
    }
  } else {
    Object.assign(existing, holderTaskPlan, {
      trace: {
        ...asRecord(existing.trace),
        ...asRecord(holderTaskPlan.trace),
      },
      context: {
        ...asRecord(existing.context),
        ...asRecord(holderTaskPlan.context),
      },
    });
  }

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const stateAfterApply = readJson<SpecLoopState>(specLoopPath);
for (const specId of specIds) {
  const current = stateAfterApply.specs[specId];
  if (!current) throw new Error(`Missing spec ${specId} during apply`);
  const review = asRecord(current.review);
  review.pendingReviewTaskId = exactHolderTaskId;
  review.pendingReviewObservedAt = repairedAt;
  review.pendingReviewReason =
    "exact 171755307 slice1/shared-cluster holder restored after shared-auth steward replacement";
  review.lastAction =
    "Preserve the exact 171755307 same-run artifact-recovery blocker in spec-loop state through one exact slice1/shared-cluster holder aligned to the governing shared-auth approval-return lineage, rather than a stale shared-auth dependent wait pointer.";

  updateSpecLoopSpec(stateAfterApply, specId, {
    taskId: exactHolderTaskId,
    resumeCondition:
      "Resume when an auth-capable runtime or approved helper recovers the exact returned bundle for Azure DevOps run 171755307 and the per-spec spec-runner/result.json files can be classified, or when a narrower exact holder truthfully replaces this slice1/shared-cluster carrier.",
    successorStateReason:
      "Current 2026-07-12 review still classifies run 171755307 as exact same-run artifact recovery for slice1/shared-cluster; repair the live state pointer to one exact slice1/shared-cluster holder aligned to the governing shared-auth approval-return lineage until artifacts are recovered or a narrower exact holder replaces it.",
    review,
  });
}

saveSpecLoopState(
  specLoopPath,
  stateAfterApply,
  existsSync(mirrorSpecLoopPath) ? [mirrorSpecLoopPath] : [],
);

const treeAfter = readTaskTree(config);
const stateAfter = readJson<SpecLoopState>(specLoopPath);
console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt: repairedAt,
      exactHolderAfter: summarizeTask(treeAfter.tasks[exactHolderTaskId]),
      specBindingsAfter: specIds.map((specId) => {
        const spec = stateAfter.specs[specId];
        const review = asRecord(spec?.review);
        return {
          specId,
          taskId: typeof spec?.taskId === "string" ? spec.taskId : null,
          pendingReviewTaskId:
            typeof review.pendingReviewTaskId === "string"
              ? (review.pendingReviewTaskId as string)
              : null,
          successorStateReason:
            typeof spec?.successorStateReason === "string"
              ? spec.successorStateReason
              : null,
          reviewLastAction:
            typeof review.lastAction === "string"
              ? (review.lastAction as string)
              : null,
        };
      }),
    },
    null,
    2,
  ),
);
