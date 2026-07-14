import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

type MutableBlocker = Record<string, unknown>;

const attemptId =
  "a_ops-apply-reconcile-virtualmachines-agentpool-live-holder-mapping-202607_20260713193602";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const repairedAt = new Date().toISOString();
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "virtualmachines-agentpool";
const familyHolderTaskId =
  "hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b";
const domainMemoPath =
  "../aks-rp-e2e/evidence/archive/domain-reconcile-virtualmachines-agentpool-split-frontier-visible-members-20260713.md";
const reviewedMemoPath =
  "evidence/archive/ops-reconcile-virtualmachines-agentpool-live-holder-mapping-20260713.md";
const appMemoPath =
  "evidence/archive/ops-apply-reconcile-virtualmachines-agentpool-split-frontier-visible-mem-20260713.md";
const exactHolderIds = {
  autoZone:
    "hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708",
  row61:
    "hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708",
  row75Row76:
    "hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708",
  cliAdd:
    "hold-compact-virtualmachines-agentpool-cli-add-multi-sku-reviewed-exception-frontier-20260713",
  managedsystem:
    "hold-compact-virtualmachines-agentpool-managedsystem-combined-terminal-product-gap-frontier-20260713",
  poolDelete:
    "hold-compact-virtualmachines-agentpool-pool-delete-rest-intentional-shared-carrier-only-frontier-20260713",
  vmasToVms:
    "hold-compact-virtualmachines-agentpool-vmas-to-vms-migration-slb-deprecated-surface-frontier-20260713",
} as const;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
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
  ].sort((a, b) => a.localeCompare(b));
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, appMemoPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

const { state: compactState, path: compactStatePath } =
  loadFeatureCompactLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: 1,
    refreshFromProject: false,
  });

const compactFeatureBefore = compactState.features[featureKey];
if (!compactFeatureBefore) {
  throw new Error(`Missing compact feature state for ${featureKey}`);
}

