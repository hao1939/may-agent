import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import { loadSpecLoopState } from "../workflows/lib/spec-loop-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree } from "../workflows/lib/task-tree-store.ts";

const attemptId =
  "a_ops-apply-reconcile-serverless-virtual-nodes-holder-vs-model-20260715-st_20260715004140";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const checkedAt = new Date().toISOString();
const nextCheckAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
const fallbackAt = new Date(Date.now() + 48 * 60 * 60_000).toISOString();

const featureKey = "serverless";
const staleTaskId =
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708";
const successorTaskId =
  "domain/repair-serverless-compact-readiness-vs-model-20260715";
const staleMountedVmssTaskId =
  "wait-spec-serverless-virtual-nodes-mounted-vmss-rerun-171356203-return-20260708";
const memoPath =
  "evidence/archive/ops-apply-reconcile-serverless-virtual-nodes-holder-vs-model-20260715-st.md";
const reviewedMemoPath =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-reconcile-serverless-virtual-nodes-holder-vs-model-20260715.md";
const compactSummaryPath = "features/serverless/compact/staging.summary.md";
const compactDiagnosticsPath = "features/serverless/compact/staging.diagnostics.json";
const pathSummaryPath = "model/knowledge-map/views/path-summary.json";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});
const tree = readTaskTree(config);
const successorTask = tree.tasks[successorTaskId];
assert(successorTask, `Missing live successor task ${successorTaskId}`);

const staleMountedVmssTaskPresent = Boolean(tree.tasks[staleMountedVmssTaskId]);

const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactLoaded.state;
const before = compactState.features[featureKey];
assert(before, `Missing feature-compact row for ${featureKey}`);
assert(
  before.taskId === staleTaskId,
  `Expected ${featureKey} compact taskId ${staleTaskId}, found ${before.taskId ?? "(null)"}`,
);
assert(
  typeof before.retryReason === "string" && before.retryReason.includes("underlay"),
  `Expected stale retryReason to still reference underlay wording for ${featureKey}`,
);
assert(
  typeof before.blockedReason === "string" && before.blockedReason.includes("schedulerctrl"),
  `Expected stale blockedReason to still reference schedulerctrl wording for ${featureKey}`,
);

const specLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});
const mountedVmssSpec =
  specLoaded.state.specs[
    "spec.serverless-virtual-nodes.addonv2-aci-connector-mounted-vmss-lifecycle"
  ];
assert(
  mountedVmssSpec,
  "Missing spec-loop row for spec.serverless-virtual-nodes.addonv2-aci-connector-mounted-vmss-lifecycle",
);

const retryReason =
  `Keep ${featureKey} blocked on ${successorTaskId}: the accepted 2026-07-15 serverless reconciliation proved the current compact-facing holder is mislinked to schedulerctrl underlay wait ${staleTaskId}. The truthful next step is the repo-local compact summary/diagnostics and eligibility repair leaf ${successorTaskId}, not unrelated underlay recovery.`;
const blockedReason =
  `Current controller-visible ${featureKey} compact state was incorrectly projecting schedulerctrl underlay wait ${staleTaskId} onto the serverless virtual-nodes frontier. Reviewed evidence now shows the current non-pass serverless surfaces already split across exact waits/environment ceilings, while compact output still overstates a six-member execute-ready promotion frontier and wrongly leaves subnet-validation in readySpecIds. Until ${successorTaskId} repairs the repo-local compact readout, this feature must stay represented by that repair leaf rather than the schedulerctrl underlay family.`;
const resumeCondition =
  `Resume only when ${successorTaskId} lands a reviewed compact readout/eligibility repair or a sharper same-lineage successor replaces it. Do not restore ${staleTaskId} or schedulerctrl-specific underlay wording as the active representation for serverless virtual-nodes unless accepted evidence proves the compact frontier truly collapses back to that family.`;
const ownerReason =
  `All feature-owned serverless specs are already selected into the compact package. The remaining controller-visible problem is repo-local compact-readout truthfulness: addonv2-aci-connector and virtual-node-addon already map to the shared subnet-authorization wait, dns-resolution.external-from-aci and multi-pod-burst already map to runtime-readiness waits, serverless-virtualnodes.standard already maps to the extension-install environment ceiling, and subnet-validation still has a blocked runtime half that compact output hides. The app-owned ${featureKey} holder must therefore point at ${successorTaskId} rather than the unrelated schedulerctrl underlay family.`;
const nextStepClassification =
  `repo-local compact readout/eligibility repair through ${successorTaskId}; remove the false schedulerctrl underlay projection, stop representing the six excluded members as one execute-ready promotion frontier, and ensure subnet-validation leaves readySpecIds while its placement/runtime half remains blocked`;
