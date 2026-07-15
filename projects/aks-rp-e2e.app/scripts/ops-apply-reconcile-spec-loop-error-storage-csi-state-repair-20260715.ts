import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  defaultSpecLoopStatePath,
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";

type JsonRecord = Record<string, unknown>;

type QueueMetadata = {
  repair_basis_commit?: string;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function writeJson(path: string, value: unknown, pretty = true): void {
  mkdirSync(dirname(path), { recursive: true });
  const body = pretty
    ? `${JSON.stringify(value, null, 2)}\n`
    : `${JSON.stringify(value)}\n`;
  writeFileSync(path, body, "utf-8");
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);

const attemptId =
  "a_ops-apply-reconcile-spec-loop-error-storage-csi-state-repair_20260715024814";
const checkedAt = new Date().toISOString();
const specId = "spec.storage-csi.file-verify-nfs";
const reviewedTaskId = "reconcile-spec-loop-error-storage-csi";
const statePath = defaultSpecLoopStatePath(appDir);
const mirrorStatePath = resolve(projectDir, ".state", "spec-loop", "state.json");
const queueDir = resolve(
  projectDir,
  "workspace",
  reviewedTaskId,
  "20260715T024222Z",
);
const metadataPath = resolve(queueDir, "metadata.json");
const metadataMinPath = resolve(queueDir, "metadata.min.json");
const adoRunPath = resolve(queueDir, "ado-run.json");
const memoRelative =
  "evidence/archive/ops-apply-reconcile-spec-loop-error-storage-csi-state-repair-20260715.md";
const memoPath = resolve(appDir, memoRelative);
const expectedCommit = "d2aa9f8d1e2a581ffba0c9a53d758fc806b3ae23";
const typoCommit = "d2aa9f8d14795b3c8c0db5cda75ff8cd45e44cee";
const runId = "172280014";
const buildResultsUrl =
  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172280014";
const apiRunUrl =
  "https://dev.azure.com/msazure/09706533-03bf-4b43-9a9b-b49c75429646/_apis/pipelines/467665/runs/172280014";

const stateLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
  statePath,
});
const state = stateLoaded.state;
const before = state.specs[specId];
if (!before) {
  throw new Error(`Missing spec-loop row for ${specId}`);
}

const beforeRecord = before as JsonRecord;
const beforeReview =
  before.review && typeof before.review === "object" && !Array.isArray(before.review)
    ? ({ ...(before.review as JsonRecord) } as JsonRecord)
    : {};

updateSpecLoopSpec(state, specId, {
  status: "pending",
  taskId: null,
  attempts: before.attempts,
  lastRunId: runId,
  lastRunUrl: buildResultsUrl,
  lastResultPath: null,
  lastWorkflowLoopKey: before.lastWorkflowLoopKey ?? null,
  lastDispatchMetadataPath: metadataPath,
  failureClass: "test-code-bug",
  diagnosis:
    "ADO runs 172274739, 172274962, and 172278119 failed before execution because the published dev branch did not yet contain the file-verify-nfs carrier; commit d2aa9f8d1e2a581ffba0c9a53d758fc806b3ae23 repaired the repo-local plan-time unknown-spec failure and exact rerun 172280014 is already queued.",
  inputFingerprint:
    before.inputFingerprint ??
    '{"branch":"dev","pipeline":"ado-pipeline-<number>","specid":"spec.storage-csi.file-verify-nfs","target":"staging"}',
  errorFingerprint: null,
  activeAttemptId: null,
  activeTaskSessionId: null,
  activeWorkflowRunId: null,
  heartbeatAt: null,
  review: {
    ...beforeReview,
    classification: "same_run_review_pending",
    lastRootCause:
      "The stale needs-diagnosis residue was refined to a concrete test-code bug: Azure DevOps runs 172274739, 172274962, and 172278119 all failed in plan-time spec resolution because dev did not yet publish the file-verify-nfs carrier. That repo-local defect is repaired by commit d2aa9f8d1e2a581ffba0c9a53d758fc806b3ae23, and one exact same-spec staging rerun 172280014 is already queued.",
    lastAction:
      "Keep pending only as exact same-run artifact review for Azure DevOps run 172280014. Do not rerun spec.storage-csi.file-verify-nfs unchanged before reviewing that run's exact artifact/result surface.",
    reviewedAt: checkedAt,
    pendingReviewReason:
      "exact same-spec Azure DevOps rerun already queued after repo-local publication repair",
    pendingReviewRunId: runId,
    pendingReviewObservedAt: checkedAt,
    repairBasisCommit: expectedCommit,
  },
  successorDisposition: "same-run-review-pending",
  successorEvidencePath: memoPath,
  successorStateReason:
    "The stale run-172278119 missing-artifact error is superseded by repo-local publication repair commit d2aa9f8d1e2a581ffba0c9a53d758fc806b3ae23 plus exact same-spec Azure DevOps rerun 172280014 already queued on dev/staging. The truthful current frontier is same-run artifact review, not another rerun request.",
  resumeCondition:
    "Review Azure DevOps run 172280014 after terminal publication and classify spec.storage-csi.file-verify-nfs from that exact same-spec artifact bundle/result.json. If the same-run artifact bundle remains unavailable, preserve one exact artifact-visibility blocker for run 172280014 instead of rerunning unchanged.",
} as never);

