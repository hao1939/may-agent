import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";
import { readFileSync } from "node:fs";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);

const attemptId =
  "a_ops-apply-execute-node-http-proxy-owner-decision-fallback-window-app-ops_20260712161133";
const memoPath =
  "evidence/archive/ops-apply-execute-node-http-proxy-owner-decision-fallback-window-app-ops-20260712.md";
const checkedAt = new Date().toISOString();
const nextCheckAt = "2026-07-12T21:15:00Z";
const fallbackAt = "2026-07-13T21:15:00Z";

const waitTaskId =
  "wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708";
const holderTaskId = "hold-compact-node-http-proxy-package-partial-frontier";
const featureKey = "node-http-proxy";
const specId = "spec.node-http-proxy.trusted-ca";
const pathId =
  "feature-compact:node-http-proxy-trusted-ca-owner-decision-20260708";

const originalPacket =
  "../aks-rp-e2e/evidence/archive/route-node-http-proxy-trusted-ca-owner-decision-packet-20260708.md";
const chasePacket =
  "../aks-rp-e2e/evidence/archive/ops-chase-compact-node-http-proxy-trusted-ca-owner-decision-20260709.md";
const resendPacket =
  "../aks-rp-e2e/evidence/archive/ops-resend-node-http-proxy-trusted-ca-owner-decision-via-repaired-human-transport-20260710-packet.md";
const fallbackPacket =
  "../aks-rp-e2e/evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md";
const originalPacketRelative =
  "evidence/archive/route-node-http-proxy-trusted-ca-owner-decision-packet-20260708.md";
const chasePacketRelative =
  "evidence/archive/ops-chase-compact-node-http-proxy-trusted-ca-owner-decision-20260709.md";
const resendPacketRelative =
  "evidence/archive/ops-resend-node-http-proxy-trusted-ca-owner-decision-via-repaired-human-transport-20260710-packet.md";
const fallbackPacketRelative =
  "evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md";
const executeMemo =
  "evidence/archive/ops-execute-node-http-proxy-owner-decision-fallback-window-app-ops-20260712.md";

const resendApprovalId =
  "aks-rp-e2e:approval:feature-compact-node-http-proxy-trusted-ca-owner-decision-20260708:evidence-archive-ops-resend-node-http-proxy-trusted-ca-owner-decision-via-repaired-human-transport-20260710-packet.md";
const resendWaitId =
  "wait:aks-rp-e2e:approval:feature-compact-node-http-proxy-trusted-ca-owner-decision-20260708:evidence-archive-ops-resend-node-http-proxy-trusted-ca-owner-decision-via-repaired-human-transport-20260710-packet.md";
const fallbackApprovalId =
  "aks-rp-e2e:approval:feature-compact-node-http-proxy-trusted-ca-owner-decision-20260708:evidence-archive-ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md";
const fallbackWaitId =
  "wait:aks-rp-e2e:approval:feature-compact-node-http-proxy-trusted-ca-owner-decision-20260708:evidence-archive-ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md";

const waitCondition =
  "Blocked on the returned bounded owner decision for spec.node-http-proxy.trusted-ca after the accepted 2026-07-08 original packet, the accepted 2026-07-09 same-lineage chase, the accepted 2026-07-10 repaired-transport resend, and the acted-on 2026-07-12 same-lineage fallback dispatch evidenced by ../aks-rp-e2e/evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md plus runtime events 3091300, 3091303, and 3091304. No controller-visible project.approval.submitted return is present yet, so preserve this as the single exact owner-decision wait instead of reopening unchanged reruns or routing a duplicate ask.";
const waitResumeCondition =
  "Resume when project.approval.submitted returns one bounded decision for the repaired-transport resend approval line or the 2026-07-12 same-lineage fallback approval line on feature-compact:node-http-proxy-trusted-ca-owner-decision-20260708, selecting exactly one of: source-shaped trusted-ca carrier redesign approval, decline-to-one explicit trusted-ca runtime-input wait on AKS_RP_E2E_HTTP_PROXY/AKS_RP_E2E_HTTPS_PROXY/AKS_RP_E2E_TRUSTED_CA_BASE64, or an exact reroute naming the replacement owner surface.";
