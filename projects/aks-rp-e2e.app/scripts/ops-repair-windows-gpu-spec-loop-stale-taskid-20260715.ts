import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";

const attemptId =
  "a_ops_repair-windows-gpu-spec-loop-stale-taskid-20260715_20260715053142";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();

const loopTaskId = "aks-spec-verification-loop";
const specId = "spec.windows-gpu.vm-prerelease-matrix";
const staleTaskId = "wait-windows-gpu-vm-prerelease-vms-source-parity-or-reframe-20260715";
const successorTaskId = "domain/writeback-windows-gpu-vms-legacy-retirement-20260715";
const gridTaskId = "domain/author-windows-gpu-vmss-prerelease-grid-20260715";
const cudaTaskId = "domain/author-windows-gpu-vmss-prerelease-cuda-20260715";
const memoPath = "evidence/archive/repair-windows-gpu-spec-loop-stale-taskid-20260715.md";
const memoAbsolute = resolve(appDir, memoPath);
const mirrorPath = resolve(projectDir, ".state/spec-loop/state.json");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
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

const resumeCondition =
  `Resume only by completing the accepted Windows GPU successor boundary: ${successorTaskId} after ${gridTaskId} and ${cudaTaskId}, or by replacing that same lineage with reviewed exact same-surface evidence. Do not rerun the unchanged legacy VirtualMachines carrier.`;
const successorStateReason =
  `The archived wait ${staleTaskId} is no longer a live controller-visible boundary. Current accepted next work keeps the legacy VirtualMachines matrix on a no-unchanged-rerun posture and routes it through ${successorTaskId}, which depends on the exact GRID and CUDA VMSS authoring leaves ${gridTaskId} and ${cudaTaskId}.`;

updateSpecLoopSpec(loaded.state, specId, {
  status: "pending",
  taskId: successorTaskId,
  catalogStatus: "draft",
  catalogSpecState: "reviewed-exception",
  terminalDisposition: true,
  successorDisposition: "legacy-no-rerun-successor-trio-boundary",
  successorEvidencePath: memoAbsolute,
  successorStateReason,
  resumeCondition,
  review: {
    classification: "legacy_no_rerun_successor_boundary",
    lastRootCause:
      `Controller-visible spec-loop state still pointed ${specId} at archived wait ${staleTaskId} even though the accepted truthful successor boundary is now the Windows GPU VMSS successor trio ending in ${successorTaskId}.`,
    lastAction:
      `Repointed ${specId} from archived wait ${staleTaskId} to live successor task ${successorTaskId}; preserve pending reviewed-exception posture and forbid unchanged rerun until the successor trio materially changes the exact boundary.`,
    reviewedAt: appliedAt,
  },
});

saveSpecLoopState(
  loaded.path,
  loaded.state,
  existsSync(mirrorPath) ? [mirrorPath] : [],
);

const after = loaded.state.specs[specId];
assert(after.taskId === successorTaskId, `Expected ${specId}.taskId=${successorTaskId}`);
assert(after.status === "pending", `Expected ${specId}.status=pending`);

const memo = `# Windows GPU spec-loop stale taskId repair — 2026-07-15

- Attempt: \`${attemptId}\`
- Spec: \`${specId}\`
- App-owned state: \`.state/spec-loop/state.json\`
- App memo: \`${memoPath}\`

## Baseline before repair

The controller-visible spec-loop row still pointed at an archived/non-live wait:

- before \`status\`: \`${before.status}\`
- before \`taskId\`: \`${before.taskId ?? "null"}\`
- before \`successorDisposition\`: \`${before.successorDisposition ?? "null"}\`
- before \`resumeCondition\`: ${JSON.stringify(before.resumeCondition ?? null)}

Supported live read used during baseline verification:

\`cd /app/projects/aks-rp-e2e.app && bun run task-tree show ${staleTaskId}\`

Observed result: \`Task not found: ${staleTaskId}\`

## Repair applied

Updated only the app-owned spec-loop row for \`${specId}\` via \`workflows/lib/spec-loop-store.ts\` so it now points at the live accepted successor boundary instead of the archived wait.

### Before → after

- \`taskId\`: \`${before.taskId ?? "null"}\` → \`${after.taskId ?? "null"}\`
- \`status\`: \`${before.status}\` → \`${after.status}\`
- \`review.classification\`: \`${String((before.review as Record<string, unknown> | undefined)?.classification ?? "null")}\` → \`${String((after.review as Record<string, unknown> | undefined)?.classification ?? "null")}\`

### Current truthful successor boundary now named in state

- live successor writeback leaf: \`${successorTaskId}\`
- exact prerequisite authoring leaves:
  - \`${gridTaskId}\`
  - \`${cudaTaskId}\`

This preserves the accepted no-unchanged-rerun posture because the spec-loop row now routes only through the successor-trio lineage and explicitly forbids rerunning the unchanged legacy VirtualMachines carrier.

## Expected verification after repair

Supported live reads should now show:

1. \`cd /app/projects/aks-rp-e2e.app && bun run task-tree show ${successorTaskId}\`
   - live backlog domain leaf exists
   - goal rewrites the legacy \`${specId}\` boundary to a truthful legacy-no-rerun posture
   - depends_on lists \`${gridTaskId}\` and \`${cudaTaskId}\`

2. \`cd /app/projects/aks-rp-e2e.app && bun run task-tree frontier\`
   - no unchanged Windows GPU rerun becomes runnable as a side effect of this repair

3. Re-read \`.state/spec-loop/state.json\`
   - \`${specId}.taskId = ${successorTaskId}\`
   - \`${specId}.status = pending\`
   - \`${specId}.resumeCondition\` names only the accepted successor-trio lineage and still forbids unchanged rerun
`;

writeText(memoAbsolute, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      memoPath,
      specId,
      beforeTaskId: before.taskId,
      afterTaskId: after.taskId,
      afterStatus: after.status,
      resumeCondition: after.resumeCondition,
      successorDisposition: after.successorDisposition,
    },
    null,
    2,
  ),
);
