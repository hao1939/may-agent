import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";

const attemptId =
  "a_ops_repair-windows-gpu-legacy-no-rerun-spec-loop-state-20260717_20260717014457";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();

const loopTaskId = "aks-spec-verification-loop";
const specId = "spec.windows-gpu.vm-prerelease-matrix";
const staleTaskId = "domain/writeback-windows-gpu-vms-legacy-retirement-20260715";
const memoPath =
  "evidence/archive/ops-repair-windows-gpu-legacy-no-rerun-spec-loop-state-20260717.md";
const memoAbsolute = resolve(appDir, memoPath);
const mirrorPath = resolve(projectDir, ".state/spec-loop/state.json");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const loaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 5,
});
const before = loaded.state.specs[specId];
assert(before, `Missing spec-loop row ${specId}`);
assert(
  before.taskId === staleTaskId,
  `Expected ${specId}.taskId=${staleTaskId} before repair, got ${before.taskId ?? "null"}`,
);

updateSpecLoopSpec(loaded.state, specId, {
  status: "pending",
  taskId: null,
  catalogStatus: before.catalogStatus ?? "draft",
  catalogSpecState: before.catalogSpecState ?? "reviewed-exception",
  terminalDisposition: true,
  successorDisposition: "intentional-lineage-only-nonlive",
  successorEvidencePath: memoAbsolute,
  successorStateReason:
    "Accepted Windows GPU legacy writeback completed the controller-visible successor rewrite: the legacy VirtualMachines prerelease matrix is now only a no-unchanged-rerun historical boundary, while current-source follow-up lives on the authored GRID and CUDA VMSS successor specs instead of any open legacy recovery leaf.",
  resumeCondition:
    "Resume only if upstream source restores a distinct legacy VirtualMachines prerelease contract or exact same-surface evidence materially changes that historical branch. Do not rerun the unchanged legacy VirtualMachines carrier.",
  review: {
    classification: "intentional_lineage_only_nonlive",
    lastRootCause:
      `Controller-visible spec-loop state still pointed ${specId} at archived done task ${staleTaskId} even though the accepted writeback already converted the legacy VirtualMachines branch into a no-unchanged-rerun historical boundary.`,
    lastAction:
      `Cleared stale taskId ${staleTaskId}; keep ${specId} pending as self-represented nonlive lineage only, preserve the accepted no-unchanged-rerun posture, and leave any future work gated on a material source-contract change rather than reviving a completed legacy recovery task.`,
    reviewedAt: appliedAt,
  },
});

saveSpecLoopState(
  loaded.path,
  loaded.state,
  existsSync(mirrorPath) ? [mirrorPath] : [],
);

const after = loaded.state.specs[specId];
assert(after.taskId === null, `Expected ${specId}.taskId=null after repair`);
assert(after.status === "pending", `Expected ${specId}.status=pending`);
assert(
  after.successorDisposition === "intentional-lineage-only-nonlive",
  `Expected ${specId}.successorDisposition=intentional-lineage-only-nonlive`,
);

console.log(
  JSON.stringify(
    {
      attemptId,
      memoPath,
      specId,
      beforeTaskId: before.taskId,
      afterTaskId: after.taskId,
      beforeSuccessorDisposition: before.successorDisposition ?? null,
      afterSuccessorDisposition: after.successorDisposition ?? null,
      afterResumeCondition: after.resumeCondition ?? null,
      reviewedAt: appliedAt,
    },
    null,
    2,
  ),
);