const waitFallbackAction =
  "If no matching project.approval.submitted decision arrives by the refreshed review window, keep one exact same-lineage owner-decision wait with fresh evidence or escalate only this same node-http-proxy trusted-ca lineage again; do not reopen unchanged reruns or create a second compact-facing holder.";
const waitSummary =
  "Recorded the acted-on 2026-07-12 node-http-proxy trusted-ca fallback dispatch on the existing exact wait using evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md, runtime events 3091300/3091303/3091304, and the approval-dispatch ledger row at 2026-07-12T16:03:00.469Z; preserve this as the single exact owner-decision wait and re-review for a returned project.approval.submitted decision at 21:15Z.";

const holderCondition =
  "Blocked because node-http-proxy remains package-partial only while the exact downstream owner-decision wait wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708 is still awaiting a returned bounded decision after the acted-on 2026-07-12 same-lineage fallback dispatch evidenced by ../aks-rp-e2e/evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md and runtime events 3091300, 3091303, and 3091304. Keep this as the single compact-facing holder aligned to that exact downstream wait; do not reopen unchanged compact reruns or duplicate carrier state.";
const holderResumeCondition =
  "Resume only after the exact downstream wait receives one reviewed post-fallback owner decision for spec.node-http-proxy.trusted-ca that approves source-shaped redesign, declines to one explicit trusted-ca runtime-input wait, reroutes the owner surface, or accepted evidence otherwise reclassifies the carrier.";
const holderFallbackAction =
  "If the downstream owner-decision wait is still unanswered at the refreshed review window, keep one compact-facing holder aligned to that exact wait with fresh evidence or escalate only the same node-http-proxy trusted-ca lineage again instead of reopening unchanged reruns.";
