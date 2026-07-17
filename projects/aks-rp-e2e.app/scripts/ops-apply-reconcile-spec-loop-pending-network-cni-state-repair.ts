import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type SpecSnapshot = {
  status: string | null;
  taskId: string | null;
  lastRunId: string | null;
  lastRunUrl: string | null;
  lastResultPath: string | null;
  successorDisposition: string | null;
  successorEvidencePath: string | null;
  successorStateReason: string | null;
  resumeCondition: string | null;
  review: JsonRecord | null;
};

const attemptId =
  "a_ops-apply-reconcile-spec-loop-pending-network-cni-state-repair_20260716084857";
const appliedAt = new Date().toISOString();
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const statePath = defaultSpecLoopStatePath(appDir);
const mirrorPath = resolve(projectDir, ".state/spec-loop/state.json");
const evidencePath = resolve(
  appDir,
  "evidence/archive/ops-apply-reconcile-spec-loop-pending-network-cni-state-repair-20260716.md",
);

const sharedUnderlayWaitTaskId =
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708";
const ciliumPreviewTaskId =
  "domain/review-network-cni-cilium-preview-upgrade-rerun-172487147-terminal-blocked";
const calicoHolderTaskId =
  "hold-spec-network-cni-vm-prerelease-calico-eno-row192-196-frontier-20260710";

const specIds = {
  windows2022: "spec.network-cni.azure-overlay-dual-stack-windows2022",
  windows2025: "spec.network-cni.azure-overlay-dual-stack-windows2025",
  ilpipDualstack: "spec.network-cni.azure-overlay-ilpip-dualstack",
  ilpip: "spec.network-cni.azure-overlay-ilpip",
  ciliumLifecycle: "spec.network-cni.cilium-enterprise-addon-lifecycle",
  ciliumVmPrerelease: "spec.network-cni.cilium-enterprise-addon-vm-prerelease",
  ciliumPreview: "spec.network-cni.cilium-preview-upgrade",
  calicoEno: "spec.network-cni.vm-prerelease-calico-eno-migration-matrix",
} as const;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as JsonRecord) } as JsonRecord)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function snapshot(state: SpecLoopState, specId: string): SpecSnapshot {
  const spec = asRecord(state.specs[specId]);
  return {
    status: asString(spec.status),
    taskId: asString(spec.taskId),
    lastRunId: asString(spec.lastRunId),
    lastRunUrl: asString(spec.lastRunUrl),
    lastResultPath: asString(spec.lastResultPath),
    successorDisposition: asString(spec.successorDisposition),
    successorEvidencePath: asString(spec.successorEvidencePath),
    successorStateReason: asString(spec.successorStateReason),
    resumeCondition: asString(spec.resumeCondition),
    review: Object.keys(asRecord(spec.review)).length ? asRecord(spec.review) : null,
  };
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf-8");
}

function assertTaskExists(taskId: string): void {
  const tree = readTaskTree(config);
  if (!tree.tasks[taskId]) {
    throw new Error(`Required live task missing: ${taskId}`);
  }
}

const state = JSON.parse(readFileSync(statePath, "utf-8")) as SpecLoopState;
assertTaskExists(sharedUnderlayWaitTaskId);
assertTaskExists(ciliumPreviewTaskId);
assertTaskExists(calicoHolderTaskId);

const before = Object.fromEntries(
  Object.values(specIds).map((specId) => [specId, snapshot(state, specId)]),
);

