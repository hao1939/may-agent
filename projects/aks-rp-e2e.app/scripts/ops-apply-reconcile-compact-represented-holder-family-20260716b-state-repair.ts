import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
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

type RepairSpec = {
  featureKey:
    | "ccp-agent"
    | "ccp-autoupgrader-pipeline"
    | "ccp-security-patch-os-variants"
    | "ccp-vpa-os-arch-variants"
    | "cost-analysis"
    | "jwt-authenticator"
    | "sgx-addon-vm-prerelease-matrix"
    | "traffic-alb-controller"
    | "trusted-access";
  holderTaskId: string;
  windowSourceTaskId: string;
  waitingForSource: "holder" | "window-source";
  frontierTaskIds: string[];
  ownerReason: string;
  nextStepClassification: string;
  verificationBlocker: string;
  summary: string;
  alignHolderWindowToWindowSource?: boolean;
  persistFrontierIdsOnHolderContext?: boolean;
};

type HolderSnapshot = {
  id: string;
  next_check_at: string | null;
  fallback_at: string | null;
  contextFrontierTaskIds: string[];
  contextCompactFrontierTaskIds: string[];
  contextReviewEvidencePath: string | null;
};

type FeatureSnapshot = {
  taskId: string | null;
  frontierTaskIds: string[] | null;
  waitingFor: MutableRecord | null;
  ownerReason: string | null;
  blockedReason: string | null;
  waitingCondition: string | null;
  nextCheckAt: string | null;
  fallbackAt: string | null;
  reviewEvidencePath: string | null;
  nextStepClassification: string | null;
  verificationBlocker: string | null;
  summary: string | null;
};

const retiredJwtWaitId =
  "wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708";
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-reconcile-compact-represented-holder-family-20260716b-state-repair_20260716152307";
const repairTaskId =
  "ops-apply-reconcile-compact-represented-holder-family-20260716b-state-repair";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const repairedAt = new Date().toISOString();
const loopTaskId = "aks-feature-compact-loop";
const reviewMemoPath =
  "evidence/archive/ops-reconcile-compact-represented-holder-family-20260716b.md";
const appMemoPath =
  "evidence/archive/ops-apply-reconcile-compact-represented-holder-family-20260716b-state-repair.md";
const compactStateFile = resolve(appDir, ".state/feature-compact-loop/state.json");
const specLoopFile = resolve(appDir, ".state/spec-loop/state.json");
const taskTreeFile = resolve(appDir, ".state/tasks/tree.json");