const holderSummary =
  "Recorded the acted-on 2026-07-12 node-http-proxy trusted-ca fallback dispatch on the compact-facing holder and kept it aligned to wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708 with the next owner-return review at 21:15Z.";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort(
    (a, b) => a.localeCompare(b),
  );
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const treeSummary = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const waitTask = tree.tasks[waitTaskId] as TaskNode | undefined;
  const holderTask = tree.tasks[holderTaskId] as TaskNode | undefined;
  if (!waitTask) throw new Error(`Task not found: ${waitTaskId}`);
  if (!holderTask) throw new Error(`Task not found: ${holderTaskId}`);

  const waitBlockedAt =
    asString(asRecord(waitTask.blocker).blocked_at) ?? checkedAt;
  const holderBlockedAt =
    asString(asRecord(holderTask.blocker).blocked_at) ?? checkedAt;

  waitTask.state = "blocked";
  waitTask.status = "blocked";
  waitTask.result = waitSummary;
  waitTask.blocker = {
    condition: waitCondition,
    category: "external-wait",
    owner: "human",
    blocked_at: waitBlockedAt,
    waiting_for: {
      type: "project.approval.submitted",
      approvalKind: "approval-packet-dispatch",
      taskId: waitTaskId,
      pathId,
      packetPaths: [
        originalPacketRelative,
        chasePacketRelative,
        resendPacketRelative,
        fallbackPacketRelative,
      ],
      approvalIds: [resendApprovalId, fallbackApprovalId],
      waitIds: [resendWaitId, fallbackWaitId],
      acceptedDecisions: ["approve", "adjust", "hold", "decline", "reroute"],
    },
    observed_by: {
      workflow: "project-planner",
      trigger: "project.approval.submitted",
    },
    observation_method:
      "Planner handles a matching returned project.approval.submitted event for the exact resend or fallback approvalId/waitId/pathId on this same node-http-proxy trusted-ca lineage and reconciles this wait; blocked-frontier review only refreshes evidence if no decision arrives by the stated window.",
    next_check_at: nextCheckAt,
    resume_condition: waitResumeCondition,
    fallback_at: fallbackAt,
    fallback_action: waitFallbackAction,
    resume_at: nextCheckAt,
  };
  waitTask.trace = {
    ...asRecord(waitTask.trace),
    blocked_wait_refreshed_at: checkedAt,
    blocked_wait_refreshed_by: "app-ops-script",
    blocked_wait_refresh_summary: waitSummary,
    previous_nonterminal_status: String(waitTask.status ?? waitTask.state ?? "blocked"),
    node_http_proxy_owner_decision_fallback_dispatch_refresh_attempt_id: attemptId,
  };

  holderTask.state = "blocked";
  holderTask.status = "blocked";
  holderTask.result = holderSummary;
  holderTask.blocker = {
    condition: holderCondition,
    category: "external-wait",
    owner: "product-owner",
    blocked_at: holderBlockedAt,
    waiting_for: {
      type: "owner.decision",
      taskId: waitTaskId,
      holderTaskId,
      featureKey,
      scope: "feature-compact",
      approvalPathId: pathId,
      latestApprovalId: fallbackApprovalId,
      latestWaitId: fallbackWaitId,
    },
    observed_by: {
      workflow: "feature-compact-loop-controller",
      trigger: "project.task.tick",
    },
    observation_method:
      "On each compact-loop tick, preserve this compact-facing holder while the exact downstream owner-decision wait remains unresolved; only reopen runnable work when the named wait condition changes.",
    next_check_at: nextCheckAt,
    resume_condition: holderResumeCondition,
    fallback_at: fallbackAt,
    fallback_action: holderFallbackAction,
    resume_at: nextCheckAt,
  };
  holderTask.trace = {
    ...asRecord(holderTask.trace),
    blocked_wait_refreshed_at: checkedAt,
    blocked_wait_refreshed_by: "app-ops-script",
    blocked_wait_refresh_summary: holderSummary,
    previous_nonterminal_status: String(holderTask.status ?? holderTask.state ?? "blocked"),
    node_http_proxy_owner_decision_fallback_dispatch_refresh_attempt_id: attemptId,
  };
  holderTask.context = {
    ...asRecord(holderTask.context),
    featureCompactExactWait: true,
    featureKey,
    representedSpecIds: [specId],
  };

  waitTask.outputs = unique([...(waitTask.outputs ?? []), originalPacket, fallbackPacket]);
  holderTask.outputs = unique([...(holderTask.outputs ?? []), ".state/feature-compact-loop/state.json", fallbackPacket]);

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    wait: {
      nextCheckAt: asRecord(waitTask.blocker).next_check_at,
      fallbackAt: asRecord(waitTask.blocker).fallback_at,
      waitingFor: asRecord(waitTask.blocker).waiting_for,
    },
    holder: {
      nextCheckAt: asRecord(holderTask.blocker).next_check_at,
      fallbackAt: asRecord(holderTask.blocker).fallback_at,
      waitingFor: asRecord(holderTask.blocker).waiting_for,
    },
  };
});

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const feature = compactState.features[featureKey];
if (!feature) throw new Error(`Missing compact feature state: ${featureKey}`);
updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [waitTaskId],
  retryable: false,
  retryReason: holderResumeCondition,
  blockedAt: feature.blockedAt ?? "2026-07-09T11:49:07.936Z",
  blockedReason: holderCondition,
  waitingFor: {
    type: "owner.decision",
    taskId: waitTaskId,
    holderTaskId,
    featureKey,
    scope: "feature-compact",
    approvalPathId: pathId,
    latestApprovalId: fallbackApprovalId,
    latestWaitId: fallbackWaitId,
  },
  waitingCondition: holderResumeCondition,
  observedBy: {
    workflow: "feature-compact-loop-controller",
    trigger: "project.task.tick",
  },
  observationMethod:
    "On each compact-loop tick, preserve this compact-facing holder while the exact downstream owner-decision wait remains unresolved; only reopen runnable work when the named wait condition changes.",
  nextCheckAt,
  blockerOwner: "product-owner",
  fallbackAt,
  fallbackAction: holderFallbackAction,
  reviewEvidencePath: memoPath,
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(feature.evidencePaths ?? []),
    memoPath,
    executeMemo,
    fallbackPacket,
  ]),
  summary:
    "2026-07-12 fallback-dispatch refresh preserved node-http-proxy as one compact-facing holder aligned to wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708, recorded the acted-on fallback send proof, restored the exact frontier wait id, and moved the next owner-return review to 2026-07-12T21:15:00Z.",
  attemptedFixes: unique([
    ...(feature.attemptedFixes ?? []),
    `${attemptId}: refreshed the exact owner-decision wait and compact-facing holder after the acted-on fallback dispatch, restored frontierTaskIds=[${waitTaskId}], recorded runtime send proof 3091300/3091303/3091304, and moved the next owner-return review to 2026-07-12T21:15:00Z with fallback at 2026-07-13T21:15:00Z.`,
  ]),
});
saveFeatureCompactLoopState(compactStatePath, compactState);