updateSpecLoopSpec(state, specIds.windows2022, {
  status: "pass",
  taskId: null,
  lastRunId: "172352561",
  lastRunUrl:
    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172352561",
  lastResultPath:
    "workspace/fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203/20260715T181314Z-terminal-run-172352561/download/runs/test-results/test_20260715150818415_rfj0x2_027964/artifacts/network-cni-azure-overlay-dual-stack-windows2022/spec-runner/result.json",
  successorDisposition: "exact_spec_pass_recovered_same_path",
  successorEvidencePath:
    "/app/projects/aks-rp-e2e/evidence/archive/fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203.md",
  successorStateReason:
    "Exact same-spec ADO rerun 172352561 passed end to end on the Windows2022 overlay dual-stack carrier, superseding stale wait-network-cni-ready-subset-ado-run-172310203-result residue.",
  resumeCondition:
    "No unchanged rerun is implied. Resume only if a materially changed Windows2022 overlay dual-stack carrier needs fresh live verification beyond pass run 172352561.",
  review: {
    ...asRecord(state.specs[specIds.windows2022]?.review),
    classification: "exact_spec_pass_recovered_same_path",
    lastAction:
      "Normalize stale wait-network-cni-ready-subset-ado-run-172310203-result residue to pass from exact same-spec ADO run 172352561.",
    reviewedAt: appliedAt,
    acceptedRunId: "172352561",
    acceptedResultPath:
      "workspace/fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203/20260715T181314Z-terminal-run-172352561/download/runs/test-results/test_20260715150818415_rfj0x2_027964/artifacts/network-cni-azure-overlay-dual-stack-windows2022/spec-runner/result.json",
    acceptedStatus: "pass",
    acceptedByTaskId:
      "ops-apply-reconcile-spec-loop-pending-network-cni-state-repair",
    acceptedAt: appliedAt,
  },
});

updateSpecLoopSpec(state, specIds.windows2025, {
  status: "pass",
  taskId: null,
  lastRunId: "172347653",
  lastRunUrl:
    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172347653",
  lastResultPath:
    "workspace/ops-apply-fix-network-cni-azure-overlay-dual-stack-windows2025-run-172310203-domain-followup-task-tree-followup/172347653-test-results/runs/test-results/test_20260715163507980_upb5nl_244416/artifacts/network-cni-azure-overlay-dual-stack-windows2025/spec-runner/result.json",
  successorDisposition: "exact_spec_pass_recovered_same_path",
  successorEvidencePath:
    "/app/projects/aks-rp-e2e/evidence/archive/review-spec-network-cni-azure-overlay-dual-stack-windows2025-run172347653-20260715.md",
  successorStateReason:
    "Exact same-spec ADO rerun 172347653 passed end to end on the Windows2025 overlay dual-stack carrier, superseding stale wait-network-cni-ready-subset-ado-run-172310203-result residue.",
  resumeCondition:
    "No unchanged rerun is implied. Resume only if a materially changed Windows2025 overlay dual-stack carrier needs fresh live verification beyond pass run 172347653.",
  review: {
    ...asRecord(state.specs[specIds.windows2025]?.review),
    classification: "exact_spec_pass_recovered_same_path",
    lastAction:
      "Normalize stale wait-network-cni-ready-subset-ado-run-172310203-result residue to pass from exact same-spec ADO run 172347653.",
    reviewedAt: appliedAt,
    acceptedRunId: "172347653",
    acceptedResultPath:
      "workspace/ops-apply-fix-network-cni-azure-overlay-dual-stack-windows2025-run-172310203-domain-followup-task-tree-followup/172347653-test-results/runs/test-results/test_20260715163507980_upb5nl_244416/artifacts/network-cni-azure-overlay-dual-stack-windows2025/spec-runner/result.json",
    acceptedStatus: "pass",
    acceptedByTaskId:
      "ops-apply-reconcile-spec-loop-pending-network-cni-state-repair",
    acceptedAt: appliedAt,
  },
});

