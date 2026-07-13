import { resolve } from "node:path";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const waitTaskId =
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708";
const sourceReviewedTaskId =
  "ops/repair-shared-underlay-runtime-input-family-recovery-lineage-20260712";
const workerTaskId =
  "ops-apply-repair-shared-underlay-runtime-input-family-recovery-lineage-2";
const attemptId =
  "a_ops-apply-repair-shared-underlay-runtime-input-family-recovery-lineage-2_20260712232657";
const evidencePath =
  "evidence/archive/ops-apply-repair-shared-underlay-runtime-input-family-recovery-lineage-2-20260712-state-repair.md";
const priorReviewEvidencePath =
  "evidence/archive/ops-repair-shared-underlay-runtime-input-family-recovery-lineage-20260712.md";
const familyReviewEvidencePath =
  "evidence/archive/ops-execute-shared-underlay-runtime-input-family-review-wave-app-ops-20260712b.md";
const futureReviewTaskId =
  "ops/review-1530-shared-underlay-runtime-input-family-lineage-20260713";
const nextCheckAt = "2026-07-13T15:30:00Z";
const fallbackAt = "2026-07-14T15:30:00Z";
const checkedAt = new Date().toISOString();

const waitSummary =
  "Normalized the shared underlay/runtime-input family wait back to a pure governed wait: the prior same-lineage recovery leaf completed and was archived, no controller-visible returned runtime-input/decline/reroute signal is present, durable send proof remains the 2026-07-08 shared packet plus the 2026-07-10 owner-return refresh packet, and the next same-lineage action is ops/review-1530-shared-underlay-runtime-input-family-lineage-20260713 without duplicate asks or unchanged reruns.";
const waitCondition =
  "Blocked on a reviewed returned shared underlay/runtime-input signal, exact decline, or authoritative reroute for the single governed shared family wait covering cilium-enterprise-addon, GPU VM-prerelease provisioner, CostAnalysis VM-prerelease, repaired serverless-schedulerctrl witnesses, spec.upgrade.vm-prerelease-deprecated-api-detection, and CCP underlay VPA same-path spec-rerun runtime-input lineage. The prior same-lineage recovery leaf ops/recover-overdue-shared-underlay-runtime-input-family-20260712 already completed and was archived after confirming no controller-visible returned signal and no truthful need for a duplicate recovery action. Durable send proof remains the 2026-07-08 shared underlay packet and the 2026-07-10 owner-return refresh packet; keep this one governed family wait plus unchanged dependent projections until an earlier reviewed return lands or the scheduled future review leaf ops/review-1530-shared-underlay-runtime-input-family-lineage-20260713 rechecks the same lineage.";
const resumeCondition =
  "Resume only when a reviewed returned signal supplies AKS_RP_E2E_UNDERLAY_KUBECONFIG(_B64), AKS_RP_E2E_CONTROL_PLANE_ID, AKS_RP_E2E_ASSIGN_IDENTITY, and/or AKS_RP_E2E_OVERLAY_RECONCILE_HEADERS as needed by the unchanged governed carriers, returns an exact decline or authoritative reroute for the same shared family lineage, or when the future review leaf ops/review-1530-shared-underlay-runtime-input-family-lineage-20260713 reaches its 2026-07-13T15:30:00Z review window and fresh same-lineage evidence must reconcile the wait.";
const fallbackAction =
  "If no reviewed return lands by the review window and the family remains unchanged, refresh this exact shared underlay/runtime-input family wait against the same 2026-07-08 / 2026-07-10 send-proof lineage or replace it only with a sharper same-lineage successor; do not create duplicate asks or reopen unchanged reruns.";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[waitTaskId];
  if (!task) throw new Error(`Task not found: ${waitTaskId}`);

  const context =
    task.context && typeof task.context === "object" && !Array.isArray(task.context)
      ? { ...(task.context as Record<string, unknown>) }
      : {};
  const trace =
    task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
      ? { ...(task.trace as Record<string, unknown>) }
      : {};
  const existingBlocker =
    task.blocker && typeof task.blocker === "object" && !Array.isArray(task.blocker)
      ? (task.blocker as Record<string, unknown>)
      : null;
  const blockedAt =
    typeof existingBlocker?.blocked_at === "string"
      ? existingBlocker.blocked_at
      : typeof trace.created_at === "string"
        ? trace.created_at
        : checkedAt;

  task.state = "blocked";
  task.status = "blocked";
  task.result = waitSummary;
  task.blocker = {
    condition: waitCondition,
    category: "external-wait",
    owner: "human",
    blocked_at: blockedAt,
    waiting_for: {
      type: "blocker.resolved",
      taskId: futureReviewTaskId,
      lineage: "shared-underlay-runtime-input-family",
    },
    observed_by: {
      workflow: "project-planner",
      schedule: "blocked-frontier-app-ops-review",
      trigger: "project.planning.requested",
    },
    observation_method:
      "Scheduled blocked-frontier app-ops review checks the shared underlay/runtime-input family wait against returned same-lineage signals and must unblock, replace, escalate, or keep the wait with fresh evidence; earlier reviewed owner-return proof may also reconcile this wait before the review window.",
    next_check_at: nextCheckAt,
    resume_condition: resumeCondition,
    resume_at: nextCheckAt,
    fallback_at: fallbackAt,
    fallback_action: fallbackAction,
  };
  task.context = {
    ...context,
    sharedUnderlayRuntimeInputFamilyWaitNormalization: {
      repairedAt: checkedAt,
      workerTaskId,
      attemptId,
      sourceReviewedTaskId,
      evidencePath,
      priorReviewEvidencePath,
      familyReviewEvidencePath,
      futureReviewTaskId,
      priorRecoveryLeafArchived:
        "ops/recover-overdue-shared-underlay-runtime-input-family-20260712",
      packetLineage: [
        "2026-07-08 shared underlay packet",
        "2026-07-10 owner-return refresh packet",
      ],
    },
  };
  task.trace = {
    ...trace,
    current_attempt_id: undefined,
    blocked_wait_refreshed_at: checkedAt,
    blocked_wait_refreshed_by: "app-ops-script",
    blocked_wait_refresh_summary: waitSummary,
    previous_nonterminal_status: String(task.status ?? task.state ?? "blocked"),
    shared_underlay_runtime_input_family_wait_normalized_at: checkedAt,
    shared_underlay_runtime_input_family_wait_normalized_by: "app-ops-script",
    shared_underlay_runtime_input_family_wait_normalization_attempt_id: attemptId,
    shared_underlay_runtime_input_family_wait_normalization_evidence_path:
      evidencePath,
  };
  task.outputs = Array.from(
    new Set([...(task.outputs ?? []), evidencePath]),
  );

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    waitTaskId,
    workerTaskId,
    attemptId,
    evidencePath,
    nextCheckAt,
    fallbackAt,
    result: task.result,
    blocker: task.blocker,
    trace: task.trace,
    outputs: task.outputs,
  };
});

console.log(JSON.stringify(result, null, 2));
