import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const checkedAt = new Date().toISOString();

const retiredTaskId =
  "wait-spec-net-integration-managednatgatewayv2-byo-request-shape-support-20260702";
const compactTaskId = "hold-compact-net-integration-package-partial-frontier";
const memoRelative =
  "evidence/archive/ops-apply-net-integration-managednatgatewayv2-terminal-retirement-20260714.md";
const memoAbsolute = `/app/projects/aks-rp-e2e.app/${memoRelative}`;

const specPatches = [
  {
    specId: "spec.net-integration.natgw-v2-byoip",
    lastRootCause:
      "Current maintained path summary still marks this single-stack managedNATGatewayV2 BYO public IP surface as verdictFinal=true terminal product-gap: the canonical create contract with natGatewayProfile.publicIPAddresses is still rejected with HTTP 400 before provisioning succeeds or outbound attachment appears.",
    successorStateReason:
      `Retired live blocked family ${retiredTaskId} after current maintained authority kept this exact managedNATGatewayV2 BYO public IP surface at verdictFinal=true terminal product-gap. Preserve the final disposition in evidence instead of keeping a live blocked wait open.`,
    resumeCondition:
      "Resume only after a future AKS RP/API/source signal materially changes support for managedNATGatewayV2 with natGatewayProfile.publicIPAddresses on this same surface; then run one bounded same-path verification. Do not rerun unchanged before that signal exists.",
  },
  {
    specId: "spec.net-integration.natgw-v2-byoip-prefix",
    lastRootCause:
      "Current maintained path summary still marks this managedNATGatewayV2 BYO public IP prefix surface as verdictFinal=true terminal product-gap: the repaired canonical create contract with natGatewayProfile.outboundIPPrefixes.publicIPPrefixes reached resource-group create, BYO public IP prefix setup, and managed-cluster PUT, then still returned HTTP 400 before provisioning or outbound attachment appeared.",
    successorStateReason:
      `Retired live blocked family ${retiredTaskId} after current maintained authority kept the repaired managedNATGatewayV2 BYO public IP prefix carrier at verdictFinal=true terminal product-gap. Preserve the repaired same-path boundary as terminal evidence instead of a live blocked wait.`,
    resumeCondition:
      "Resume only after a future AKS RP/API/source signal materially changes support for natGatewayProfile.outboundIPPrefixes.publicIPPrefixes with outboundType=managedNATGatewayV2; then run one bounded same-path verification. Do not rerun unchanged before that signal exists.",
  },
  {
    specId: "spec.net-integration.natgw-v2-ds-byoip-v4ip-v6ip",
    lastRootCause:
      "Current maintained path summary still marks this dual-stack managedNATGatewayV2 BYO IPv4+IPv6 public IP surface as verdictFinal=true terminal product-gap: the canonical create contract with natGatewayProfile.publicIPAddresses for both families is still rejected with HTTP 400 before provisioning succeeds or outbound attachment appears.",
    successorStateReason:
      `Retired live blocked family ${retiredTaskId} after current maintained authority kept this exact dual-stack managedNATGatewayV2 BYO IPv4+IPv6 public IP surface at verdictFinal=true terminal product-gap. Preserve the final disposition in evidence instead of keeping a live blocked wait open.`,
    resumeCondition:
      "Resume only after a future AKS RP/API/source signal materially changes support for dual-stack managedNATGatewayV2 with natGatewayProfile.publicIPAddresses for both BYO IPv4 and BYO IPv6 public IPs; then run one bounded same-path verification. Do not rerun unchanged before that signal exists.",
  },
  {
    specId: "spec.net-integration.natgw-v2-ds-byoip-v4prefix-v6ip",
    lastRootCause:
      "Current maintained path summary still marks this dual-stack mixed-BYO managedNATGatewayV2 surface as verdictFinal=true terminal product-gap on the repo-local canonical carrier: the exact same-surface create path still has no accepted support signal that overturns the current HTTP 400 create-time rejection.",
    successorStateReason:
      `Retired live blocked family ${retiredTaskId} after current maintained authority kept this exact dual-stack mixed-BYO managedNATGatewayV2 surface at verdictFinal=true terminal product-gap. Preserve the final disposition in evidence instead of keeping a live blocked wait open.`,
    resumeCondition:
      "Resume only after a future AKS RP/API/source signal materially changes support for the dual-stack mixed-BYO managedNATGatewayV2 carrier, including acceptance of the mixed outboundIPPrefixes/outboundIPs contract or an equivalent clarified REST mapping on the same surface; then run one bounded same-path verification. Do not rerun unchanged before that signal exists.",
  },
] as const;

const { state: specState, path: specStatePath } = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});

const specBeforeAfter = specPatches.map((item) => {
  const before = specState.specs[item.specId];
  if (!before) throw new Error(`Missing spec-loop row for ${item.specId}`);
  updateSpecLoopSpec(specState, item.specId, {
    status: "pending",
    taskId: null,
    review: {
      classification: "reviewed-product-gap-terminal-boundary",
      lastRootCause: item.lastRootCause,
      lastAction: `Retired live blocked family ${retiredTaskId} to task-tree done/terminal and left this spec represented only by terminal product-gap evidence plus its exact reopen trigger.`,
      reviewedAt: checkedAt,
    },
    successorDisposition: "reviewed-product-gap-terminal-boundary",
    successorEvidencePath: memoAbsolute,
    successorStateReason: item.successorStateReason,
    resumeCondition: item.resumeCondition,
    terminalDisposition: true,
    catalogStatus: before.catalogStatus ?? "blocked",
    catalogSpecState: before.catalogSpecState ?? "reviewed-exception",
  });
  const after = specState.specs[item.specId];
  return {
    specId: item.specId,
    before: {
      taskId: before.taskId ?? null,
      successorDisposition: before.successorDisposition ?? null,
      successorEvidencePath: before.successorEvidencePath ?? null,
      resumeCondition: before.resumeCondition ?? null,
    },
    after: {
      taskId: after?.taskId ?? null,
      successorDisposition: after?.successorDisposition ?? null,
      successorEvidencePath: after?.successorEvidencePath ?? null,
      resumeCondition: after?.resumeCondition ?? null,
    },
  };
});

