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

type MutableRecord = Record<string, unknown>;

const attemptId =
  "a_ops-apply-reconcile-virtualmachines-agentpool-compact-frontier-20260716-state-repair_20260716141035";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const repairedAt = new Date().toISOString();
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "virtualmachines-agentpool";
const familyHolderTaskId =
  "hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b";
const cliHolderTaskId =
  "hold-compact-virtualmachines-agentpool-cli-add-multi-sku-reviewed-exception-frontier-20260713";
const autoZoneTaskId =
  "hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708";
const row61TaskId =
  "hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708";
const row75Row76TaskId =
  "hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708";
const domainMemoPath =
  "../aks-rp-e2e/evidence/archive/reconcile-virtualmachines-agentpool-compact-frontier-20260716.md";
const memoPath =
  "evidence/archive/ops-apply-reconcile-virtualmachines-agentpool-compact-frontier-20260716-state-repair.md";

const liveRuntimeFrontierTaskIds = [
  autoZoneTaskId,
  row61TaskId,
  row75Row76TaskId,
  familyHolderTaskId,
] as const;

const runtimeRepresentedMembers = {
  "spec.virtualmachines.auto-zone-single-sku": autoZoneTaskId,
  "spec.virtualmachines.auto-zone-mixed-sku": autoZoneTaskId,
  "spec.virtualmachine-prerelease.row61-core-addon-compatibility": row61TaskId,
  "spec.virtualmachine-prerelease.row75-aksconformance-core": row75Row76TaskId,
  "spec.virtualmachine-prerelease.row76-aksconformance-tunnel": row75Row76TaskId,
} as const;

const preservedBySpecModelOnly = [
  "spec.virtualmachines.cli-add-multi-sku",
  "spec.virtualmachines.managedsystem-combined",
  "spec.virtualmachines.pool-delete-rest",
  "spec.virtualmachines.vmas-to-vms-migration-slb",
] as const;

const familyGoal =
  "Preserve one maintained runtime-only compact-family holder for the current virtualmachines-agentpool live frontier by mapping only the auto-zone pair, row61, and row75/row76 to exact active runtime waits while leaving cli-add-multi-sku, managedsystem-combined, pool-delete-rest, and vmas-to-vms-migration-slb preserved only by current spec/model evidence.";
const familyAcceptance = [
  "The holder records the runtime-only live compact frontier for exactly five virtualmachines-agentpool members: auto-zone single-sku, auto-zone mixed-sku, row61 core-addon-compatibility, row75 aksconformance-core, and row76 aksconformance-tunnel.",
  "The holder maps those five live members only to hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708, hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708, and hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708, without counting cli-add-multi-sku, managedsystem-combined, pool-delete-rest, or vmas-to-vms-migration-slb as live compact blocked waits.",
  "The holder keeps liveDispatchGate.allowed=false posture explicit and preserves that the compact summary/diagnostics still record the broader historical 9-member split frontier while live compact blocked-wait accounting is narrowed to the remaining active runtime waits only.",
];
const familyCondition =
  "2026-07-16 compact-frontier state repair applied the reviewed runtime-only narrowing for virtualmachines-agentpool. The live compact blocked frontier now keeps only the active runtime waits: auto-zone single-sku and auto-zone mixed-sku -> hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708; row61 core-addon-compatibility -> hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708; row75 aksconformance-core and row76 aksconformance-tunnel -> hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708. spec.virtualmachines.cli-add-multi-sku, spec.virtualmachines.managedsystem-combined, spec.virtualmachines.pool-delete-rest, and spec.virtualmachines.vmas-to-vms-migration-slb remain preserved by current spec/spec-loop/model evidence only and are intentionally out of live compact blocked-wait accounting. Compact diagnostics still classify the feature as repo-local-spec-metadata-split-frontier, so no unchanged broad compact rerun or family collapse is truthful now.";
const familyResumeCondition =
  "Resume only when one remaining active virtualmachines-agentpool runtime wait materially changes, a currently preserved non-live member is intentionally reintroduced into live compact eligibility, or compact eligibility policy changes reopen a truthful narrower rerun subset.";