const repairs: RepairSpec[] = [
  {
    featureKey: "ccp-agent",
    holderTaskId: "hold-compact-ccp-agent-reviewed-exception-frontier",
    windowSourceTaskId:
      "wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708",
    waitingForSource: "holder",
    frontierTaskIds: [],
    ownerReason:
      "The only remaining compact-facing blocker is the represented downstream wait wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708 for spec.ccp.tunnelfront-konnectivity-migration, so this holder must stay a one-member split-frontier projection rather than reopening the retired mixed promotion frontier.",
    nextStepClassification:
      "preserve the one-member represented split-frontier holder until wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708 materially changes; do not recreate the retired mixed promotion frontier or rerun compact unchanged",
    verificationBlocker:
      "Do not rerun unchanged. The truthful remaining compact blocker is only the represented migration lineage-excerpt wait wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708.",
    summary:
      "Refreshed ccp-agent compact watch windows to mirror wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708 while preserving the exact one-member represented split-frontier holder semantics.",
    alignHolderWindowToWindowSource: true,
  },
  {
    featureKey: "ccp-autoupgrader-pipeline",
    holderTaskId:
      "hold-compact-ccp-autoupgrader-pipeline-reviewed-exception-frontier",
    windowSourceTaskId:
      "hold-compact-ccp-autoupgrader-pipeline-reviewed-exception-frontier",
    waitingForSource: "holder",
    frontierTaskIds: [],
    ownerReason:
      "The sole compact member remains spec.ccp-autoupgrader.pipeline-daily-master as a source-grounded pipeline-only carrier, so this holder stays the exact self-governed proof ceiling until authoritative pipeline 459172 access or a returned same-path artifact exists.",
    nextStepClassification:
      "preserve the pipeline-only proof ceiling until authoritative pipeline 459172 access or a returned same-path artifact materially changes the frontier; do not imply generic staging recovery or rerun compact unchanged",
    verificationBlocker:
      "Do not rerun unchanged. Stronger same-path proof still requires authoritative pipeline 459172 access or a returned authoritative artifact.",
    summary:
      "Preserved ccp-autoupgrader-pipeline as the exact self-governed pipeline-only proof ceiling and restamped the compact row to the holder's current future watch window.",
  },
  {
    featureKey: "ccp-security-patch-os-variants",
    holderTaskId:
      "hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier-20260713",
    windowSourceTaskId:
      "wait-ccp-security-patch-reviewed-exception-owner-response-20260708",
    waitingForSource: "holder",
    frontierTaskIds: [],
    ownerReason:
      "Accepted MarinerV2 retirement/alias evidence already removed the retired Linux branch from this compact frontier. The only remaining compact blocker is the represented Windows source-authority wait wait-ccp-security-patch-reviewed-exception-owner-response-20260708 for Windows2022 and Windows2025.",
    nextStepClassification:
      "preserve the exact represented Windows source-authority wait until wait-ccp-security-patch-reviewed-exception-owner-response-20260708 materially changes; do not restore MarinerV2 lineage or rerun unchanged reviewed-exception coverage",
    verificationBlocker:
      "Do not rerun unchanged. The truthful remaining frontier is only the represented Windows source-authority/source-change wait, and MarinerV2 stays retired unless accepted evidence reopens that lineage.",
    summary:
      "Refreshed ccp-security-patch-os-variants compact watch windows to mirror wait-ccp-security-patch-reviewed-exception-owner-response-20260708 while preserving the exact Windows-only represented holder semantics.",
    alignHolderWindowToWindowSource: true,
  },
  {
    featureKey: "ccp-vpa-os-arch-variants",
    holderTaskId:
      "hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier",
    windowSourceTaskId:
      "hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier",
    waitingForSource: "holder",
    frontierTaskIds: [],
    ownerReason:
      "The only compact member remains blocked by the accepted final environment ceiling: CCP pipeline 459172 is unavailable in project staging or ARM64 node pools with Kubernetes >= 1.34 remain absent. This holder must stay the exact self-governed final ceiling rather than a generic refresh placeholder.",
    nextStepClassification:
      "preserve the exact final environment ceiling until CCP pipeline 459172 becomes available in project staging or ARM64 node pools with Kubernetes >= 1.34 are added; do not reopen broad unchanged compact reruns",
    verificationBlocker:
      "Do not rerun unchanged. The truthful blocker remains the accepted CCP pipeline / ARM64 Kubernetes >= 1.34 environment ceiling.",
    summary:
      "Preserved ccp-vpa-os-arch-variants as the exact self-governed final environment ceiling and refreshed the compact row to the holder's current blocker wording and watch window.",
  },
  {
    featureKey: "cost-analysis",
    holderTaskId: "hold-compact-cost-analysis-reviewed-exception-frontier",
    windowSourceTaskId:
      "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
    waitingForSource: "window-source",
    frontierTaskIds: [
      "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
    ],
    ownerReason:
      "The compact cost-analysis holder is only the feature-facing projection of the shared underlay/runtime-input family wait wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708, so controller-visible metadata must point back to that governed family instead of a generic local environment wait.",
    nextStepClassification:
      "preserve cost-analysis only as the compact-facing projection of wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708 until returned inputs, an exact decline, or authoritative reroute materially changes that same family",
    verificationBlocker:
      "Do not rerun unchanged. Any truthful next move still depends on returned same-lineage underlay/runtime inputs from wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708.",
    summary:
      "Rebound cost-analysis compact projection metadata to wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708 and mirrored that governing shared wait's watch window.",
    persistFrontierIdsOnHolderContext: true,
  },
  {
    featureKey: "jwt-authenticator",
    holderTaskId: "hold-compact-jwt-authenticator-package-partial-frontier",
    windowSourceTaskId: "hold-compact-jwt-authenticator-package-partial-frontier",
    waitingForSource: "holder",
    frontierTaskIds: [],
    ownerReason:
      "The surviving compact holder is now the single live same-lineage no-current-surface carrier for the in-cluster Dex ClusterIP issuer path. Controller-visible compact metadata must stay on that final ceiling and must not revive the retired shared wait or duplicate owner-chase work.",
    nextStepClassification:
      "preserve jwt-authenticator as the single live no-current-surface carrier until a materially new same-path surface, concrete internal handoff, or exact authoritative reroute lands; do not recreate the retired shared wait",
    verificationBlocker:
      "Do not rerun unchanged. Current accepted evidence says there is no controller-visible same-path execution surface for the Dex ClusterIP issuer boundary outside internal Go e2ev3 E2E.",
    summary:
      "Removed the retired shared JWT wait reference from compact controller-visible state and preserved jwt-authenticator as the single live same-lineage no-current-surface final ceiling.",
  },
  {
    featureKey: "sgx-addon-vm-prerelease-matrix",
    holderTaskId:
      "hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier",
    windowSourceTaskId:
      "wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703",
    waitingForSource: "window-source",
    frontierTaskIds: [
      "wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703",
    ],
    ownerReason:
      "This compact holder remains only the feature-facing projection of the exact SGX owner live-carrier decision wait wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703, so controller-visible metadata must bind to that wait instead of a generic publish-auth placeholder.",
    nextStepClassification:
      "preserve the SGX compact projection only as the represented owner live-carrier decision wait until wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703 materially changes",
    verificationBlocker:
      "Do not rerun unchanged. The governing limitation is still the absence of an owner-approved row-exact SGX live carrier, not a package/runtime failure.",
    summary:
      "Rebound sgx-addon-vm-prerelease-matrix compact projection metadata to wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703 and mirrored that governing wait's watch window.",
    persistFrontierIdsOnHolderContext: true,
  },
  {
    featureKey: "traffic-alb-controller",
    holderTaskId: "hold-compact-traffic-alb-controller-package-partial-frontier",
    windowSourceTaskId:
      "hold-compact-traffic-alb-controller-package-partial-frontier",
    waitingForSource: "holder",
    frontierTaskIds: [],
    ownerReason:
      "The only remaining compact blocker is the cleanup-only authority gap for spec.traffic-alb-controller.enable-lifecycle. This holder must remain the exact self-governed final ceiling and must not absorb the separate ready datapath pair work.",
    nextStepClassification:
      "preserve the cleanup-only authority-gap final ceiling until exact ALB disable or cleanup authority changes; do not fold the ready ingress-routing / upgrade-survival datapath pair back into this holder",
    verificationBlocker:
      "Do not rerun unchanged. The remaining truthful blocker is only the cleanup-only authority gap for spec.traffic-alb-controller.enable-lifecycle.",
    summary:
      "Preserved traffic-alb-controller as the exact cleanup-only self-governed final ceiling and refreshed the compact row to the holder's current blocker wording and watch window.",
  },
  {
    featureKey: "trusted-access",
    holderTaskId:
      "hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705",
    windowSourceTaskId:
      "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711",
    waitingForSource: "window-source",
    frontierTaskIds: [
      "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711",
    ],
    ownerReason:
      "The compact trusted-access holder remains only the exact sibling projection of the shared TA gateway DNS/runtime family wait wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711, so controller-visible metadata must point to that shared runtime-family steward rather than back to the compact holder itself.",
    nextStepClassification:
      "preserve trusted-access as the compact-facing sibling of wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711 until reviewed same-runtime evidence, an approved alternate surface, or accepted reclassification materially changes the shared runtime-family blocker",
    verificationBlocker:
      "Do not rerun unchanged. The truthful blocker remains the shared TA gateway DNS/runtime family wait until reviewed runtime evidence materially changes *.ta.azmk8s.io reachability.",
    summary:
      "Rebound trusted-access compact projection metadata to wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711 and mirrored that governing shared wait's watch window.",
    persistFrontierIdsOnHolderContext: true,
  },
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as MutableRecord)
    : {};
}

