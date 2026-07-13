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
  "a_ops-apply-recover-node-http-proxy-owner-decision-overdue-review-20260712_20260712140709";
const memoPath =
  "evidence/archive/ops-apply-recover-node-http-proxy-owner-decision-overdue-review-20260712.md";
const checkedAt = new Date().toISOString();
const nextCheckAt = "2026-07-12T15:45:00Z";
const fallbackAt = "2026-07-12T16:00:00Z";

const waitTaskId =
  "wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708";
const holderTaskId = "hold-compact-node-http-proxy-package-partial-frontier";
const featureKey = "node-http-proxy";
const specId = "spec.node-http-proxy.trusted-ca";

const waitCondition =
  "2026-07-12 overdue owner-decision review revalidated that runtime owner-return signals still show no controller-visible project.approval.submitted event or equivalent human:operator return for spec.node-http-proxy.trusted-ca after the repaired-transport resend lineage evidenced by ../aks-rp-e2e/evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md. Preserve this as the single exact owner-decision wait, keep the prepared same-lineage fallback packet, and do not route it or reopen unchanged reruns before fallback unless this exact wait reaches fallback unanswered.";
const waitResumeCondition =
  "Resume when human:operator returns one exact post-repair decision approving trusted-ca carrier redesign, declining to one explicit runtime-input wait on AKS_RP_E2E_HTTP_PROXY/AKS_RP_E2E_HTTPS_PROXY/AKS_RP_E2E_TRUSTED_CA_BASE64, or rerouting the decision surface to an exact replacement owner path after the repaired-transport resend lineage evidenced by ../aks-rp-e2e/evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md.";
const waitFallbackAction =
  "If no reviewed owner return exists by fallback, route the exact same-lineage fallback packet from ../aks-rp-e2e/evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md or replace this with a sharper escalation-ready state instead of reopening unchanged reruns.";
const waitSummary =
  "Refreshed the exact node-http-proxy trusted-ca owner-decision wait from the 2026-07-12 overdue review; no controller-visible owner return exists, so keep the same single wait, preserve the prepared fallback packet, and schedule one last pre-fallback check at 15:45Z.";

const holderCondition =
  "2026-07-12 overdue owner-decision review revalidated that node-http-proxy compact remains package-partial only because the exact downstream owner-decision wait wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708 remains unresolved and the reviewed memo ../aks-rp-e2e/evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md still found no controller-visible owner return. Keep this as the single compact-facing holder aligned to that exact downstream wait and do not reopen unchanged compact reruns or duplicate carrier state before fallback.";
const holderResumeCondition =
  "Resume only after one reviewed owner decision on spec.node-http-proxy.trusted-ca approves source-shaped redesign, declines to one explicit trusted-ca runtime-input wait, reroutes the decision surface, or accepted evidence otherwise reclassifies the carrier after the 2026-07-12 same-lineage recheck.";
const holderFallbackAction =
  "If the owner decision is still absent at fallback, refresh this compact-facing holder from the exact downstream wait or route the exact same-lineage fallback packet from ../aks-rp-e2e/evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md instead of reopening unchanged reruns.";
const holderSummary =
  "Refreshed the compact-facing node-http-proxy holder from the 2026-07-12 overdue review; no controller-visible owner return exists, so keep the same holder aligned to the exact downstream wait and schedule one last pre-fallback check at 15:45Z.";

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
      type: "owner.decision",
      taskId: waitTaskId,
      approvalPathId: "feature-compact:node-http-proxy-trusted-ca-owner-decision-20260708",
    },
    observed_by: {
      workflow: "project-planner",
      schedule: "blocked-frontier-app-ops-review",
      trigger: "project.planning.requested",
    },
    observation_method:
      "Scheduled blocked-frontier app-ops review checks the stated owner-decision wait and must unblock, replace, escalate, or keep the wait with fresh evidence.",
    next_check_at: nextCheckAt,
    resume_condition: waitResumeCondition,
    fallback_at: fallbackAt,
    fallback_action: waitFallbackAction,
  };
  waitTask.trace = {
    ...asRecord(waitTask.trace),
    blocked_wait_refreshed_at: checkedAt,
    blocked_wait_refreshed_by: "app-ops-script",
    blocked_wait_refresh_summary: waitSummary,
    previous_nonterminal_status: String(waitTask.status ?? waitTask.state ?? "blocked"),
    node_http_proxy_owner_decision_overdue_refresh_attempt_id: attemptId,
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
  };
  holderTask.trace = {
    ...asRecord(holderTask.trace),
    blocked_wait_refreshed_at: checkedAt,
    blocked_wait_refreshed_by: "app-ops-script",
    blocked_wait_refresh_summary: holderSummary,
    previous_nonterminal_status: String(holderTask.status ?? holderTask.state ?? "blocked"),
    node_http_proxy_owner_decision_overdue_refresh_attempt_id: attemptId,
  };
  holderTask.context = {
    ...asRecord(holderTask.context),
    featureCompactExactWait: true,
    featureKey,
    representedSpecIds: [specId],
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    wait: {
      waitingFor: asRecord(waitTask.blocker).waiting_for,
      nextCheckAt: asRecord(waitTask.blocker).next_check_at,
      fallbackAt: asRecord(waitTask.blocker).fallback_at,
    },
    holder: {
      waitingFor: asRecord(holderTask.blocker).waiting_for,
      nextCheckAt: asRecord(holderTask.blocker).next_check_at,
      fallbackAt: asRecord(holderTask.blocker).fallback_at,
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
    "../aks-rp-e2e/evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md",
  ]),
  summary:
    "2026-07-12 overdue refresh preserved node-http-proxy as one compact-facing holder aligned to wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708, restored explicit owner-decision linkage, added the exact frontier wait id, and moved the final pre-fallback check to 15:45Z.",
  attemptedFixes: unique([
    ...(feature.attemptedFixes ?? []),
    `${attemptId}: refreshed the exact owner-decision wait and compact-facing holder, restored explicit owner.decision/downstream wait semantics, added wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708 to frontierTaskIds, and moved the final pre-fallback check to 2026-07-12T15:45:00Z.`,
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
    "Resume when human:operator returns one exact decision approving source-shaped redesign, declining to one explicit runtime-input wait on AKS_RP_E2E_HTTP_PROXY/AKS_RP_E2E_HTTPS_PROXY/AKS_RP_E2E_TRUSTED_CA_BASE64, or rerouting the decision surface to an exact replacement owner path. Do not reopen it through the create/update pass review.",
  successorDisposition: "owner-decision-return-existing-tree-holder",
  successorStateReason:
    "The trusted-ca carrier now waits on the same-lineage owner-decision return branch after the routed packet, chase, and repaired-transport resend. No controller-visible owner return is present yet, so the exact live carrier is wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708 rather than the superseded quarantine id.",
  review: {
    ...review,
    classification: "owner_decision_return_wait",
    lastRootCause:
      "The trusted-ca carrier remains blocked on one reviewed owner-decision return after the repaired-transport resend lineage; no controller-visible project.approval.submitted return is present yet.",
    lastAction:
      "Point the spec-loop row at the exact live owner-decision-return wait wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708 and keep create/update out of scope while waiting for the owner decision.",
    reviewedAt: checkedAt,
  },
});
saveSpecLoopState(specStatePath, specState);

console.log(
  JSON.stringify(
    {
      attemptId,
      memoPath,
      checkedAt,
      treeSummary,
      compactStatePath,
      compactFeature: compactState.features[featureKey],
      specStatePath,
      specState: specState.specs[specId],
    },
    null,
    2,
  ),
);