const beforeFrontierTaskIds = asStringArray(
  compactFeatureBefore.frontierTaskIds,
);
const beforeTaskId = asString(compactFeatureBefore.taskId);
const beforeReviewEvidencePath = asString(compactFeatureBefore.reviewEvidencePath);

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[loopTaskId];
  if (!loopTask) throw new Error(`Task not found: ${loopTaskId}`);

  const familyHolder = tree.tasks[familyHolderTaskId];
  if (!familyHolder) throw new Error(`Task not found: ${familyHolderTaskId}`);

  const familyBlocker = asRecord(familyHolder.blocker) as MutableBlocker;
  const familyObservedBy = asRecord(familyBlocker.observed_by);
  const familyObservationMethod =
    asString(familyBlocker.observation_method) ||
    "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.";
  const familyResumeCondition =
    asString(familyBlocker.resume_condition) ||
    "Resume only when one preserved virtualmachines-agentpool sub-frontier materially changes, a specific remaining member is reclassified into live-ready eligibility, or compact eligibility policy changes reopen a truthful narrower rerun subset.";
  const familyNextCheckAt =
    asString(familyBlocker.next_check_at) || repairedAt;
  const familyFallbackAt =
    asString(familyBlocker.fallback_at) || familyNextCheckAt;
  const familyFallbackAction =
    asString(familyBlocker.fallback_action) ||
    "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.";
  const familyBlockedAt = asString(familyBlocker.blocked_at) || repairedAt;

  const desiredExactFrontierTaskIds = [
    exactHolderIds.autoZone,
    exactHolderIds.row61,
    exactHolderIds.row75Row76,
    exactHolderIds.cliAdd,
    exactHolderIds.managedsystem,
    exactHolderIds.poolDelete,
    exactHolderIds.vmasToVms,
    familyHolderTaskId,
  ];

  const holders = [
    {
      id: exactHolderIds.cliAdd,
      goal: "Preserve the exact compact wait for spec.virtualmachines.cli-add-multi-sku until the reviewed aks-preview CLI multi-SKU guard meaning changes or the carrier is intentionally remodeled.",
      acceptance: [
        "One blocked compact holder covers only spec.virtualmachines.cli-add-multi-sku.",
        "The blocker preserves the reviewed-exception CLI contract mismatch: agentpool_decorator.py enforces len(sizes)==1 before the RP request, so the comma-separated multi-SKU --vm-sizes path remains blocked without reopening unchanged reruns.",
        "Resume only when the aks-preview CLI contract materially changes for this exact multi-SKU create surface, or when the owner intentionally remodels the carrier.",
      ],
      conflictScope: ["feature:virtualmachines-agentpool:cli-add-multi-sku"],
      representedSpecIds: ["spec.virtualmachines.cli-add-multi-sku"],
      blockerCondition:
        "2026-07-13 live-holder reconciliation confirmed this exact virtualmachines-agentpool reviewed-exception frontier still remains required: spec.virtualmachines.cli-add-multi-sku preserves the same client-side CLI contract mismatch where aks-preview agentpool_decorator.py enforces len(sizes)==1 and rejects comma-separated multi-SKU --vm-sizes before the RP request, so no unchanged compact rerun or broader family collapse is truthful now.",
      resumeCondition:
        "Resume only when the aks-preview CLI contract for comma-separated multi-SKU --vm-sizes materially changes on the checked-in carrier surface, or when the owner intentionally remodels this carrier.",
      waitingFor: {
        type: "frontier.changed",
        taskId: exactHolderIds.cliAdd,
        featureKey,
        representedSpecIds: ["spec.virtualmachines.cli-add-multi-sku"],
      },
      evidenceNote:
        "CLI multi-SKU exact holder kept/restored for the reviewed-exception client-side len(sizes)==1 mismatch.",
    },
    {
      id: exactHolderIds.managedsystem,
      goal: "Preserve the exact compact wait for spec.virtualmachines.managedsystem-combined until the same-pool ManagedSystem plus VirtualMachines terminal product-gap boundary materially changes.",
      acceptance: [
        "One blocked compact holder covers only spec.virtualmachines.managedsystem-combined.",
        "The blocker preserves the accepted terminal product-gap boundary: the same-pool ManagedSystem plus VirtualMachines request is rejected with HTTP 400 InvalidParameter because ManagedSystem pools can specify only name and mode.",
        "Resume only when a concrete API/source/product support signal materially changes that exact same-pool combined shape, or when the owner intentionally replaces this carrier.",
      ],
      conflictScope: [
        "feature:virtualmachines-agentpool:managedsystem-combined",
      ],
      representedSpecIds: ["spec.virtualmachines.managedsystem-combined"],
      blockerCondition:
        "2026-07-13 live-holder reconciliation restored this exact virtualmachines-agentpool terminal product-gap frontier: spec.virtualmachines.managedsystem-combined preserves the accepted same-pool ManagedSystem plus VirtualMachines boundary, where the explicit combined PUT is rejected with HTTP 400 InvalidParameter because ManagedSystem pools can specify only name and mode, so no unchanged compact rerun or broader family collapse is truthful now.",
      resumeCondition:
        "Resume only when a concrete API, source, or product support signal materially changes the exact same-pool ManagedSystem plus VirtualMachines request shape, or when the owner intentionally replaces this carrier.",
      waitingFor: {
        type: "frontier.changed",
        taskId: exactHolderIds.managedsystem,
        featureKey,
        representedSpecIds: ["spec.virtualmachines.managedsystem-combined"],
      },
      evidenceNote:
        "ManagedSystem combined exact holder restored for the accepted terminal product-gap boundary.",
    },
    {
      id: exactHolderIds.poolDelete,
      goal: "Preserve the exact compact wait for spec.virtualmachines.pool-delete-rest until the accepted shared-carrier-only delete posture materially changes or a truthful standalone carrier is intentionally authored.",
      acceptance: [
        "One blocked compact holder covers only spec.virtualmachines.pool-delete-rest.",
        "The blocker preserves the accepted intentional shared-carrier-only posture: the pass verdict remains authoritative, but current head does not offer a truthful standalone single-spec live delete carrier without first creating the prerequisite user pool.",
        "Resume only when a dedicated standalone carrier or materially changed shared-cluster evidence changes that exact posture, or when the owner intentionally replaces this carrier.",
      ],
      conflictScope: ["feature:virtualmachines-agentpool:pool-delete-rest"],
      representedSpecIds: ["spec.virtualmachines.pool-delete-rest"],
      blockerCondition:
        "2026-07-13 live-holder reconciliation restored this exact virtualmachines-agentpool intentional shared-carrier-only frontier: spec.virtualmachines.pool-delete-rest keeps its accepted pass verdict only through the current shared-cluster carrier posture and does not truthfully expose an unchanged standalone single-spec live delete path on current head, so no broad rerun or misleading standalone reopen is truthful now.",
      resumeCondition:
        "Resume only when a dedicated standalone carrier is intentionally authored, materially changed shared-cluster evidence changes the accepted posture, or the owner intentionally replaces this carrier.",
      waitingFor: {
        type: "frontier.changed",
        taskId: exactHolderIds.poolDelete,
        featureKey,
        representedSpecIds: ["spec.virtualmachines.pool-delete-rest"],
      },
      evidenceNote:
        "Pool-delete-rest exact holder restored for the accepted intentional shared-carrier-only posture.",
    },
    {
      id: exactHolderIds.vmasToVms,
      goal: "Preserve the exact compact wait for spec.virtualmachines.vmas-to-vms-migration-slb until the deprecated AvailabilitySet-start migration surface materially changes or a bounded same-surface successor is approved.",
      acceptance: [
        "One blocked compact holder covers only spec.virtualmachines.vmas-to-vms-migration-slb.",
        "The blocker preserves the deprecated-surface environment frontier: reviewed live run 28721673014 failed cluster creation with InvalidAgentPoolType because VMAS agent pools are deprecated and no longer available for creation.",
        "Resume only when a materially changed source/API/runtime signal reopens that exact AvailabilitySet-start migration surface, or when the owner intentionally replaces this carrier.",
      ],
      conflictScope: [
        "feature:virtualmachines-agentpool:vmas-to-vms-migration-slb",
      ],
      representedSpecIds: ["spec.virtualmachines.vmas-to-vms-migration-slb"],
      blockerCondition:
        "2026-07-13 live-holder reconciliation restored this exact virtualmachines-agentpool deprecated-surface frontier: spec.virtualmachines.vmas-to-vms-migration-slb preserves the reviewed live run 28721673014 InvalidAgentPoolType boundary because AvailabilitySet agent pools are deprecated and no longer available for creation, so no unchanged compact rerun or broader family collapse is truthful now.",
      resumeCondition:
        "Resume only when a materially changed source, API, or runtime signal reopens the exact AvailabilitySet-start to VirtualMachines Standard-LB migration surface, or when the owner intentionally replaces this carrier.",
      waitingFor: {
        type: "frontier.changed",
        taskId: exactHolderIds.vmasToVms,
        featureKey,
        representedSpecIds: ["spec.virtualmachines.vmas-to-vms-migration-slb"],
      },
      evidenceNote:
        "VMAS-to-VMS migration exact holder restored for the deprecated VMAS creation surface.",
    },
  ];

  const createdTaskIds: string[] = [];
  const loopChildren = asStringArray(loopTask.children);

  for (const holder of holders) {
    const existing = tree.tasks[holder.id];
    const task: TaskNode = existing ?? {
      id: holder.id,
      parent_id: loopTaskId,
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: holder.goal,
      inputs: [domainMemoPath, reviewedMemoPath],
      outputs: [appMemoPath],
      acceptance: holder.acceptance,
      conflict_scope: holder.conflictScope,
      context: {
        featureCompactExactWait: true,
        featureKey,
        representedSpecIds: holder.representedSpecIds,
        sourceSummaryPath:
          "../aks-rp-e2e/features/virtualmachines-agentpool/compact/staging.summary.md",
        sourceDiagnosticsPath:
          "../aks-rp-e2e/features/virtualmachines-agentpool/compact/staging.diagnostics.json",
        stateRef: ".state/feature-compact-loop/state.json",
        target: "staging",
      },
      blocker: {
        condition: holder.blockerCondition,
        category: "blocked-wait",
        owner: "aks-explorer",
        blocked_at: familyBlockedAt,
        waiting_for: holder.waitingFor,
        observed_by: familyObservedBy,
        observation_method: familyObservationMethod,
        next_check_at: familyNextCheckAt,
        resume_condition: holder.resumeCondition,
        fallback_at: familyFallbackAt,
        fallback_action: familyFallbackAction,
        resume_at: familyNextCheckAt,
      },
      trace: {
        created_at: repairedAt,
        created_by: "app-ops-script",
      },
    };

    task.parent_id = loopTaskId;
    task.state = "blocked";
    task.status = "blocked";
    task.kind = "domain_leaf";
    task.priority = "P2";
    task.owner = "aks-explorer";
    task.children = [];
    task.goal = holder.goal;
    task.inputs = unique([
      ...asStringArray(task.inputs),
      domainMemoPath,
      reviewedMemoPath,
    ]);
    task.outputs = unique([...asStringArray(task.outputs), appMemoPath]);
    task.acceptance = holder.acceptance;
    task.conflict_scope = holder.conflictScope;
    task.context = {
      ...asRecord(task.context),
      featureCompactExactWait: true,
      featureKey,
      representedSpecIds: holder.representedSpecIds,
      sourceSummaryPath:
        "../aks-rp-e2e/features/virtualmachines-agentpool/compact/staging.summary.md",
      sourceDiagnosticsPath:
        "../aks-rp-e2e/features/virtualmachines-agentpool/compact/staging.diagnostics.json",
      stateRef: ".state/feature-compact-loop/state.json",
      target: "staging",
    };
    task.blocker = {
      condition: holder.blockerCondition,
      category: "blocked-wait",
      owner: "aks-explorer",
      blocked_at:
        asString(asRecord(task.blocker).blocked_at) || familyBlockedAt,
      waiting_for: holder.waitingFor,
      observed_by: familyObservedBy,
      observation_method: familyObservationMethod,
      next_check_at: familyNextCheckAt,
      resume_condition: holder.resumeCondition,
      fallback_at: familyFallbackAt,
      fallback_action: familyFallbackAction,
      resume_at: familyNextCheckAt,
    };
    task.trace = {
      ...asRecord(task.trace),
      live_holder_mapping_reconciled_at: repairedAt,
      live_holder_mapping_reconciled_by: "app-ops-script",
      live_holder_mapping_reconcile_attempt_id: attemptId,
    };

    tree.tasks[holder.id] = task;
    if (!existing) createdTaskIds.push(holder.id);
    if (!loopChildren.includes(holder.id)) loopChildren.push(holder.id);
  }

  loopTask.children = loopChildren;

  familyHolder.goal =
    "Preserve one maintained compact-family holder for the current 9-member virtualmachines-agentpool split frontier by explicitly mapping all nine members to seven exact same-lineage holders, without reopening an unchanged broad compact rerun.";
  familyHolder.outputs = unique([
    ...asStringArray(familyHolder.outputs),
    appMemoPath,
  ]);
  familyHolder.inputs = unique([
    ...asStringArray(familyHolder.inputs),
    domainMemoPath,
    reviewedMemoPath,
  ]);
  familyHolder.acceptance = [
    "The holder records the maintained 9-member virtualmachines-agentpool frontier: row61 core-addon-compatibility; row75 aksconformance-core; row76 aksconformance-tunnel; auto-zone mixed-sku; auto-zone single-sku; cli-add-multi-sku; managedsystem-combined; pool-delete-rest; and vmas-to-vms-migration-slb.",
    "The holder explicitly maps the auto-zone pair, row61, row75/row76, cli-add-multi-sku, managedsystem-combined, pool-delete-rest, and vmas-to-vms-migration-slb members to their current exact same-lineage holder ids instead of leaving any member visible only through generic family text.",
    "The holder keeps liveDispatchGate.allowed=false posture explicit and preserves the exact maintained split-frontier reason plus resume condition without reopening an unchanged broad compact rerun.",
    "The task-tree branch now provides one maintained summary holder plus seven exact member or member-pair holders for the virtualmachines-agentpool current-head split frontier.",
  ];
  familyHolder.context = {
    ...asRecord(familyHolder.context),
    featureKey,
    representedTaskIds: desiredExactFrontierTaskIds,
    representedMembers: {
      "spec.virtualmachines.auto-zone-single-sku": exactHolderIds.autoZone,
      "spec.virtualmachines.auto-zone-mixed-sku": exactHolderIds.autoZone,
      "spec.virtualmachine-prerelease.row61-core-addon-compatibility":
        exactHolderIds.row61,
      "spec.virtualmachine-prerelease.row75-aksconformance-core":
        exactHolderIds.row75Row76,
      "spec.virtualmachine-prerelease.row76-aksconformance-tunnel":
        exactHolderIds.row75Row76,
      "spec.virtualmachines.cli-add-multi-sku": exactHolderIds.cliAdd,
      "spec.virtualmachines.managedsystem-combined":
        exactHolderIds.managedsystem,
      "spec.virtualmachines.pool-delete-rest": exactHolderIds.poolDelete,
      "spec.virtualmachines.vmas-to-vms-migration-slb":
        exactHolderIds.vmasToVms,
    },
  };
  familyHolder.blocker = {
    ...familyBlocker,
    condition:
      "2026-07-13 live-holder reconciliation confirmed the maintained virtualmachines-agentpool compact split frontier still needs this family-level holder, and every preserved member is now mapped to an exact same-lineage holder: auto-zone single-sku and auto-zone mixed-sku -> hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708; row61 core-addon-compatibility -> hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708; row75 aksconformance-core and row76 aksconformance-tunnel -> hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708; cli-add-multi-sku -> hold-compact-virtualmachines-agentpool-cli-add-multi-sku-reviewed-exception-frontier-20260713; managedsystem-combined -> hold-compact-virtualmachines-agentpool-managedsystem-combined-terminal-product-gap-frontier-20260713; pool-delete-rest -> hold-compact-virtualmachines-agentpool-pool-delete-rest-intentional-shared-carrier-only-frontier-20260713; and vmas-to-vms-migration-slb -> hold-compact-virtualmachines-agentpool-vmas-to-vms-migration-slb-deprecated-surface-frontier-20260713. Compact diagnostics still classify the feature as repo-local-spec-metadata-split-frontier, liveDispatchGate.allowed remains false, and no unchanged broad compact rerun or family collapse is truthful now.",
    owner: "aks-explorer",
    waiting_for: {
      type: "frontier.changed",
      taskId: familyHolderTaskId,
      featureKey,
      representedTaskIds: desiredExactFrontierTaskIds,
    },
    observed_by: familyObservedBy,
    observation_method: familyObservationMethod,
    resume_condition: familyResumeCondition,
    next_check_at: familyNextCheckAt,
    fallback_at: familyFallbackAt,
    fallback_action: familyFallbackAction,
    resume_at: familyNextCheckAt,
    blocked_at: familyBlockedAt,
  };
  familyHolder.trace = {
    ...asRecord(familyHolder.trace),
    live_holder_mapping_reconciled_at: repairedAt,
    live_holder_mapping_reconciled_by: "app-ops-script",
    live_holder_mapping_reconcile_attempt_id: attemptId,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  updateFeatureCompactItem(compactState, featureKey, {
    status: "blocked",
    errorClass: "package-partial",
    retryable: false,
    taskId: familyHolderTaskId,
    frontierTaskIds: desiredExactFrontierTaskIds,
    retryReason: familyResumeCondition,
    rootCauseClassification: "repo-local-spec-metadata-split-frontier",
    ownerReason:
      "The 2026-07-13 app-ops live-holder reconciliation represents the compact branch with seven exact holders plus the maintained family summary, so no unchanged broad rerun or family collapse is truthful while those same-lineage frontier meanings remain unchanged.",
    attemptedFixes: unique([
      ...asStringArray(compactFeatureBefore.attemptedFixes),
      `${attemptId}: restored the missing exact compact holders for managedsystem-combined, pool-delete-rest, and vmas-to-vms-migration-slb; re-asserted the cli-add exact holder; tightened ${familyHolderTaskId} to map all nine maintained members to seven exact holders; and synchronized controller-visible compact state to the repaired represented frontier.`,
    ]),
    nextStepClassification:
      "preserve the exact seven-holder virtualmachines-agentpool split frontier plus maintained family summary and re-review at the holder next_check_at unless one represented same-surface frontier changes earlier",
    resumeCondition: familyResumeCondition,
    blockedAt: familyBlockedAt,
    blockedReason: asString(asRecord(familyHolder.blocker).condition),
    waitingFor: asRecord(asRecord(familyHolder.blocker).waiting_for),
    waitingCondition: familyResumeCondition,
    observedBy: familyObservedBy,
    observationMethod: familyObservationMethod,
    nextCheckAt: familyNextCheckAt,
    blockerOwner:
      asString(asRecord(familyHolder.blocker).owner) || "aks-explorer",
    fallbackAt: familyFallbackAt,
    fallbackAction: familyFallbackAction,
    resumeAction:
      "Keep the compact branch blocked until one represented holder materially changes or the next blocked-frontier family review replaces this exact representation.",
    blockedScope: {
      kind: "feature",
      ids: [featureKey],
    },
    blockedFingerprint: {
      errorClass: "package-partial",
      target: "staging",
      branch: "dev",
      featureKey,
    },
    lastCheckedAt: repairedAt,
    evidencePaths: unique([
      ...asStringArray(compactFeatureBefore.evidencePaths),
      appMemoPath,
      reviewedMemoPath,
      domainMemoPath,
      compactFeatureBefore.lastSummaryPath,
      compactFeatureBefore.lastDiagnosticsPath,
    ]),
    reviewEvidencePath: appMemoPath,
    verificationBlocker:
      "Do not rerun unchanged. Preserve the exact seven-holder virtualmachines-agentpool split frontier and maintained family summary until one represented same-surface frontier changes or the next blocked-frontier family review produces a truthful replacement.",
    summary:
      "2026-07-13 app-ops live-holder reconciliation restored the missing managedsystem-combined, pool-delete-rest, and vmas-to-vms-migration-slb compact holders, kept the cli-add holder live, and synchronized the maintained family holder plus controller-visible state to the exact seven-holder frontier.",
  });

  saveFeatureCompactLoopState(compactStatePath, compactState);

  return {
    createdTaskIds,
    desiredExactFrontierTaskIds,
    familyHolderGoal: familyHolder.goal,
    familyHolderBlocker: asString(asRecord(familyHolder.blocker).condition),
    compactFeatureAfter: compactState.features[featureKey],
  };
});