const verificationBlocker =
  `Do not rerun unchanged or restore schedulerctrl underlay wording. Verification requires ${successorTaskId} (or an equivalent sharper same-lineage repair) to update serverless compact summary/diagnostics so subnet-validation is no longer ready, multi-pod-burst is no longer double-represented, and the six excluded members are no longer grouped as one execute-ready promotion frontier.`;
const summary =
  `${attemptId}: replaced the false ${featureKey} compact projection of schedulerctrl underlay wait ${staleTaskId} with repo-local repair leaf ${successorTaskId}. The app-owned holder now truthfully waits on compact-readout repair rather than unrelated underlay recovery.`;
const fallbackAction =
  `If ${successorTaskId} remains incomplete at fallback, re-review whether the compact readout repair leaf is still the sharpest active representation or whether a sharper same-lineage holder/task now exists. Separately inspect the still-absent mounted-VMSS task linkage ${staleMountedVmssTaskId} if that metadata drift is still unresolved.`;

const evidencePaths = unique(
  [
    ...(Array.isArray(before.evidencePaths) ? before.evidencePaths : []),
    memoPath,
    reviewedMemoPath,
    compactSummaryPath,
    compactDiagnosticsPath,
    pathSummaryPath,
  ].filter((value): value is string => Boolean(value && value.trim())),
);
const attemptedFixes = unique([
  ...(Array.isArray(before.attemptedFixes) ? before.attemptedFixes : []),
  `${attemptId}: rewrote the ${featureKey} feature-compact holder from stale schedulerctrl underlay wait ${staleTaskId} to repo-local compact repair leaf ${successorTaskId} after confirming the live successor task now exists and the current mounted-VMSS spec-loop drift remains separate.`,
]);

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: successorTaskId,
  frontierTaskIds: [successorTaskId],
  retryable: false,
  retryReason,
  lastSummary: summary,
  rootCauseClassification: "repo-local-mixed-terminal-and-promotion-frontier",
  ownerReason,
  attemptedFixes,
  nextStepClassification,
  resumeCondition,
  blockedReason,
  waitingFor: {
    type: "frontier.changed",
    taskId: successorTaskId,
    featureKey,
    scope: "compact-readiness-vs-model-repair",
  },
  waitingCondition: resumeCondition,
  observedBy: before.observedBy ?? {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.planning.requested",
  },
  observationMethod:
    before.observationMethod ??
    "Scheduled blocked-frontier app-ops review checks whether the repo-local compact repair leaf completed or was replaced by a sharper same-lineage holder.",
  nextCheckAt,
  blockerOwner: "aks-explorer",
  fallbackAt,
  fallbackAction,
  resumeAction:
    "Reset this feature compact record to pending only after the named repo-local compact repair lands or a sharper same-lineage holder replaces it.",
  blockedScope: before.blockedScope ?? { kind: "feature", ids: [featureKey] },
  blockedFingerprint:
    before.blockedFingerprint ?? {
      errorClass: "package-partial",
      target: "staging",
      branch: "dev",
      featureKey,
    },
  lastCheckedAt: checkedAt,
  evidencePaths,
  reviewEvidencePath: memoPath,
  verificationBlocker,
  summary,
});

saveFeatureCompactLoopState(compactLoaded.path, compactState);
const after = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
}).state.features[featureKey];
assert(after, `Missing feature-compact row for ${featureKey} after save`);
assert(after.taskId === successorTaskId, `Expected repaired taskId ${successorTaskId}`);
assert(
  after.reviewEvidencePath === memoPath,
  `Expected reviewEvidencePath ${memoPath}, found ${after.reviewEvidencePath ?? "(null)"}`,
);
assert(
  typeof after.blockedReason === "string" && after.blockedReason.includes(successorTaskId),
  `Expected repaired blockedReason to mention ${successorTaskId}`,
);
assert(
  typeof after.blockedReason === "string" && !after.blockedReason.includes("schedulerctrl underlay wait remains true"),
  "Repaired blockedReason still contains stale schedulerctrl underlay wording",
);