const afterRecord = state.specs[specId] as unknown as JsonRecord;
afterRecord.successorRunId = runId;
afterRecord.successorRunUrl = buildResultsUrl;
afterRecord.successorResultPath = null;
afterRecord.normalizedFromStatus = before.status;
afterRecord.normalizedAt = checkedAt;
afterRecord.successorApiRunUrl = apiRunUrl;

saveSpecLoopState(
  statePath,
  state,
  existsSync(mirrorStatePath) ? [mirrorStatePath] : [],
);

const correctedMetadataPaths: string[] = [];
for (const [path, pretty] of [
  [metadataPath, true],
  [metadataMinPath, false],
] as const) {
  const parsed = readJson<QueueMetadata>(path);
  if (parsed.repair_basis_commit === typoCommit) {
    parsed.repair_basis_commit = expectedCommit;
    writeJson(path, parsed, pretty);
    correctedMetadataPaths.push(path);
  }
}

const after = state.specs[specId] as unknown as JsonRecord;
const afterReview =
  after.review && typeof after.review === "object" && !Array.isArray(after.review)
    ? (after.review as JsonRecord)
    : {};

const memoBody = `# App state repair — storage-csi fix-forward wait normalization

- Attempt: ${attemptId}
- Applied at: ${checkedAt}
- Supported mechanism: app-local TypeScript repair script using spec-loop store helpers (no hand-edited loop JSON)
- Reviewed task lineage: ${reviewedTaskId}
- Spec: ${specId}
- App state path: ${statePath}
- Mirror state path: ${mirrorStatePath}
- Queue metadata path: ${metadataPath}
- ADO snapshot path (immutable remote echo): ${adoRunPath}

## What this repair changed

1. Rewrote the app-owned spec-loop row away from stale run \
\`${String(before.lastRunId ?? null)}\` / \
\`${String(before.failureClass ?? null)}\` / missing-result residue.
2. Recorded the concrete repair classification as repo-local \
\`test-code-bug\` repaired by commit \
\`${expectedCommit}\`.
3. Preserved only one exact same-run wait surface: Azure DevOps run \
\`${runId}\` for \
\`${specId}\` on \
\`dev\` / \
\`staging\`.
4. Corrected the local durable queue metadata typo \
\`${typoCommit}\` -> \
\`${expectedCommit}\` in metadata files used for downstream provenance.
5. Did **not** queue another rerun and did **not** hand-edit raw state files.

## Before spec-loop row

\`\`\`json
${JSON.stringify(
  {
    status: before.status,
    taskId: before.taskId ?? null,
    attempts: before.attempts,
    lastRunId: before.lastRunId,
    lastRunUrl: before.lastRunUrl,
    lastDispatchMetadataPath: before.lastDispatchMetadataPath ?? null,
    failureClass: before.failureClass ?? null,
    diagnosis: before.diagnosis ?? null,
    inputFingerprint: before.inputFingerprint ?? null,
    errorFingerprint: before.errorFingerprint ?? null,
    review: before.review ?? null,
    successorDisposition: beforeRecord.successorDisposition ?? null,
    successorRunId: beforeRecord.successorRunId ?? null,
    resumeCondition: before.resumeCondition ?? null,
  },
  null,
  2,
)}
\`\`\`

## After spec-loop row

\`\`\`json
${JSON.stringify(
  {
    status: after.status,
    taskId: after.taskId ?? null,
    attempts: after.attempts ?? null,
    lastRunId: after.lastRunId ?? null,
    lastRunUrl: after.lastRunUrl ?? null,
    lastDispatchMetadataPath: after.lastDispatchMetadataPath ?? null,
    failureClass: after.failureClass ?? null,
    diagnosis: after.diagnosis ?? null,
    successorDisposition: after.successorDisposition ?? null,
    successorRunId: after.successorRunId ?? null,
    successorRunUrl: after.successorRunUrl ?? null,
    successorEvidencePath: after.successorEvidencePath ?? null,
    successorStateReason: after.successorStateReason ?? null,
    resumeCondition: after.resumeCondition ?? null,
    normalizedFromStatus: after.normalizedFromStatus ?? null,
    normalizedAt: after.normalizedAt ?? null,
    review: after.review ?? null,
  },
  null,
  2,
)}
\`\`\`

## Provenance typo correction

Corrected local metadata files:
${correctedMetadataPaths.length > 0 ? correctedMetadataPaths.map((path) => `- ${path}`).join("\n") : "- no local metadata file needed correction"}

The immutable Azure DevOps run snapshot at \
\`${adoRunPath}\` still reflects the original queued remote metadata string and is kept unchanged as a factual echo of what ADO received.

## Exact wait now represented

- run id: \
\`${runId}\`
- run results URL: \
\`${buildResultsUrl}\`
- queued metadata: \
\`${metadataPath}\`
- repair basis commit: \
\`${expectedCommit}\`
- next action: review exact same-run artifacts/result.json when run ${runId} is terminal; if artifacts are still absent, preserve one exact artifact-visibility blocker for this run instead of rerunning unchanged.

## Canonical terminal review proposal for planner/domain routing

If run ${runId} is terminal before the next planner pulse, route one bounded terminal pipeline review for \
\`${specId}\` using:

- run id: \
\`${runId}\`
- run URL: \
\`${buildResultsUrl}\`
- source evidence roots:
  - \
\`${queueDir}\`
  - \
\`${metadataPath}\`
  - \
\`${adoRunPath}\`
- required review rule: classify from the exact artifact/result.json bundle, not from pipeline conclusion alone.
`;

writeFileSync(memoPath, memoBody, "utf-8");

console.log(
  JSON.stringify(
    {
      attemptId,
      checkedAt,
      statePath,
      mirrorStatePath: existsSync(mirrorStatePath) ? mirrorStatePath : null,
      memoPath,
      correctedMetadataPaths,
      before: {
        status: before.status,
        taskId: before.taskId ?? null,
        lastRunId: before.lastRunId ?? null,
        failureClass: before.failureClass ?? null,
      },
      after: {
        status: String(after.status ?? null),
        taskId: (after.taskId as string | null | undefined) ?? null,
        lastRunId: (after.lastRunId as string | null | undefined) ?? null,
        failureClass: (after.failureClass as string | null | undefined) ?? null,
        successorDisposition:
          (after.successorDisposition as string | null | undefined) ?? null,
        successorRunId: (after.successorRunId as string | null | undefined) ?? null,
        normalizedFromStatus:
          (after.normalizedFromStatus as string | null | undefined) ?? null,
        reviewClassification:
          (afterReview.classification as string | null | undefined) ?? null,
      },
    },
    null,
    2,
  ),
);
