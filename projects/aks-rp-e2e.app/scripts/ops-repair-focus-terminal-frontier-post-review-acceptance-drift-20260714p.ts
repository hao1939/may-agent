import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";
import { auditFocusMetadataIssues } from "./lib/focus-metadata-audit.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const repairTaskId =
  "ops/repair-focus-terminal-frontier-post-review-acceptance-drift-20260714p";
const focusTaskId = "focus-terminal-frontier-finality-reconciliation-20260714";
const projectTaskId = "project";
const evidencePath =
  "evidence/archive/ops-repair-focus-terminal-frontier-post-review-acceptance-drift-20260714p.md";
const attemptId =
  "a_ops_repair-focus-terminal-frontier-post-review-acceptance-drift-20260714p_20260714122101";
const checkedAt = new Date().toISOString();

const rootAuditEvidencePath =
  "evidence/archive/ops-reconcile-project-root-residual-wait-family-after-localdns-hygiene-20260714.md";
const localDnsAuditEvidencePath =
  "evidence/archive/ops-reconcile-spec-localdns-frontier-family-after-mounted-source-finality-20260714.md";

const survivingRootBlockedCarrierIds = [
  "aks-spec-verification-loop",
  "aks-feature-compact-loop",
  "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
  "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
  "wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708",
  "wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709",
  "wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709",
  "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711",
  "ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized",
  "ops/review-2240-cluster-autoscaler-compact-frontier-lineage-20260713",
  "ops/wait-shared-worker-model-auth-capability-return-20260713",
] as const;

const localDnsSpecCarrierIds = [
  "hold-spec-localdns-managed-cluster-quota-family-frontier-20260708",
  "hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714",
  "wait-localdns-create-http400-residual-family-return-20260704",
  "hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712",
  "wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703",
] as const;

const focusWatcherCarrierIds = [
  "ops/wait-project-approval-owner-return-primary-blocker-20260713",
  "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
  "hold-spec-shared-authenticated-artifact-result-recovery-family-20260714",
  "ops/wait-shared-worker-model-auth-capability-return-20260713",
] as const;

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

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function taskState(task: Record<string, unknown> | undefined): string {
  const raw = task?.state ?? task?.status ?? "";
  if (raw === "accepted") return "done";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "superseded" || raw === "cancelled") return "done";
  if (raw === "decomposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  return typeof raw === "string" ? raw : "";
}