const mirrorSpecLoopPath = resolve(projectDir, ".state", "spec-loop", "state.json");
saveSpecLoopState(
  specStatePath,
  specState,
  existsSync(mirrorSpecLoopPath) ? [mirrorSpecLoopPath] : [],
);

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const compactBefore = compactState.features["net-integration"];
if (!compactBefore) throw new Error("Missing feature-compact row for net-integration");

const reducedBlockedReason =
  "Current compact/spec-loop/spec evidence shows the exact remaining net-integration compact frontier is the BasicLB deprecation pair on wait-spec-net-integration-basiclb-create-deprecation-boundary-20260702, cross-subscription VNet on wait-spec-net-integration-cross-subscription-vnet-response-20260702, the outboundType=none topology-constraint pair on wait-spec-net-integration-outbound-none-topology-constraint-20260702, spec.net-integration.outbound-udr on wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702, the run-171350866 custom-route-table-user-assigned-msi node-readiness blocker, and the remaining source-grounded/nonlive pair spec.net-integration.multinic-standard plus spec.net-integration.natgw-v2-migration-v2-to-none. Record checkpointed accepted multinic live-carrier pair spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed at commit 2c56f386f64134f542cf9f0c20f7ddc6d188d022 as consumed/commit-backed status. Exclude consumed pass-history members spec.net-integration.outbound-migration-natgw-to-none and spec.net-integration.outbound-migration-none-to-lb from active blocked scope, and do not treat the checkpointed multinic pair as active blocked residue.";
const reducedResumeCondition =
  "Resume only when one exact represented surface materially changes: the BasicLB pair, cross-subscription pairing/access proof, outboundType=none topology constraints, the BYO UDR prerequisite contract, run 171350866 node-readiness diagnosis for custom-route-table-user-assigned-msi, or an accepted live-capable reclassification for the remaining source-grounded/nonlive pair spec.net-integration.multinic-standard plus spec.net-integration.natgw-v2-migration-v2-to-none.";
const reducedNextStepClassification =
  "preserve the reduced exact net-integration frontier after retiring the terminal managedNATGatewayV2 BYO quartet; remaining live surfaces are BasicLB, cross-subscription VNet, outboundType=none, outbound-udr, custom-route-table-user-assigned-msi, and source-grounded/nonlive multinic-standard plus natgw-v2-migration-v2-to-none";
const compactEvidencePaths = Array.from(
  new Set(
    [
      ...(Array.isArray(compactBefore.evidencePaths) ? compactBefore.evidencePaths : []),
      memoRelative,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  ),
).sort((a, b) => a.localeCompare(b));
const attemptedFixes = Array.from(
  new Set(
    [
      ...(Array.isArray(compactBefore.attemptedFixes) ? compactBefore.attemptedFixes : []),
      `${checkedAt}: retired terminal managedNATGatewayV2 BYO quartet ${retiredTaskId} from the compact-facing blocked frontier and synchronized controller-visible compact/spec-loop state to ${compactTaskId}.`,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  ),
);

updateFeatureCompactItem(compactState, "net-integration", {
  status: "blocked",
  taskId: compactTaskId,
  blockedReason: reducedBlockedReason,
  resumeCondition: reducedResumeCondition,
  waitingCondition: reducedResumeCondition,
  nextStepClassification: reducedNextStepClassification,
  reviewEvidencePath: memoRelative,
  evidencePaths: compactEvidencePaths,
  summary:
    `Retired the terminal managedNATGatewayV2 BYO quartet ${retiredTaskId} from active compact blocked scope and kept ${compactTaskId} aligned to the reduced remaining frontier.`,
  attemptedFixes,
  lastCheckedAt: checkedAt,
});

saveFeatureCompactLoopState(compactStatePath, compactState);
const compactAfter = compactState.features["net-integration"];

console.log(
  JSON.stringify(
    {
      checkedAt,
      retiredTaskId,
      compactTaskId,
      memoRelative,
      specStatePath,
      compactStatePath,
      specBeforeAfter,
      compact: {
        before: {
          taskId: compactBefore.taskId ?? null,
          blockedReason: compactBefore.blockedReason ?? null,
          resumeCondition: compactBefore.resumeCondition ?? null,
          waitingCondition: compactBefore.waitingCondition ?? null,
          reviewEvidencePath: compactBefore.reviewEvidencePath ?? null,
        },
        after: {
          taskId: compactAfter?.taskId ?? null,
          blockedReason: compactAfter?.blockedReason ?? null,
          resumeCondition: compactAfter?.resumeCondition ?? null,
          waitingCondition: compactAfter?.waitingCondition ?? null,
          reviewEvidencePath: compactAfter?.reviewEvidencePath ?? null,
        },
      },
    },
    null,
    2,
  ),
);