updateSpecLoopSpec(state, specIds.ilpipDualstack, {
  status: "pass",
  taskId: null,
  lastRunId: "172347962",
  lastRunUrl:
    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172347962",
  lastResultPath:
    "workspace/fix-network-cni-azure-overlay-ilpip-dualstack-run-172310203/20260715T191505Z-terminal-run-172347962/download/runs/test-results/test_20260715163907310_ecs3bn_057026/artifacts/network-cni-azure-overlay-ilpip-dualstack/spec-runner/result.json",
  successorDisposition: "exact_spec_pass_recovered_same_path",
  successorEvidencePath:
    "/app/projects/aks-rp-e2e/evidence/archive/fix-network-cni-azure-overlay-ilpip-dualstack-run-172310203.md",
  successorStateReason:
    "Exact same-spec ADO rerun 172347962 passed end to end on the ILPIP dual-stack carrier, superseding stale wait-network-cni-ready-subset-ado-run-172310203-result residue.",
  resumeCondition:
    "No unchanged rerun is implied. Resume only if a materially changed ILPIP dual-stack carrier needs fresh live verification beyond pass run 172347962.",
  review: {
    ...asRecord(state.specs[specIds.ilpipDualstack]?.review),
    classification: "exact_spec_pass_recovered_same_path",
    lastAction:
      "Normalize stale wait-network-cni-ready-subset-ado-run-172310203-result residue to pass from exact same-spec ADO run 172347962.",
    reviewedAt: appliedAt,
    acceptedRunId: "172347962",
    acceptedResultPath:
      "workspace/fix-network-cni-azure-overlay-ilpip-dualstack-run-172310203/20260715T191505Z-terminal-run-172347962/download/runs/test-results/test_20260715163907310_ecs3bn_057026/artifacts/network-cni-azure-overlay-ilpip-dualstack/spec-runner/result.json",
    acceptedStatus: "pass",
    acceptedByTaskId:
      "ops-apply-reconcile-spec-loop-pending-network-cni-state-repair",
    acceptedAt: appliedAt,
  },
});

updateSpecLoopSpec(state, specIds.ilpip, {
  status: "pass",
  taskId: null,
  lastRunId:
    "domain-retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714",
  lastRunUrl: null,
  lastResultPath:
    "evidence/archive/domain-retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714-network-cni-azure-overlay-ilpip.json",
  successorDisposition: "exact_authenticated_launcher_live_pass",
  successorEvidencePath:
    "/app/projects/aks-rp-e2e/evidence/archive/domain-retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714.md",
  successorStateReason:
    "The archived authenticated-launcher follow-up already completed with a same-spec live pass, so the dead holder id is stale residue and should be retired in favor of the exact pass evidence.",
  resumeCondition:
    "No unchanged rerun is implied. Resume only if a materially changed base ILPIP carrier needs fresh live verification beyond the authenticated-launcher live pass recorded on 2026-07-14.",
  review: {
    classification: "exact_authenticated_launcher_live_pass",
    lastRootCause:
      "The earlier dead task pointer was stale residue: the authenticated-launcher retry already ran from an ARM-authenticated launcher and produced same-spec live pass evidence with create, CNS, Linux/Windows IPv4 ILPIP, and cleanup witnesses.",
    lastAction:
      "Retire the dead domain/retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714 pointer and normalize spec.network-cni.azure-overlay-ilpip to pass from the archived exact live evidence.",
    reviewedAt: appliedAt,
    acceptedRunId:
      "domain-retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714",
    acceptedResultPath:
      "evidence/archive/domain-retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714-network-cni-azure-overlay-ilpip.json",
    acceptedStatus: "pass",
    acceptedByTaskId:
      "ops-apply-reconcile-spec-loop-pending-network-cni-state-repair",
    acceptedAt: appliedAt,
  },
});

updateSpecLoopSpec(state, specIds.ciliumLifecycle, {
  taskId: sharedUnderlayWaitTaskId,
});

updateSpecLoopSpec(state, specIds.ciliumVmPrerelease, {
  taskId: sharedUnderlayWaitTaskId,
});

updateSpecLoopSpec(state, specIds.ciliumPreview, {
  taskId: ciliumPreviewTaskId,
  successorDisposition: "exact_ado_terminal_review_wait",
  successorEvidencePath:
    "/app/projects/aks-rp-e2e.app/evidence/archive/review-network-cni-cilium-preview-upgrade-rerun-172487147-terminal.md",
  successorStateReason:
    "The broad ready-subset wait pointer is stale; the truthful current carrier is the exact live terminal-review task for ADO run 172487147.",
  resumeCondition:
    "Resume through domain/review-network-cni-cilium-preview-upgrade-rerun-172487147-terminal-blocked once run 172487147 becomes terminal and publishes test-result artifacts; do not reopen the broader network-cni family.",
  review: {
    ...asRecord(state.specs[specIds.ciliumPreview]?.review),
    lastAction:
      "Keep pending only on the exact ADO terminal-review blocker task domain/review-network-cni-cilium-preview-upgrade-rerun-172487147-terminal-blocked.",
    reviewedAt: appliedAt,
  },
});