const compactOwnerReason =
  "The live controller-visible virtualmachines-agentpool compact frontier is now intentionally runtime-only: auto-zone, row61, and row75/row76 remain the active waits, while cli-add-multi-sku, managedsystem-combined, pool-delete-rest, and vmas-to-vms-migration-slb stay preserved by spec/spec-loop/model authority only and no longer contribute live compact blocked-wait accounting.";
const compactSummary =
  "Narrowed the virtualmachines-agentpool live compact blocked frontier to the runtime-only family: auto-zone, row61, and row75/row76 remain represented by active compact waits, while cli-add-multi-sku, managedsystem-combined, pool-delete-rest, and vmas-to-vms-migration-slb remain preserved only by current spec/model evidence.";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

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
  ].sort((a, b) => a.localeCompare(b));
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, memoPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${content}\n`, "utf-8");
}

const { state: compactState, path: compactStatePath } =
  loadFeatureCompactLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: 1,
    refreshFromProject: false,
  });

const featureBefore = compactState.features[featureKey];
if (!featureBefore) {
  throw new Error(`Missing compact feature state for ${featureKey}`);
}

const beforeCompact = {
  taskId: featureBefore.taskId ?? null,
  frontierTaskIds: featureBefore.frontierTaskIds ?? null,
  waitingFor: featureBefore.waitingFor ?? null,
  reviewEvidencePath: featureBefore.reviewEvidencePath ?? null,
  summary: featureBefore.summary ?? null,
  nextStepClassification: featureBefore.nextStepClassification ?? null,
};

const treeRepair = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[loopTaskId];
  const familyHolder = tree.tasks[familyHolderTaskId];
  const cliHolder = tree.tasks[cliHolderTaskId];
  if (!loopTask) throw new Error(`Task not found: ${loopTaskId}`);
  if (!familyHolder) throw new Error(`Task not found: ${familyHolderTaskId}`);
  if (!tree.tasks[autoZoneTaskId]) throw new Error(`Task not found: ${autoZoneTaskId}`);
  if (!tree.tasks[row61TaskId]) throw new Error(`Task not found: ${row61TaskId}`);
  if (!tree.tasks[row75Row76TaskId]) throw new Error(`Task not found: ${row75Row76TaskId}`);
  if (!cliHolder) throw new Error(`Task not found: ${cliHolderTaskId}`);

  const familyBlockerBefore = asRecord(familyHolder.blocker);
  const familyWaitingForBefore = asRecord(familyBlockerBefore.waiting_for);
  const familyObservedBy = asRecord(familyBlockerBefore.observed_by);
  const familyObservationMethod =
    asString(familyBlockerBefore.observation_method) ||
    "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.";
  const familyNextCheckAt =
    asString(familyBlockerBefore.next_check_at) || repairedAt;
  const familyFallbackAt =
    asString(familyBlockerBefore.fallback_at) || familyNextCheckAt;
  const familyFallbackAction =
    asString(familyBlockerBefore.fallback_action) ||
    "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.";
  const familyBlockedAt =
    asString(familyBlockerBefore.blocked_at) ||
    asString(featureBefore.blockedAt) ||
    repairedAt;

  familyHolder.goal = familyGoal;
  familyHolder.inputs = unique([...asStringArray(familyHolder.inputs), domainMemoPath]);
  familyHolder.outputs = unique([...asStringArray(familyHolder.outputs), memoPath]);
  familyHolder.acceptance = [...familyAcceptance];
  familyHolder.context = {
    ...asRecord(familyHolder.context),
    featureKey,
    representedTaskIds: [...liveRuntimeFrontierTaskIds],
    representedMembers: { ...runtimeRepresentedMembers },
    liveRuntimeSpecIds: Object.keys(runtimeRepresentedMembers),
    preservedOutsideLiveCompactSpecIds: [...preservedBySpecModelOnly],
    preservedOutsideLiveCompactReason:
      "These members remain preserved by current spec/spec-loop/model evidence only and intentionally do not participate in live compact blocked-wait accounting.",
  };
  familyHolder.blocker = {
    ...familyBlockerBefore,
    condition: familyCondition,
    category: asString(familyBlockerBefore.category) || "external-wait",
    owner: asString(familyBlockerBefore.owner) || "aks-explorer",
    blocked_at: familyBlockedAt,
    waiting_for: {
      ...familyWaitingForBefore,
      type: "frontier.changed",
      taskId: familyHolderTaskId,
      featureKey,
      representedTaskIds: [...liveRuntimeFrontierTaskIds],
    },
    observed_by: familyObservedBy,
    observation_method: familyObservationMethod,
    next_check_at: familyNextCheckAt,
    resume_condition: familyResumeCondition,
    fallback_at: familyFallbackAt,
    fallback_action: familyFallbackAction,
    resume_at: familyNextCheckAt,
  };
  familyHolder.trace = {
    ...asRecord(familyHolder.trace),
    compact_frontier_narrowed_at: repairedAt,
    compact_frontier_narrowed_by: worker,
    compact_frontier_narrowed_attempt_id: attemptId,
  };

  const cliBefore = {
    state: cliHolder.state ?? null,
    status: cliHolder.status ?? null,
    blocker: cliHolder.blocker ?? null,
  };

  const cliWasBlocked =
    String(cliHolder.state ?? cliHolder.status ?? "") === "blocked" ||
    String(cliHolder.status ?? cliHolder.state ?? "") === "blocked";

  cliHolder.state = "done";
  cliHolder.status = "done";
  (cliHolder as TaskNode & { resolution?: string }).resolution = "terminal";
  (cliHolder as TaskNode & { done_at?: string }).done_at = repairedAt;
  (cliHolder as TaskNode & { done_by?: string }).done_by = worker;
  (cliHolder as TaskNode & { result?: string }).result =
    `Retired ${cliHolderTaskId} from the live virtualmachines-agentpool compact blocked frontier. Preserve spec.virtualmachines.cli-add-multi-sku only through current spec/spec-loop/model reviewed-exception evidence; live compact blocked-wait accounting is now limited to ${autoZoneTaskId}, ${row61TaskId}, ${row75Row76TaskId}, and ${familyHolderTaskId}.`;
  delete (cliHolder as MutableRecord).blocker;
  cliHolder.trace = {
    ...asRecord(cliHolder.trace),
    compact_frontier_retired_at: repairedAt,
    compact_frontier_retired_by: worker,
    compact_frontier_retired_attempt_id: attemptId,
    compact_frontier_retire_reason:
      "CLI multi-SKU remains terminal reviewed-exception/spec-model evidence only and no longer participates in live compact blocked-wait accounting.",
  };
  cliHolder.context = {
    ...asRecord(cliHolder.context),
    retiredFromLiveCompactFrontierAt: repairedAt,
    retiredFromLiveCompactFrontierBy: worker,
    preservedBySpecModelOnly: true,
    preservedBySpecModelSpecIds: ["spec.virtualmachines.cli-add-multi-sku"],
    liveCompactReplacementTaskIds: [...liveRuntimeFrontierTaskIds],
  };

  const loopContext = asRecord(loopTask.context);
  const workflowProgress = asRecord(loopContext.workflowProgress);
  const representedFeatureKeys = asStringArray(workflowProgress.representedFeatureKeys).filter(
    (value) => value !== "virtualmachines-agentpool:cli-add-multi-sku",
  );
  workflowProgress.representedFeatureKeys = unique(representedFeatureKeys);
  if (cliWasBlocked) {
    for (const field of ["blockedWaitChildren", "blockedWaitBlockedCount", "blocked"]) {
      const value = workflowProgress[field];
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        workflowProgress[field] = value - 1;
      }
    }
    const doneValue = workflowProgress.done;
    if (typeof doneValue === "number" && Number.isFinite(doneValue)) {
      workflowProgress.done = doneValue + 1;
    }
  }
  workflowProgress.updatedAt = repairedAt;
  loopContext.workflowProgress = workflowProgress;
  loopTask.context = loopContext;

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    familyBefore: {
      goal: familyHolder.goal ?? null,
      waitingFor: familyWaitingForBefore,
    },
    familyAfter: {
      goal: familyHolder.goal ?? null,
      waitingFor: asRecord(asRecord(familyHolder.blocker).waiting_for),
      representedMembers: asRecord(asRecord(familyHolder.context).representedMembers),
      preservedOutsideLiveCompactSpecIds: asStringArray(
        asRecord(familyHolder.context).preservedOutsideLiveCompactSpecIds,
      ),
    },
    cliBefore,
    cliAfter: {
      state: cliHolder.state ?? null,
      status: cliHolder.status ?? null,
      resolution: (cliHolder as TaskNode & { resolution?: string }).resolution ?? null,
      result: (cliHolder as TaskNode & { result?: string }).result ?? null,
    },
    workflowProgress: {
      blocked: workflowProgress.blocked ?? null,
      done: workflowProgress.done ?? null,
      blockedWaitChildren: workflowProgress.blockedWaitChildren ?? null,
      blockedWaitBlockedCount: workflowProgress.blockedWaitBlockedCount ?? null,
      representedFeatureKeys: workflowProgress.representedFeatureKeys ?? null,
    },
  };
});

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  errorClass: "package-partial",
  retryable: false,
  taskId: familyHolderTaskId,
  frontierTaskIds: [...liveRuntimeFrontierTaskIds],
  retryReason: familyResumeCondition,
  rootCauseClassification: featureBefore.rootCauseClassification ?? "repo-local-spec-metadata-split-frontier",
  ownerReason: compactOwnerReason,
  attemptedFixes: unique([
    ...(Array.isArray(featureBefore.attemptedFixes) ? featureBefore.attemptedFixes : []),
    `${attemptId}: narrowed the live virtualmachines-agentpool compact frontier to runtime waits only by repointing controller-visible state at ${familyHolderTaskId}, retiring ${cliHolderTaskId} from live compact blocked-wait accounting, and preserving cli-add/managedsystem/pool-delete/vmas only through current spec/spec-loop/model evidence.`,
  ]),
  nextStepClassification:
    "preserve the runtime-only virtualmachines-agentpool compact frontier (auto-zone pair, row61, row75/row76 plus maintained family summary) and re-review only when one of those exact waits or live-ready eligibility changes",
  resumeCondition: familyResumeCondition,
  blockedAt: featureBefore.blockedAt ?? repairedAt,
  blockedReason: familyCondition,
  waitingFor: {
    type: "frontier.changed",
    taskId: familyHolderTaskId,
    featureKey,
    representedTaskIds: [...liveRuntimeFrontierTaskIds],
  },
  waitingCondition: familyResumeCondition,
  observedBy: featureBefore.observedBy ?? {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.planning.requested",
  },
  observationMethod:
    featureBefore.observationMethod ??
    "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  nextCheckAt: featureBefore.nextCheckAt ?? repairedAt,
  blockerOwner: featureBefore.blockerOwner ?? "aks-explorer",
  fallbackAt: featureBefore.fallbackAt ?? featureBefore.nextCheckAt ?? repairedAt,
  fallbackAction:
    featureBefore.fallbackAction ??
    "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.",
  resumeAction:
    "Keep the compact branch blocked until one active runtime wait materially changes or planner/app-ops intentionally remodels the live frontier again.",
  blockedScope: featureBefore.blockedScope ?? {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: featureBefore.blockedFingerprint ?? {
    errorClass: "package-partial",
    target: "staging",
    branch: "dev",
    featureKey,
  },
  lastCheckedAt: repairedAt,
  updatedAt: repairedAt,
  evidencePaths: unique([
    ...(Array.isArray(featureBefore.evidencePaths) ? featureBefore.evidencePaths : []),
    domainMemoPath,
    memoPath,
  ]),
  reviewEvidencePath: memoPath,
  verificationBlocker:
    "Do not rerun unchanged. This repair narrows live compact blocked-wait accounting to the remaining active runtime waits only; cli-add-multi-sku, managedsystem-combined, pool-delete-rest, and vmas-to-vms-migration-slb remain preserved by current spec/spec-loop/model authority.",
  summary: compactSummary,
  lastSummary: compactSummary,
});

saveFeatureCompactLoopState(compactStatePath, compactState);

const featureAfter = compactState.features[featureKey];
if (!featureAfter) {
  throw new Error(`Feature state missing after update: ${featureKey}`);
}

const memo = `# App-ops apply: virtualmachines-agentpool compact frontier narrowing — 2026-07-16