function cloneRecord(value: unknown): MutableRecord {
  return { ...asRecord(value) };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value && value.trim()))),
  ].sort((a, b) => a.localeCompare(b));
}

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function featureSnapshot(item: FeatureCompactItemState | undefined): FeatureSnapshot | null {
  if (!item) return null;
  return {
    taskId: item.taskId ?? null,
    frontierTaskIds: item.frontierTaskIds ?? null,
    waitingFor: item.waitingFor ? jsonClone(item.waitingFor) : null,
    ownerReason: item.ownerReason ?? null,
    blockedReason: item.blockedReason ?? null,
    waitingCondition: item.waitingCondition ?? null,
    nextCheckAt: item.nextCheckAt ?? null,
    fallbackAt: item.fallbackAt ?? null,
    reviewEvidencePath: item.reviewEvidencePath ?? null,
    nextStepClassification: item.nextStepClassification ?? null,
    verificationBlocker: item.verificationBlocker ?? null,
    summary: item.summary ?? null,
  };
}

function holderSnapshot(task: TaskNode | undefined): HolderSnapshot | null {
  if (!task) return null;
  const blocker = asRecord(task.blocker);
  const context = asRecord(task.context);
  return {
    id: task.id,
    next_check_at: asString(blocker.next_check_at),
    fallback_at: asString(blocker.fallback_at),
    contextFrontierTaskIds: asStringArray(context.frontierTaskIds),
    contextCompactFrontierTaskIds: asStringArray(context.compactFrontierTaskIds),
    contextReviewEvidencePath: asString(context.reviewEvidencePath),
  };
}