updateSpecLoopSpec(state, specIds.calicoEno, {
  taskId: calicoHolderTaskId,
});

saveSpecLoopState(statePath, state, [mirrorPath]);

const after = Object.fromEntries(
  Object.values(specIds).map((specId) => [specId, snapshot(state, specId)]),
);

const memo = `# App apply: reconcile spec-loop pending network-cni state repair — 2026-07-16

- Task: \`ops-apply-reconcile-spec-loop-pending-network-cni-state-repair\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`

## Decisions applied

1. Normalized these stale dead-link rows to exact pass results:
   - \`${specIds.windows2022}\` -> pass from ADO run \`172352561\`
   - \`${specIds.windows2025}\` -> pass from ADO run \`172347653\`
   - \`${specIds.ilpipDualstack}\` -> pass from ADO run \`172347962\`
   - \`${specIds.ilpip}\` -> pass from the archived authenticated-launcher live retry evidence (the dead follow-up id was stale residue, not missing work)
2. Repointed exact non-pass holders instead of duplicating work:
   - \`${specIds.ciliumLifecycle}\` -> \`${sharedUnderlayWaitTaskId}\`
   - \`${specIds.ciliumVmPrerelease}\` -> \`${sharedUnderlayWaitTaskId}\`
   - \`${specIds.ciliumPreview}\` -> \`${ciliumPreviewTaskId}\`
   - \`${specIds.calicoEno}\` -> restored live holder \`${calicoHolderTaskId}\`
3. Explicitly rejected recreating the superseded ILPIP authenticated-launcher follow-up and the superseded pipeline-467665 underlay repair leaf because primary sources show:
   - the ILPIP follow-up already finished with a same-spec live pass; and
   - the cilium-enterprise underlay lane is already truthfully represented by the live shared underlay/runtime-input wait, not a missing spec-specific leaf.

## Before → after snapshots

### ${specIds.windows2022}
- Before:
\`\`\`json
${JSON.stringify(before[specIds.windows2022], null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(after[specIds.windows2022], null, 2)}
\`\`\`

### ${specIds.windows2025}
- Before:
\`\`\`json
${JSON.stringify(before[specIds.windows2025], null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(after[specIds.windows2025], null, 2)}
\`\`\`

### ${specIds.ilpipDualstack}
- Before:
\`\`\`json
${JSON.stringify(before[specIds.ilpipDualstack], null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(after[specIds.ilpipDualstack], null, 2)}
\`\`\`

### ${specIds.ilpip}
- Before:
\`\`\`json
${JSON.stringify(before[specIds.ilpip], null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(after[specIds.ilpip], null, 2)}
\`\`\`

### ${specIds.ciliumLifecycle}
- Before:
\`\`\`json
${JSON.stringify(before[specIds.ciliumLifecycle], null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(after[specIds.ciliumLifecycle], null, 2)}
\`\`\`

### ${specIds.ciliumVmPrerelease}
- Before:
\`\`\`json
${JSON.stringify(before[specIds.ciliumVmPrerelease], null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(after[specIds.ciliumVmPrerelease], null, 2)}
\`\`\`

### ${specIds.ciliumPreview}
- Before:
\`\`\`json
${JSON.stringify(before[specIds.ciliumPreview], null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(after[specIds.ciliumPreview], null, 2)}
\`\`\`

### ${specIds.calicoEno}
- Before:
\`\`\`json
${JSON.stringify(before[specIds.calicoEno], null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(after[specIds.calicoEno], null, 2)}
\`\`\`

## Verification targets satisfied

- Dead holder id \`wait-network-cni-ready-subset-ado-run-172310203-result\` no longer owns any of the reviewed network-cni rows above.
- Dead holder id \`${calicoHolderTaskId}\` is restored as a live blocked holder and reattached to \`${specIds.calicoEno}\`.
- Dead holder id \`domain/retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714\` was not recreated because archived primary evidence proves it already completed with a same-spec live pass; \`${specIds.ilpip}\` now points to pass instead of that dead id.
- No family-wide retry reset was emitted.
`;

writeText(evidencePath, memo);
console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      evidencePath,
      before,
      after,
      restoredHolderTaskId: calicoHolderTaskId,
    },
    null,
    2,
  ),
);