const restoredHolderNotes = [
  {
    id: exactHolderIds.managedsystem,
    note: "member: spec.virtualmachines.managedsystem-combined — accepted terminal product-gap boundary for the same-pool ManagedSystem plus VirtualMachines HTTP 400 InvalidParameter shape.",
  },
  {
    id: exactHolderIds.poolDelete,
    note: "member: spec.virtualmachines.pool-delete-rest — accepted intentional shared-carrier-only delete posture.",
  },
  {
    id: exactHolderIds.vmasToVms,
    note: "member: spec.virtualmachines.vmas-to-vms-migration-slb — deprecated VMAS creation surface from reviewed live run 28721673014.",
  },
];

const createdHolderLines = [
  exactHolderIds.managedsystem,
  exactHolderIds.poolDelete,
  exactHolderIds.vmasToVms,
]
  .map((id) => `- ${id}`)
  .join("\n");

const memo = `# App-ops apply: virtualmachines-agentpool split-frontier visible members — 2026-07-13

Attempt: ${attemptId}

## Summary

Repaired the current live-holder drift called out by ${reviewedMemoPath}.
Before this attempt, the maintained family holder still named the managedsystem-combined, pool-delete-rest, and vmas-to-vms-migration-slb exact holder ids, but direct task-tree reads showed those three task ids were not live. This attempt restored the missing holders, kept the existing cli-add exact holder aligned, and resynchronized the controller-visible compact state back to the maintained family holder.

## Inputs used

- ${domainMemoPath}
- ${reviewedMemoPath}
- .state/feature-compact-loop/state.json
- .state/spec-loop/state.json
- ${familyHolderTaskId}
- ${exactHolderIds.autoZone}
- ${exactHolderIds.row61}
- ${exactHolderIds.row75Row76}
- ${exactHolderIds.cliAdd}

## Live state before repair

- Maintained holder read target: ${familyHolderTaskId}
- Reviewed broken compact-state baseline from ${reviewedMemoPath}: taskId=hold-compact-virtualmachines-agentpool-cli-add-multi-sku-reviewed-exception-frontier-20260713, frontierTaskIds=[]
- Current pre-run compact-state read in this script: taskId=${beforeTaskId || "(missing taskId)"}, frontierTaskIds=${JSON.stringify(beforeFrontierTaskIds)}, reviewEvidencePath=${beforeReviewEvidencePath || "(missing)"}
- Missing exact holder ids proved by the reviewed memo and re-applied here:
${restoredHolderNotes.map((entry) => `  - ${entry.id}: ${entry.note}`).join("\n")}

## Repair applied

### Exact holders now live

This attempt left these exact holder ids live in the task tree, matching the maintained holder mapping and the reviewed same-lineage meanings:
${createdHolderLines}

The maintained family holder ${familyHolderTaskId} now records this explicit member-to-holder mapping:
- spec.virtualmachines.auto-zone-single-sku -> ${exactHolderIds.autoZone}
- spec.virtualmachines.auto-zone-mixed-sku -> ${exactHolderIds.autoZone}
- spec.virtualmachine-prerelease.row61-core-addon-compatibility -> ${exactHolderIds.row61}
- spec.virtualmachine-prerelease.row75-aksconformance-core -> ${exactHolderIds.row75Row76}
- spec.virtualmachine-prerelease.row76-aksconformance-tunnel -> ${exactHolderIds.row75Row76}
- spec.virtualmachines.cli-add-multi-sku -> ${exactHolderIds.cliAdd}
- spec.virtualmachines.managedsystem-combined -> ${exactHolderIds.managedsystem}
- spec.virtualmachines.pool-delete-rest -> ${exactHolderIds.poolDelete}
- spec.virtualmachines.vmas-to-vms-migration-slb -> ${exactHolderIds.vmasToVms}

### Controller-visible compact state synchronized

After this apply step, .state/feature-compact-loop/state.json points virtualmachines-agentpool at ${familyHolderTaskId} with frontierTaskIds=${JSON.stringify(result.desiredExactFrontierTaskIds)}.
The review evidence path remains ${appMemoPath}, now updated to this current attempt header.

## Spec-loop state note

No direct spec-loop mutation was required for this repair.
The exact meanings for managedsystem-combined, pool-delete-rest, and vmas-to-vms-migration-slb were already preserved in .state/spec-loop/state.json and the domain memo; this apply step repaired only the app-owned compact/task-tree representation drift.
`;

writeMemo(memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appMemoPath,
      compactStatePath,
      createdTaskIds: result.createdTaskIds,
      frontierTaskIds: result.desiredExactFrontierTaskIds,
      featureTaskId: compactState.features[featureKey]?.taskId ?? null,
      featureFrontierTaskIds:
        compactState.features[featureKey]?.frontierTaskIds ?? null,
      reviewEvidencePath:
        compactState.features[featureKey]?.reviewEvidencePath ?? null,
    },
    null,
    2,
  ),
);