function writeMemo(content: string): void {
  const absolute = resolve(appDir, appMemoPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${content}\n`, "utf-8");
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const taskTreeHashBefore = fileHash(taskTreeFile);
const specLoopHashBefore = fileHash(specLoopFile);
const compactHashBefore = fileHash(compactStateFile);
const baselineTree = readTaskTree(config);
const baselineCompactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const baselineCompactState = baselineCompactLoaded.state;

const beforeHolderSnapshots = Object.fromEntries(
  repairs.map((repair) => [repair.featureKey, holderSnapshot(baselineTree.tasks[repair.holderTaskId])]),
);
const beforeFeatureSnapshots = Object.fromEntries(
  repairs.map((repair) => [repair.featureKey, featureSnapshot(baselineCompactState.features[repair.featureKey])]),
);

const treeAfterApply = withTreeLock(config, () => {
  const tree = readTaskTree(config);

  for (const repair of repairs) {
    const holder = tree.tasks[repair.holderTaskId];
    assert(holder, `Missing holder task ${repair.holderTaskId}`);
    const windowSource = tree.tasks[repair.windowSourceTaskId];
    assert(windowSource, `Missing window-source task ${repair.windowSourceTaskId}`);

    holder.state = "blocked";
    holder.status = "blocked";
    holder.outputs = unique([
      ...asStringArray(holder.outputs),
      ".state/feature-compact-loop/state.json",
      appMemoPath,
    ]);

    const context = cloneRecord(holder.context);
    context.featureCompactExactWait = true;
    context.featureKey = repair.featureKey;
    context.reviewEvidencePath = appMemoPath;
    if (repair.persistFrontierIdsOnHolderContext) {
      context.frontierTaskIds = [...repair.frontierTaskIds];
      context.compactFrontierTaskIds = [...repair.frontierTaskIds];
    }
    holder.context = context;

    const blocker = cloneRecord(holder.blocker);
    if (repair.alignHolderWindowToWindowSource) {
      const windowBlocker = asRecord(windowSource.blocker);
      const nextCheckAt = asString(windowBlocker.next_check_at);
      const fallbackAt = asString(windowBlocker.fallback_at);
      assert(nextCheckAt, `Missing next_check_at on ${repair.windowSourceTaskId}`);
      assert(fallbackAt, `Missing fallback_at on ${repair.windowSourceTaskId}`);
      blocker.next_check_at = nextCheckAt;
      blocker.resume_at = nextCheckAt;
      blocker.fallback_at = fallbackAt;
    }
    holder.blocker = blocker;

    holder.trace = {
      ...asRecord(holder.trace),
      compact_represented_holder_family_repaired_at: repairedAt,
      compact_represented_holder_family_repaired_by: worker,
      compact_represented_holder_family_repair_attempt_id: attemptId,
      compact_represented_holder_family_repair_evidence_path: appMemoPath,
    };
  }

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return readTaskTree(config);
});

const taskTreeHashAfterTreeApply = fileHash(taskTreeFile);
assert(
  taskTreeHashBefore !== taskTreeHashAfterTreeApply,
  "Expected .state/tasks/tree.json to change during bounded repair",
);
assert(
  fileHash(specLoopFile) === specLoopHashBefore,
  ".state/spec-loop/state.json changed unexpectedly during task-tree repair",
);

const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactLoaded.state;

for (const repair of repairs) {
  const feature = compactState.features[repair.featureKey];
  assert(feature, `Missing compact feature row for ${repair.featureKey}`);

  const holder = treeAfterApply.tasks[repair.holderTaskId];
  assert(holder, `Missing repaired holder task ${repair.holderTaskId}`);
  const holderBlocker = asRecord(holder.blocker);
  const windowSource = treeAfterApply.tasks[repair.windowSourceTaskId];
  assert(windowSource, `Missing repaired window-source task ${repair.windowSourceTaskId}`);
  const windowBlocker = asRecord(windowSource.blocker);

  const waitingFor =
    repair.waitingForSource === "window-source"
      ? jsonClone(asRecord(windowBlocker.waiting_for))
      : jsonClone(asRecord(holderBlocker.waiting_for));
  const resumeCondition =
    asString(holderBlocker.resume_condition) ?? feature.resumeCondition ?? null;
  const blockedReason = asString(holderBlocker.condition) ?? feature.blockedReason ?? null;
  const nextCheckAt = asString(windowBlocker.next_check_at) ?? feature.nextCheckAt ?? null;
  const fallbackAt = asString(windowBlocker.fallback_at) ?? feature.fallbackAt ?? null;
  const observationMethod =
    asString(holderBlocker.observation_method) ?? feature.observationMethod ?? null;
  const blockerOwner = asString(holderBlocker.owner) ?? feature.blockerOwner ?? null;
  const evidencePaths = unique([
    ...asStringArray(feature.evidencePaths),
    reviewMemoPath,
    appMemoPath,
  ]);
  const attemptedFixes = unique([
    ...asStringArray(feature.attemptedFixes),
    `${attemptId}: refreshed ${repair.featureKey} compact represented-holder metadata using holder ${repair.holderTaskId} and watch-window source ${repair.windowSourceTaskId}.`,
  ]);

  updateFeatureCompactItem(compactState, repair.featureKey, {
    status: "blocked",
    errorClass: feature.errorClass ?? null,
    retryable: false,
    retryReason: resumeCondition,
    taskId: repair.holderTaskId,
    frontierTaskIds: [...repair.frontierTaskIds],
    ownerReason: repair.ownerReason,
    attemptedFixes,
    nextStepClassification: repair.nextStepClassification,
    resumeCondition,
    blockedAt: asString(holderBlocker.blocked_at) ?? feature.blockedAt ?? repairedAt,
    blockedReason,
    waitingFor,
    waitingCondition: resumeCondition,
    observedBy:
      Object.keys(asRecord(holderBlocker.observed_by)).length > 0
        ? jsonClone(asRecord(holderBlocker.observed_by))
        : feature.observedBy ?? null,
    observationMethod,
    nextCheckAt,
    blockerOwner,
    fallbackAt,
    fallbackAction: asString(holderBlocker.fallback_action) ?? feature.fallbackAction ?? null,
    resumeAction:
      feature.resumeAction ??
      (resumeCondition
        ? `Reset this feature compact record to pending only after ${resumeCondition}`
        : null),
    blockedScope:
      feature.blockedScope ?? {
        kind: "feature",
        ids: [repair.featureKey],
      },
    blockedFingerprint:
      feature.blockedFingerprint ?? {
        errorClass: feature.errorClass ?? "blocked",
        target: "staging",
        branch: "dev",
        featureKey: repair.featureKey,
      },
    lastCheckedAt: repairedAt,
    evidencePaths,
    reviewEvidencePath: appMemoPath,
    verificationBlocker: repair.verificationBlocker,
    summary: repair.summary,
    lastSummary: repair.summary,
  });
}

saveFeatureCompactLoopState(compactLoaded.path, compactState);

const taskTreeHashAfter = fileHash(taskTreeFile);
const specLoopHashAfter = fileHash(specLoopFile);
const compactHashAfter = fileHash(compactStateFile);
assert(
  taskTreeHashAfterTreeApply === taskTreeHashAfter,
  ".state/tasks/tree.json changed again unexpectedly after compact save",
);
assert(specLoopHashAfter === specLoopHashBefore, ".state/spec-loop/state.json changed unexpectedly");
assert(compactHashBefore !== compactHashAfter, "Expected .state/feature-compact-loop/state.json to change");

const treeAfter = readTaskTree(config);
const compactAfterLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactAfter = compactAfterLoaded.state;

const afterHolderSnapshots = Object.fromEntries(
  repairs.map((repair) => [repair.featureKey, holderSnapshot(treeAfter.tasks[repair.holderTaskId])]),
);
const afterFeatureSnapshots = Object.fromEntries(
  repairs.map((repair) => {
    const feature = compactAfter.features[repair.featureKey];
    assert(feature, `Missing compact feature row after save for ${repair.featureKey}`);

    const holder = treeAfter.tasks[repair.holderTaskId];
    assert(holder, `Missing holder task after save for ${repair.holderTaskId}`);
    const holderBlocker = asRecord(holder.blocker);
    const windowSource = treeAfter.tasks[repair.windowSourceTaskId];
    assert(windowSource, `Missing window source after save for ${repair.windowSourceTaskId}`);
    const windowBlocker = asRecord(windowSource.blocker);
    const expectedWaitingFor =
      repair.waitingForSource === "window-source"
        ? jsonClone(asRecord(windowBlocker.waiting_for))
        : jsonClone(asRecord(holderBlocker.waiting_for));

    assert(
      JSON.stringify(feature.waitingFor ?? null) === JSON.stringify(expectedWaitingFor),
      `${repair.featureKey} waitingFor mismatch after repair`,
    );
    assert(
      JSON.stringify(feature.frontierTaskIds ?? null) === JSON.stringify(repair.frontierTaskIds),
      `${repair.featureKey} frontierTaskIds mismatch after repair`,
    );
    assert(
      feature.nextCheckAt === (asString(windowBlocker.next_check_at) ?? null),
      `${repair.featureKey} nextCheckAt mismatch after repair`,
    );
    assert(
      feature.fallbackAt === (asString(windowBlocker.fallback_at) ?? null),
      `${repair.featureKey} fallbackAt mismatch after repair`,
    );
    assert(
      feature.reviewEvidencePath === appMemoPath,
      `${repair.featureKey} reviewEvidencePath mismatch after repair`,
    );

    if (repair.persistFrontierIdsOnHolderContext) {
      const holderContext = asRecord(holder.context);
      assert(
        JSON.stringify(asStringArray(holderContext.frontierTaskIds)) ===
          JSON.stringify(repair.frontierTaskIds),
        `${repair.holderTaskId} context.frontierTaskIds mismatch after repair`,
      );
    }
    if (repair.alignHolderWindowToWindowSource) {
      assert(
        asString(holderBlocker.fallback_at) === (asString(windowBlocker.fallback_at) ?? null),
        `${repair.holderTaskId} holder fallback_at did not mirror ${repair.windowSourceTaskId}`,
      );
      assert(
        asString(holderBlocker.next_check_at) === (asString(windowBlocker.next_check_at) ?? null),
        `${repair.holderTaskId} holder next_check_at did not mirror ${repair.windowSourceTaskId}`,
      );
    }
    if (repair.featureKey === "jwt-authenticator") {
      for (const field of [
        feature.ownerReason,
        feature.blockedReason,
        feature.waitingCondition,
        feature.retryReason,
        feature.summary,
      ]) {
        assert(
          !(field ?? "").includes(retiredJwtWaitId),
          "jwt-authenticator still references the retired shared JWT wait",
        );
      }
    }

    return [repair.featureKey, featureSnapshot(feature)];
  }),
);

const memoSections = repairs
  .map((repair) => {
    const holder = treeAfter.tasks[repair.holderTaskId];
    const windowSource = treeAfter.tasks[repair.windowSourceTaskId];
    const holderBlocker = asRecord(holder?.blocker);
    const windowBlocker = asRecord(windowSource?.blocker);
    return `## ${repair.featureKey}

- Holder task: \`${repair.holderTaskId}\`
- Watch-window source: \`${repair.windowSourceTaskId}\`
- WaitingFor source: \`${repair.waitingForSource}\`

### Holder before

\`\`\`json
${JSON.stringify(beforeHolderSnapshots[repair.featureKey], null, 2)}
\`\`\`

### Holder after

\`\`\`json
${JSON.stringify(afterHolderSnapshots[repair.featureKey], null, 2)}
\`\`\`

### Feature row before

\`\`\`json
${JSON.stringify(beforeFeatureSnapshots[repair.featureKey], null, 2)}
\`\`\`

### Feature row after

\`\`\`json
${JSON.stringify(afterFeatureSnapshots[repair.featureKey], null, 2)}
\`\`\`

### Live wait fields consulted after apply

- Holder waitingFor:

\`\`\`json
${JSON.stringify(asRecord(holderBlocker.waiting_for), null, 2)}
\`\`\`

- Window-source waitingFor:

\`\`\`json
${JSON.stringify(asRecord(windowBlocker.waiting_for), null, 2)}
\`\`\`
`;
  })
  .join("\n");