const memo = `# App apply: reconcile serverless virtual-nodes holder vs model — 2026-07-15

- Task: \`ops-apply-reconcile-serverless-virtual-nodes-holder-vs-model-20260715-st\`
- Attempt: \`${attemptId}\`
- Checked at: \`${checkedAt}\`
- Feature row: \`${featureKey}\` in \`.state/feature-compact-loop/state.json\`
- Reviewed domain memo authority: \`${reviewedMemoPath}\`
- Successor task now present: \`${successorTaskId}\`

## Applied repair

Replaced the false compact-facing projection of schedulerctrl underlay wait \`${staleTaskId}\` with the live repo-local repair leaf \`${successorTaskId}\`.

This worker did **not** create a new task. The preferred successor now already exists in the live task tree, so the bounded app-owned repair here was to point the \`${featureKey}\` compact row at that exact repair leaf and remove the unrelated schedulerctrl underlay wording.

## Before → after highlights

### feature.taskId
- Before: ${JSON.stringify(before.taskId ?? null)}
- After: ${JSON.stringify(after.taskId ?? null)}

### feature.frontierTaskIds
- Before: ${JSON.stringify(before.frontierTaskIds ?? null)}
- After: ${JSON.stringify(after.frontierTaskIds ?? null)}

### feature.retryReason
- Before: ${JSON.stringify(before.retryReason ?? null)}
- After: ${JSON.stringify(after.retryReason ?? null)}

### feature.blockedReason
- Before: ${JSON.stringify(before.blockedReason ?? null)}
- After: ${JSON.stringify(after.blockedReason ?? null)}

### feature.waitingCondition
- Before: ${JSON.stringify(before.waitingCondition ?? null)}
- After: ${JSON.stringify(after.waitingCondition ?? null)}

### feature.reviewEvidencePath
- Before: ${JSON.stringify(before.reviewEvidencePath ?? null)}
- After: ${JSON.stringify(after.reviewEvidencePath ?? null)}

## Why this holder is now truthful

The reviewed 2026-07-15 memo showed that the current serverless virtual-nodes non-pass frontier is **not** a schedulerctrl underlay wait. Instead:

- subnet-authorization already owns \`spec.serverless-virtual-nodes.addonv2-aci-connector\` and \`spec.serverless-virtual-nodes.virtual-node-addon\`
- runtime-readiness already owns \`spec.serverless-virtual-nodes.dns-resolution.external-from-aci\`, \`spec.serverless-virtual-nodes.multi-pod-burst\`, and the blocked placement/runtime half of \`spec.serverless-virtual-nodes.subnet-validation\`
- extension-install already owns \`spec.serverless-virtualnodes.standard\`
- the remaining compact-side defect is repo-local readout truthfulness: current compact output still groups six excluded members as one execute-ready promotion frontier and still leaves subnet-validation in \`readySpecIds\`

Therefore the compact-facing next step is the repo-local repair leaf \`${successorTaskId}\`, not schedulerctrl underlay recovery.

## Spec-loop note

I inspected \`spec.serverless-virtual-nodes.addonv2-aci-connector-mounted-vmss-lifecycle\` in \`.state/spec-loop/state.json\`.

- Current spec-loop taskId: ${JSON.stringify(mountedVmssSpec.taskId ?? null)}
- Missing live tree task present now? ${JSON.stringify(staleMountedVmssTaskPresent)}

No spec-loop mutation was applied in this task. The reviewed memo already scoped the mounted-VMSS linkage drift as a **separate** repair from the compact-holder misprojection fixed here.

## Acceptance check

- App-owned loop-state repair applied through supported store helpers: **yes**
- Serverless compact-facing holder no longer points at unrelated schedulerctrl underlay wait: **yes**
- Live state now points at the exact repo-local repair leaf that should fix the compact readout mismatch: **yes**
`;

const memoAbsolute = resolve(appDir, memoPath);
mkdirSync(dirname(memoAbsolute), { recursive: true });
writeFileSync(memoAbsolute, `${memo}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      attemptId,
      checkedAt,
      memoPath,
      successorTaskId,
      staleMountedVmssTaskPresent,
      mountedVmssSpecTaskId: mountedVmssSpec.taskId ?? null,
      compactBefore: {
        taskId: before.taskId ?? null,
        frontierTaskIds: before.frontierTaskIds ?? null,
        retryReason: before.retryReason ?? null,
        blockedReason: before.blockedReason ?? null,
        waitingCondition: before.waitingCondition ?? null,
        reviewEvidencePath: before.reviewEvidencePath ?? null,
      },
      compactAfter: {
        taskId: after.taskId ?? null,
        frontierTaskIds: after.frontierTaskIds ?? null,
        retryReason: after.retryReason ?? null,
        blockedReason: after.blockedReason ?? null,
        waitingCondition: after.waitingCondition ?? null,
        reviewEvidencePath: after.reviewEvidencePath ?? null,
        nextCheckAt: after.nextCheckAt ?? null,
        fallbackAt: after.fallbackAt ?? null,
      },
    },
    null,
    2,
  ),
);
