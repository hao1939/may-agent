import { resolve } from "node:path";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const checkedAt = new Date().toISOString();

const specId = "spec.localdns.auto-default";
const removedTaskId = "hold-spec-localdns-managed-cluster-quota-family-frontier-20260708";
const memoPath =
  "/app/projects/aks-rp-e2e.app/evidence/archive/ops-apply-reconcile-localdns-managed-cluster-quota-stale-terminal-path-20260714.md";
const domainEvidencePath =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-reconcile-localdns-managed-cluster-quota-stale-terminal-path-20260714.md";

const { state, path: specStatePath } = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});

const before = state.specs[specId];
if (!before) {
  throw new Error(`Missing ${specId} in spec-loop state`);
}
if (before.taskId !== removedTaskId) {
  throw new Error(
    `Expected ${specId}.taskId to be ${removedTaskId}, found ${before.taskId ?? "null"}`,
  );
}

updateSpecLoopSpec(state, specId, {
  status: "pending",
  taskId: null,
  review: {
    classification: "same_path_partial_pass_no_quota_holder",
    lastRootCause:
      "2026-07-14 stale-path reconciliation removed the generic LocalDNS westus2 managed-cluster quota holder from spec.localdns.auto-default. The exact same-path model still preserves earlier fresh-create 1.36 + Cilium partial-pass/test-gap evidence, while reviewed run 28565271574 quota-failed earlier at setup.create-pre-1.36 before any auto-default assertion branch was reached, so the generic quota family is no longer the truthful exact steward for this spec.",
    lastAction:
      "Keep pending without the generic westus2 quota holder. Do not create a quota-based retry or rebind this spec to hold-spec-localdns-managed-cluster-quota-family-frontier-20260708 unless fresh exact same-path quota/headroom evidence reaches the auto-default branch; otherwise resume only through one bounded non-quota same-path follow-up or explicit owner decision.",
    reviewedAt: checkedAt,
  },
  successorDisposition: "same-path-partial-pass-no-quota-holder",
  successorEvidencePath: memoPath,
  successorStateReason:
    "Controller-visible state removes spec.localdns.auto-default from hold-spec-localdns-managed-cluster-quota-family-frontier-20260708. Current same-path evidence is partial-pass/test-gap for the fresh-create 1.36 + Cilium branch, while the newer westus2 QuotaExceededManagedCluster run failed earlier at setup.create-pre-1.36 and never reached the auto-default branch, so quota-family stewardship is stale for this spec until new exact same-path quota evidence exists.",
  resumeCondition:
    "Resume only if an owner chooses one bounded non-quota follow-up from the current auto-default partial-pass/test-gap posture, or if new exact same-path evidence materially changes this carrier. Do not recreate a quota-based retry or generic westus2 quota-holder binding from the setup.create-pre-1.36 failure unless fresh same-path quota/headroom evidence explicitly reaches the auto-default branch.",
  catalogStatus: before.catalogStatus ?? "ready",
  catalogSpecState: before.catalogSpecState ?? "ready",
  terminalDisposition: false,
});

saveSpecLoopState(specStatePath, state);

const after = state.specs[specId];
console.log(
  JSON.stringify(
    {
      checkedAt,
      memoPath,
      domainEvidencePath,
      specStatePath,
      before: {
        taskId: before.taskId ?? null,
        review: before.review ?? null,
        successorDisposition: before.successorDisposition ?? null,
        successorEvidencePath: before.successorEvidencePath ?? null,
        successorStateReason: before.successorStateReason ?? null,
        resumeCondition: before.resumeCondition ?? null,
      },
      after: after
        ? {
            taskId: after.taskId ?? null,
            review: after.review ?? null,
            successorDisposition: after.successorDisposition ?? null,
            successorEvidencePath: after.successorEvidencePath ?? null,
            successorStateReason: after.successorStateReason ?? null,
            resumeCondition: after.resumeCondition ?? null,
          }
        : null,
    },
    null,
    2,
  ),
);