function writeMemo(relativePath: string, content: string) {
  const absolute = resolve(appDir, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

function formatTaskList(taskIds: string[]): string {
  return taskIds.length > 0
    ? taskIds.map((taskId) => `\`${taskId}\``).join(", ")
    : "none";
}

const summaryBefore = summarizeTaskTree(config);

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const beforeIssues = auditFocusMetadataIssues(tree).filter(
    (issue) => issue.ownerTaskId === focusTaskId,
  );
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];

  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const activeExcludingRepair = unique(
    summaryBefore.frontier.active.filter((taskId) => taskId !== repairTaskId),
  );
  const reviewExcludingRepair = unique(
    summaryBefore.frontier.review.filter((taskId) => taskId !== repairTaskId),
  );
  const waitingExcludingRepair = unique(
    summaryBefore.frontier.waiting.filter((taskId) => taskId !== repairTaskId),
  );
  const runnableExcludingRepair = unique(
    summaryBefore.frontier.runnable.filter((taskId) => taskId !== repairTaskId),
  );

  const focusContext = asRecord(focusTask.context);
  const progressReview = asRecord(focusContext.progress_review);
  const priorEvidence = asStringArray(progressReview.evidence);
  const observations = asRecord(focusContext.observations);
  const priorFocusOutputs = asStringArray(focusTask.outputs);
  const focusTraceBefore = asRecord(focusTask.trace);

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const priorProjectOutputs = asStringArray(projectTask.outputs);
  const projectTraceBefore = asRecord(projectTask.trace);

  const linkedBlockedTaskIds = unique([
    focusWatcherCarrierIds[0],
    ...survivingRootBlockedCarrierIds,
    focusWatcherCarrierIds[2],
    ...localDnsSpecCarrierIds,
  ]);

  const blockedStateFailures = linkedBlockedTaskIds
    .map((taskId) => ({
      taskId,
      state: taskState(tree.tasks[taskId] as Record<string, unknown> | undefined),
    }))
    .filter(({ state }) => state !== "blocked");

  if (blockedStateFailures.length > 0) {
    throw new Error(
      `Expected blocked carrier(s) not blocked: ${blockedStateFailures
        .map(({ taskId, state }) => `${taskId}=${state || "missing"}`)
        .join(", ")}`,
    );
  }

  const goal =
    "Use the current no-live frontier, now centered on the active focus controller alone, while representing the accepted residual project-root wait-family audit and accepted LocalDNS spec-frontier audit as done evidence; preserve the 12 surviving blocked project-root carriers (including the two blocked loop stewards), the five separate LocalDNS spec carriers, and the exact approval/shared-auth/shared worker-model-auth watcher families as blocked scope guards rather than reopening live execution.";

  const acceptance = [
    "The visible focus branch remains tied to the truthful current frontier baseline excluding the repair leaf: active=[focus-terminal-frontier-finality-reconciliation-20260714], review=[none], waiting=[none], runnable=[none], with the existing approval/shared-auth/shared worker-model-auth watcher families still blocked scope guards and both accepted audit leaves represented as done evidence rather than live frontier work.",
    "Blocked linkage/readout preserves the accepted no-further-collapse judgments: the 12 surviving project-root blocked carriers remain one exact carrier per family plus the two blocked loop stewards, and the five LocalDNS spec carriers remain separate with hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714 preserved as the sharper successor; do not reopen the completed LocalDNS compact reconciliation.",
    "Project-level readout and focus metadata stay aligned to this no-live controller-only frontier and do not reopen live execution or widen scope without a materially changed gate.",
  ];

  progressReview.last_reviewed_at = checkedAt;
  progressReview.status = "active";
  progressReview.summary =
    `The same no-live terminal-frontier finality mission still fits. Excluding ${repairTaskId}, the truthful current focus frontier is active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], waiting=[${waitingExcludingRepair.join(", ") || "none"}], runnable=[${runnableExcludingRepair.join(", ") || "none"}], blocked=${summaryBefore.counts.blocked}. The accepted residual root-wait audit and accepted LocalDNS spec-frontier audit are now done evidence only, while the 12 surviving root blocked carriers, the five separate LocalDNS carriers, and the approval/shared-auth/shared worker-model-auth watcher families remain the blocked scope guards.`;
  progressReview.evidence = unique([
    `${checkedAt} task-tree summary/frontier reported active=[${summaryBefore.frontier.active.join(", ") || "none"}], review=[${summaryBefore.frontier.review.join(", ") || "none"}], waiting=[${summaryBefore.frontier.waiting.join(", ") || "none"}], runnable=[${summaryBefore.frontier.runnable.join(", ") || "none"}], blocked=${summaryBefore.counts.blocked}. Excluding ${repairTaskId}, the focus baseline is active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], waiting=[${waitingExcludingRepair.join(", ") || "none"}], runnable=[${runnableExcludingRepair.join(", ") || "none"}].`,
    `${checkedAt} accepted no-further-collapse evidence now lives at ${rootAuditEvidencePath} (12 surviving root blocked carriers stay one exact carrier per family plus the two blocked loop stewards) and ${localDnsAuditEvidencePath} (five LocalDNS spec carriers remain separate, with hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714 as the sharper successor).`,
    `${checkedAt} refreshed focus goal/acceptance, linked_active_task_ids, linked_review_task_ids, linked_blocked_task_ids, and project current-focus reason so the accepted audits are represented as done evidence rather than live review work.`,
    ...priorEvidence,
  ]);
  focusContext.progress_review = progressReview;

  observations.frontier_active_leaf_count = activeExcludingRepair.length;
  observations.frontier_review_leaf_count = reviewExcludingRepair.length;
  observations.frontier_waiting_leaf_count = waitingExcludingRepair.length;
  observations.frontier_runnable_leaf_count = runnableExcludingRepair.length;
  observations.frontier_blocked_leaf_count = summaryBefore.counts.blocked;
  observations.linked_active_task_ids = activeExcludingRepair;
  observations.linked_review_task_ids = reviewExcludingRepair;
  observations.linked_blocked_task_ids = linkedBlockedTaskIds;
  observations.recent_learning =
    "Once the residual root-wait audit and LocalDNS spec-frontier audit were accepted, the focus frontier returned to a controller-only no-review state; their value is preserved as done evidence and sharper blocked-family readout rather than ongoing live work.";
  observations.parallel_work_gap =
    `Excluding ${repairTaskId}, no review, runnable, or waiting leaves remain; the only active carrier is the focus controller, and all other represented scope is preserved through blocked watcher/root/localdns families plus the accepted audit evidence.`;
  focusContext.observations = observations;

  focusTask.goal = goal;
  focusTask.acceptance = acceptance;
  focusTask.context = focusContext;
  focusTask.outputs = unique([
    ...priorFocusOutputs,
    rootAuditEvidencePath,
    localDnsAuditEvidencePath,
    evidencePath,
  ]);
  focusTask.trace = {
    ...focusTraceBefore,
    review_summary:
      `Refreshed ${focusTaskId} after audit acceptance so its controller-visible frontier baseline excluding ${repairTaskId} is active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], and blocked-links preserve the accepted 12-root + 5-LocalDNS + approval/shared-auth scope guards.`,
    latest_focus_review_at: checkedAt,
    latest_focus_review_result: "updated",
    latest_focus_review_summary:
      `The accepted residual root-wait and LocalDNS spec-frontier audits are now done evidence only; the focus branch returns to a controller-only no-review frontier baseline once ${repairTaskId} is excluded.`,
    post_review_acceptance_drift_repaired_at: checkedAt,
    post_review_acceptance_drift_repaired_by: "app-ops-script",
    post_review_acceptance_drift_repair_attempt_id: attemptId,
    post_review_acceptance_drift_repair_evidence_path: evidencePath,
  };

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.reason =
    `The next bounded mission is still terminal-frontier finality reconciliation. Excluding ${repairTaskId}, the truthful live frontier is active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], waiting=[${waitingExcludingRepair.join(", ") || "none"}], runnable=[${runnableExcludingRepair.join(", ") || "none"}], while blocked carrier linkage stays on [${linkedBlockedTaskIds.join(", ")}]. Keep the accepted residual root-wait audit and accepted LocalDNS spec-frontier audit as done evidence only; the 12 surviving root blocked carriers, five LocalDNS spec carriers, and approval/shared-auth/shared worker-model-auth watcher families now define the no-live scope guard surface.`;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...priorProjectOutputs, evidencePath]);
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_post_review_acceptance_drift_repaired_at: checkedAt,
    current_focus_proposal_post_review_acceptance_drift_repaired_by: "app-ops-script",
    current_focus_proposal_post_review_acceptance_drift_repair_attempt_id:
      attemptId,
    current_focus_proposal_post_review_acceptance_drift_repair_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  const afterIssues = auditFocusMetadataIssues(tree).filter(
    (issue) => issue.ownerTaskId === focusTaskId,
  );

  return {
    checkedAt,
    attemptId,
    repairTaskId,
    focusTaskId,
    projectTaskId,
    baselineExcludingRepair: {
      active: activeExcludingRepair,
      review: reviewExcludingRepair,
      waiting: waitingExcludingRepair,
      runnable: runnableExcludingRepair,
      blockedLeafCount: summaryBefore.counts.blocked,
    },
    beforeIssues,
    afterIssues,
    linkedBlockedTaskIds,
    rootAuditEvidencePath,
    localDnsAuditEvidencePath,
    survivingRootBlockedCarrierIds,
    localDnsSpecCarrierIds,
    focusWatcherCarrierIds,
    focusGoal: goal,
    focusAcceptance: acceptance,
    focusProgressSummary: progressReview.summary,
    projectReason: currentFocusProposal.reason,
  };
});