const specStatePath = defaultSpecLoopStatePath(appDir);
const specState = JSON.parse(readFileSync(specStatePath, "utf-8")) as SpecLoopState;
const existingSpec = specState.specs[specId];
if (!existingSpec) throw new Error(`Missing spec state: ${specId}`);
const review = asRecord(existingSpec.review);
updateSpecLoopSpec(specState, specId, {
  taskId: waitTaskId,
  resumeCondition:
    "Resume when project.approval.submitted returns one bounded decision for the repaired-transport resend or the 2026-07-12 same-lineage fallback approval on feature-compact:node-http-proxy-trusted-ca-owner-decision-20260708. Do not reopen it through the create/update pass review while this exact owner-decision lineage remains unresolved.",
  successorDisposition: "owner-decision-return-existing-tree-holder",
  successorStateReason:
    "The trusted-ca carrier remains on the same exact owner-decision-return wait after the accepted original packet, chase, repaired-transport resend, and the acted-on 2026-07-12 fallback dispatch. No controller-visible project.approval.submitted return exists yet, so keep the current live carrier as wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708.",
  review: {
    ...review,
    classification: "owner_decision_return_wait",
    lastRootCause:
      "The trusted-ca carrier is still blocked on one reviewed owner-decision return after the accepted original packet, chase, repaired-transport resend, and the acted-on 2026-07-12 fallback dispatch; no controller-visible project.approval.submitted return is present yet.",
    lastAction:
      "Keep the spec-loop row pointed at wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708, record the acted-on fallback send proof 3091300/3091303/3091304, and wait for the returned bounded owner decision instead of reopening create/update work.",
    reviewedAt: checkedAt,
  },
});
saveSpecLoopState(specStatePath, specState);

console.log(
  JSON.stringify(
    {
      checkedAt,
      waitTaskId,
      holderTaskId,
      treeSummary,
      compactState: {
        taskId: compactState.features[featureKey]?.taskId ?? null,
        frontierTaskIds: compactState.features[featureKey]?.frontierTaskIds ?? null,
        nextCheckAt: compactState.features[featureKey]?.nextCheckAt ?? null,
        fallbackAt: compactState.features[featureKey]?.fallbackAt ?? null,
        reviewEvidencePath: compactState.features[featureKey]?.reviewEvidencePath ?? null,
      },
      specState: {
        taskId: specState.specs[specId]?.taskId ?? null,
        successorDisposition: specState.specs[specId]?.successorDisposition ?? null,
        resumeCondition: specState.specs[specId]?.resumeCondition ?? null,
        review: specState.specs[specId]?.review ?? null,
      },
    },
    null,
    2,
  ),
);