- Task: \`ops-apply-reconcile-virtualmachines-agentpool-compact-frontier-20260716-state-repair\`
- Attempt: \`${attemptId}\`
- Applied at: \`${repairedAt}\`
- Domain review memo: \`${domainMemoPath}\`
- App evidence memo: \`${memoPath}\`

## Baseline before repair

- Controller-visible compact feature row pointed at \`${beforeCompact.taskId}\`.
- Controller-visible frontierTaskIds were ${JSON.stringify(beforeCompact.frontierTaskIds)}.
- Controller-visible waitingFor was:

\`\`\`json
${JSON.stringify(beforeCompact.waitingFor, null, 2)}
\`\`\`

- Live compact task tree still had blocked holder \`${cliHolderTaskId}\` even though current spec/spec-loop authority already preserves \`spec.virtualmachines.cli-add-multi-sku\` as reviewed-exception / product-gap terminal evidence.

## Applied repair

### Maintained live compact holder narrowed to runtime waits only

The family holder \`${familyHolderTaskId}\` now represents only these live compact frontier task ids:

\`\`\`json
${JSON.stringify(liveRuntimeFrontierTaskIds, null, 2)}
\`\`\`

and only these live members:

\`\`\`json
${JSON.stringify(runtimeRepresentedMembers, null, 2)}
\`\`\`

The following members stay preserved outside live compact blocked-wait accounting through current spec/spec-loop/model evidence only:

\`\`\`json
${JSON.stringify(preservedBySpecModelOnly, null, 2)}
\`\`\`

### CLI compact holder retired from live accounting

The previously live compact holder \`${cliHolderTaskId}\` is now a done/terminal historical task rather than an active compact blocked wait.

### Controller-visible compact state synchronized

After repair, \`.state/feature-compact-loop/state.json\` now points \`${featureKey}\` at the maintained runtime-only family holder and the narrowed represented frontier:

\`\`\`json
${JSON.stringify(
  {
    taskId: featureAfter.taskId ?? null,
    frontierTaskIds: featureAfter.frontierTaskIds ?? null,
    waitingFor: featureAfter.waitingFor ?? null,
    reviewEvidencePath: featureAfter.reviewEvidencePath ?? null,
    summary: featureAfter.summary ?? null,
    nextStepClassification: featureAfter.nextStepClassification ?? null,
  },
  null,
  2,
)}
\`\`\`

## Spec-loop note

No direct \`.state/spec-loop/state.json\` mutation was required. The current spec-loop records already preserve:
- auto-zone pair as pending on \`wait-virtualmachines-auto-zone-same-request-shape-gate-20260702\`
- row61 as pending on its exact run-28721673014 frontier
- row75/row76 as pending on their exact run-28721673014 frontiers
- cli-add-multi-sku / managedsystem-combined / pool-delete-rest / vmas-to-vms-migration-slb as already-final non-live or terminal evidence surfaces.

## Verification snapshot

### Family holder after

\`\`\`json
${JSON.stringify(treeRepair.familyAfter, null, 2)}
\`\`\`

### CLI holder after

\`\`\`json
${JSON.stringify(treeRepair.cliAfter, null, 2)}
\`\`\`

### Loop workflowProgress after

\`\`\`json
${JSON.stringify(treeRepair.workflowProgress, null, 2)}
\`\`\`
`;

writeMemo(memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      repairedAt,
      memoPath,
      beforeCompact,
      afterCompact: {
        taskId: featureAfter.taskId ?? null,
        frontierTaskIds: featureAfter.frontierTaskIds ?? null,
        waitingFor: featureAfter.waitingFor ?? null,
        reviewEvidencePath: featureAfter.reviewEvidencePath ?? null,
        summary: featureAfter.summary ?? null,
        nextStepClassification: featureAfter.nextStepClassification ?? null,
      },
      treeRepair,
    },
    null,
    2,
  ),
);