const memo = `# App apply: reconcile compact represented-holder family — 2026-07-16

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Applied at: \`${repairedAt}\`
- Review memo used: \`${reviewMemoPath}\`
- App evidence memo: \`${appMemoPath}\`

## Repair scope

Applied a bounded app-owned repair across both the live compact-loop state and the exact holder metadata that the controller uses to keep these rows projected.

- \`.state/tasks/tree.json\` hash changed from \`${taskTreeHashBefore}\` to \`${taskTreeHashAfter}\`.
- \`.state/feature-compact-loop/state.json\` hash changed from \`${compactHashBefore}\` to \`${compactHashAfter}\`.
- \`.state/spec-loop/state.json\` stayed unchanged at \`${specLoopHashBefore}\`.

This redo addressed the review's still-live drift directly in the controller-visible sources:

1. aligned \`ccp-agent\` and \`ccp-security-patch-os-variants\` holder fallback windows to their governing waits;
2. restored exact governing wait ids into holder context + compact frontierTaskIds for \`cost-analysis\`, \`sgx-addon-vm-prerelease-matrix\`, and \`trusted-access\`;
3. removed the retired shared JWT wait id from current compact controller-visible JWT wording;
4. refreshed the evidence pointer on all nine holders so later reads point back to this attempt.

## Findings from current baseline

- The review finding about \`ccp-agent\` fallback drift was still true before this apply: the holder/compact row carried \`2026-07-16T18:30:00.000Z\` while the governing wait carried \`2026-07-17T18:00:00Z\`.
- The review finding about \`ccp-security-patch-os-variants\` fallback drift was still true before this apply: the holder/compact row carried \`2026-07-16T18:30:00.000Z\` while the governing wait carried \`2026-07-17T18:00:00Z\`.
- The review findings about missing compact \`frontierTaskIds\` were still true before this apply for \`cost-analysis\` and \`sgx-addon-vm-prerelease-matrix\`.
- The review finding about retired JWT wait text was only partly stale: \`blockedReason\` had already been repaired, but \`ownerReason\` still named the retired wait id before this apply.
- \`trusted-access\` was already correctly rebound in the live compact row before this retry; this apply preserved that state and added the same exact governing wait id into holder context so controller reprojection keeps it stable.

${memoSections}

## Verification claims satisfied

- \`ccp-agent\` compact \`fallbackAt\` now equals \`wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708.blocker.fallback_at\`, and the holder blocker mirrors the same value.
- \`ccp-security-patch-os-variants\` compact \`fallbackAt\` now equals \`wait-ccp-security-patch-reviewed-exception-owner-response-20260708.blocker.fallback_at\`, and the holder blocker mirrors the same value.
- \`cost-analysis\` compact \`frontierTaskIds\` now contains \`wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708\`, and the holder context stores the same exact id for future projection refresh.
- \`sgx-addon-vm-prerelease-matrix\` compact \`frontierTaskIds\` now contains \`wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703\`, and the holder context stores the same exact id for future projection refresh.
- \`jwt-authenticator\` compact controller-visible wording now contains no occurrence of \`${retiredJwtWaitId}\` while preserving the live no-current-surface final-ceiling semantics.
`;

writeMemo(memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      repairedAt,
      compactStatePath: compactLoaded.path,
      reviewMemoPath,
      appMemoPath,
      taskTreeChanged: taskTreeHashBefore !== taskTreeHashAfter,
      compactStateChanged: compactHashBefore !== compactHashAfter,
      specLoopUnchanged: specLoopHashBefore === specLoopHashAfter,
      beforeHolderSnapshots,
      afterHolderSnapshots,
      beforeFeatureSnapshots,
      afterFeatureSnapshots,
    },
    null,
    2,
  ),
);