writeMemo(
  evidencePath,
  `# Focus terminal-frontier post-review acceptance drift repair — 2026-07-14

Task: \`${repairTaskId}\`
Attempt: \`${attemptId}\`

## Result

Applied a bounded app-state repair to \`${focusTaskId}\` after the residual project-root wait-family audit and the LocalDNS spec-frontier audit were accepted and archived out of the live frontier. The focus controller/readout now treats those two audits as done evidence only and returns to a controller-only no-review baseline excluding this repair leaf.

## Baseline used

Per worker-mode audit rules, the baseline excludes the assigned repair task \`${repairTaskId}\`.

- active: ${formatTaskList(result.baselineExcludingRepair.active)}
- review: ${formatTaskList(result.baselineExcludingRepair.review)}
- waiting: ${formatTaskList(result.baselineExcludingRepair.waiting)}
- runnable: ${formatTaskList(result.baselineExcludingRepair.runnable)}
- blocked leaf count: ${result.baselineExcludingRepair.blockedLeafCount}

## Accepted audit evidence now represented as done

1. Root wait-family no-further-collapse audit: \`${rootAuditEvidencePath}\`
2. LocalDNS spec-frontier no-further-collapse audit: \`${localDnsAuditEvidencePath}\`

## What changed

- rewrote \`${focusTaskId}.goal\` and acceptance text to the new no-review controller-only frontier
- rewrote \`${focusTaskId}.context.observations.linked_active_task_ids\` to the baseline excluding this repair leaf
- kept \`${focusTaskId}.context.observations.linked_review_task_ids\` empty because the accepted audit leaves are no longer live review work
- refreshed \`${focusTaskId}.context.observations.linked_blocked_task_ids\` so it preserves the accepted 12 root blocked carriers, the five LocalDNS spec carriers, and the approval/shared-auth/shared worker-model-auth scope guards
- refreshed \`${focusTaskId}.context.progress_review\`, \`${focusTaskId}.trace.review_summary\`, and \`project.context.current_focus_proposal.reason\`
- added the two accepted audit evidence paths to \`${focusTaskId}.outputs\` so they remain represented as done evidence rather than live frontier tasks

## Verification snapshot

Post-repair focus metadata audit issues for \`${focusTaskId}\`: ${result.afterIssues.length}

Blocked linkage preserved after repair:

- surviving project-root blocked carriers (${result.survivingRootBlockedCarrierIds.length}): ${formatTaskList([...result.survivingRootBlockedCarrierIds])}
- LocalDNS spec carriers (${result.localDnsSpecCarrierIds.length}): ${formatTaskList([...result.localDnsSpecCarrierIds])}
- focus watcher carriers (${result.focusWatcherCarrierIds.length}): ${formatTaskList([...result.focusWatcherCarrierIds])}

Updated focus progress summary:

> ${result.focusProgressSummary}

Updated project focus reason:

> ${result.projectReason}

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`,
);

console.log(JSON.stringify(result, null, 2));
