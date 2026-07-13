import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  refreshBlockedWait,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";

type WaitRefresh = {
  taskId: string;
  condition: string;
  resumeCondition: string;
  summary: string;
  fallbackAction: string;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const checkedAt = new Date().toISOString();
const attemptId =
  "a_ops-apply-execute-1800-noon-family-fallback-review-wave-app-ops-20260712_20260712180714";
const sourceReviewMemo =
  "evidence/archive/ops-execute-1800-noon-family-fallback-review-wave-app-ops-20260712c.md";
const evidencePath =
  "evidence/archive/ops-apply-execute-1800-noon-family-fallback-review-wave-app-ops-20260712.md";
const nextCheckAt = "2026-07-13T18:00:00Z";
const fallbackAt = "2026-07-14T18:00:00Z";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const waits: WaitRefresh[] = [
  {
    taskId:
      "wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705",
    condition:
      "2026-07-12 18:00Z fallback review revalidated this exact reviewed app-routing default-domain TLS product-gap wait: the DefaultDomainCertificate -> default-domain-tls path remains a CCP/app-routing-operator cert-material supply failure on the same source-check-only carrier, no controller-visible returned approval or same-surface product/operator change was found after the noon refresh, and no changed evidence justifies a rerun or wider family replacement. Preserve this exact wait.",
    resumeCondition:
      "Resume only after a reviewed same-surface product or environment change makes DefaultDomainCertificate reconciliation materially different, such as a known-good app-routing operator / CCP cert-material fix or owner-confirmed precondition change. Then re-run the exact local policy gates and the truthful carrier selected for this path before changing verdict surfaces.",
    summary:
      "Refreshed the exact app-routing default-domain TLS product-gap wait at the 2026-07-12 18:00Z fallback review, preserved the same-lineage blocker/evidence, and moved the next check/fallback window to 2026-07-13T18:00:00Z / 2026-07-14T18:00:00Z without widening family scope.",
    fallbackAction:
      "If the DefaultDomainCertificate/default-domain-tls product-gap is still unchanged, refresh this exact wait from returned product/operator evidence or create one exact owner-facing recovery/escalation task; do not widen the app-routing family or rerun unchanged.",
  },
  {
    taskId:
      "wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708",
    condition:
      "2026-07-12 18:00Z fallback review revalidated this exact two-run authenticated secops-fips artifact-visibility frontier: run 28618650515 for spec.secops-fips.extension-blocked and run 28621344506 for spec.secops-fips.windows remain terminal, the current app worker surface still lacks authenticated GitHub Actions artifact/log access, and no same-run bundle or reviewed access/retention diagnosis was recovered for either run after the noon refresh. Preserve this exact wait and do not rerun unchanged.",
    resumeCondition:
      "Resume only when an authenticated GitHub Actions access surface recovers reviewable same-run artifacts/logs for run 28618650515 and/or run 28621344506, or records an explicit reviewed access/retention diagnosis for each exact run that materially changes the next truthful action. Do not rerun either spec unchanged before one of those outcomes exists.",
    summary:
      "Refreshed the exact secops-fips two-run artifact-visibility wait at the 2026-07-12 18:00Z fallback review, preserved the same two-run carrier/evidence frontier, and moved the next check/fallback window to 2026-07-13T18:00:00Z / 2026-07-14T18:00:00Z without widening scope or reopening reruns.",
    fallbackAction:
      "If authenticated artifact visibility is still missing, refresh this exact two-run family wait with returned owner/workflow evidence or create one exact recovery/escalation task for runs 28618650515 and 28621344506; do not rerun unchanged.",
  },
  {
    taskId: "wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708",
    condition:
      "2026-07-12 18:00Z fallback review revalidated this exact shared virtual-node runtime-readiness family: accepted same-surface evidence still shows cluster create and delegated subnet wiring can succeed, but virtual-node-aci-linux does not realize or witness scheduling does not mature on the same bounded serverless surface, and no same-surface recovery signal appeared after the noon refresh. Preserve this exact wait and do not reopen an unchanged rerun.",
    resumeCondition:
      "Resume only after reviewed same-surface evidence shows virtual-node-aci-linux now realizes and the exact DNS/burst/subnet-validation witness claims can execute on the bounded serverless surface, or an owner-approved replacement execution surface changes the runtime meaning.",
    summary:
      "Refreshed the exact serverless virtual-node runtime-readiness wait at the 2026-07-12 18:00Z fallback review, preserved the bounded same-surface blocker, and moved the next check/fallback window to 2026-07-13T18:00:00Z / 2026-07-14T18:00:00Z without widening or reopening reruns.",
    fallbackAction:
      "If the runtime-readiness wait is still true at fallback, refresh this exact family holder with newer same-surface evidence or replace it only with one narrower active/review successor; do not reopen an unchanged rerun.",
  },
  {
    taskId: "wait-spec-gpu-classic-westus2-sku-support-family-return-20260704",
    condition:
      "2026-07-12 18:00Z fallback review revalidated the classic westus2 GPU support family while preserving its sharpened live scope: bounded classic GPU reruns already happened, the current staging westus2/subscription surface still fails with VMSizeNotSupported for spec.gpu.multi-gpu-workload and spec.gpu.operator-default-install, attempted request-shape and gpuProfile.driver repairs remain exhausted, and spec.gpu.skip-driver-install stays excluded because controller-visible state already shows it as pass on compact run 171680833. Preserve this exact two-spec wait.",
    resumeCondition:
      "Resume only when reviewed same-surface evidence shows a supported westus2 GPU SKU on the staging subscription for spec.gpu.multi-gpu-workload or spec.gpu.operator-default-install, or when an owner-approved replacement region/subscription/source-backed target exists; keep spec.gpu.skip-driver-install excluded unless a later exact regression reopens it.",
    summary:
      "Refreshed the exact GPU classic westus2 support wait at the 2026-07-12 18:00Z fallback review, preserved the sharpened two-spec scope, and moved the next check/fallback window to 2026-07-13T18:00:00Z / 2026-07-14T18:00:00Z without widening family scope.",
    fallbackAction:
      "If the westus2 classic GPU support wait is still unchanged, refresh this exact two-spec holder from any returned support signal or create one exact owner-facing recovery/escalation task; do not widen the GPU family or rerun unchanged.",
  },
  {
    taskId:
      "hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709",
    condition:
      "2026-07-12 18:00Z fallback review revalidated that this provisioning-request carrier must remain its own exact wait: repair validation already retired the stale assertion bug, exact same-path rerun 171358618 already consumed the truthful rerun opportunity, and the returned live result still failed earlier on an environment/create HTTP 400 surface rather than on stale provisioning-request assertions. Preserve this exact post-repair provisioning-request frontier and do not fold it into the VM-prerelease create-stage waits.",
    resumeCondition:
      "Resume only when a stronger same-path environment signal, material input/diagnosis change, or owner-reviewed classification change makes another provisioning-request rerun truthful, or when future accepted evidence replaces this exact holder with a sharper shared wait.",
    summary:
      "Refreshed the provisioning-request environment holder at the 2026-07-12 18:00Z fallback review, preserved its distinct post-repair meaning, and moved the next check/fallback window to 2026-07-13T18:00:00Z / 2026-07-14T18:00:00Z without collapsing the autoscaler frontier.",
    fallbackAction:
      "If no stronger environment signal arrives, keep this exact holder only with fresh evidence from blocked-frontier triage or replace it with one sharper exact family wait backed by accepted evidence.",
  },
  {
    taskId:
      "hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708",
    condition:
      "2026-07-12 18:00Z fallback review revalidated that maintained run 28721673014 still leaves spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability on an exact reviewed environment frontier with no stronger same-path create-stage diagnosis than environment-only cluster failed. Keep row49 separate from the local-storage/mincount create-stage pair until stronger same-path proof exists.",
    resumeCondition:
      "Resume only when stronger same-path environment evidence changes the exact row-49 overscale frontier, or when the owner explicitly approves one bounded rerun for this same carrier.",
    summary:
      "Refreshed the row49 overscale environment holder at the 2026-07-12 18:00Z fallback review, preserved its distinct environment-only frontier, and moved the next check/fallback window to 2026-07-13T18:00:00Z / 2026-07-14T18:00:00Z without folding it into neighboring autoscaler waits.",
    fallbackAction:
      "If unchanged, refresh this exact holder with evidence from blocked-frontier triage rather than reopening the broad family or folding row49 into a coarser create-stage wait without stronger proof.",
  },
  {
    taskId:
      "wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708",
    condition:
      "2026-07-12 18:00Z fallback review revalidated that preserved run 28570003207 still fails in setup.create-cluster with generic same-surface HTTP 400 before the local-storage runtime assertions, so this carrier remains an exact create-stage frontier. Keep it separate from the provisioning-request and mincount carriers because current evidence does not sharpen it to the same request/diagnostic surface as either neighbor.",
    resumeCondition:
      "Resume only when stronger same-path environment/runtime evidence changes the cluster-create HTTP 400 frontier for spec.cluster-autoscaler.vm-prerelease-local-storage-runtime, or when an owner-approved exact rerun surface materially changes the current contract.",
    summary:
      "Refreshed the local-storage create-stage wait at the 2026-07-12 18:00Z fallback review, preserved its distinct generic create-stage diagnosis, and moved the next check/fallback window to 2026-07-13T18:00:00Z / 2026-07-14T18:00:00Z without merging autoscaler carriers.",
    fallbackAction:
      "If the same create-stage frontier still holds, refresh this exact wait with new evidence or create one sharper same-path successor; do not reopen a broad cluster-autoscaler wave or merge it into a coarser family wait without stronger proof.",
  },
  {
    taskId:
      "wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708",
    condition:
      "2026-07-12 18:00Z fallback review revalidated that preserved run 28569996902 still carries the sharper preview-header-backed row-48 3/5/3 create-stage HTTP 400 diagnosis for spec.cluster-autoscaler.vm-prerelease-mincount-recovery. Keep this holder separate because its same-path preview-header and row-local diagnostic quality is sharper than the neighboring local-storage and provisioning-request waits.",
    resumeCondition:
      "Resume only when stronger same-path environment/runtime evidence changes the row-48 preview-header cluster-create HTTP 400 frontier for spec.cluster-autoscaler.vm-prerelease-mincount-recovery, or when an owner-approved exact rerun surface materially changes the contract.",
    summary:
      "Refreshed the mincount-recovery create-stage wait at the 2026-07-12 18:00Z fallback review, preserved its sharper preview-header-backed diagnosis, and moved the next check/fallback window to 2026-07-13T18:00:00Z / 2026-07-14T18:00:00Z without merging autoscaler carriers.",
    fallbackAction:
      "If the same create-stage frontier still holds, refresh this exact wait with new evidence or create one sharper same-path successor; do not reopen a broad cluster-autoscaler wave or merge it into a coarser family wait without stronger proof.",
  },
];

const refreshed = waits.map((wait) =>
  refreshBlockedWait(config, {
    taskId: wait.taskId,
    condition: wait.condition,
    resumeCondition: wait.resumeCondition,
    summary: wait.summary,
    category: "external-wait",
    owner: "human",
    nextCheckAt,
    fallbackAt,
    fallbackAction: wait.fallbackAction,
  }),
);

const evidenceLines = [
  `# 18:00Z noon-family fallback apply wave — 2026-07-12`,
  "",
  `- Task: \`ops-apply-execute-1800-noon-family-fallback-review-wave-app-ops-20260712\``,
  `- Attempt: \`${attemptId}\``,
  `- Worker: \`app-ops\``,
  `- Source review memo: \`${sourceReviewMemo}\``,
  `- Applied at: \`${checkedAt}\``,
  `- Next review window: \`${nextCheckAt}\``,
  `- Fallback window: \`${fallbackAt}\``,
  "",
  "## Applied outcome",
  "",
  "Applied the 18:00Z fallback review outcome as an exact in-place refresh of the same eight blocked carriers. The repair preserved the four cluster-autoscaler carriers separately, kept the app-routing/secops/serverless/GPU waits exact, and moved every refreshed wait to a future next/fallback window without widening family scope or reopening unchanged reruns.",
  "",
  "## Runtime mutation scope",
  "",
  "- Supported mechanism: `refreshBlockedWait()` via `workflows/lib/task-tree-tools.ts`",
  "- Runtime task-tree mutations: eight exact blocked waits refreshed in place",
  "- Loop-state mutations: none required for this repair; controller-visible proof is the refreshed exact waits themselves",
  "",
  "## Refreshed waits",
  "",
  "| Task id | next_check_at | fallback_at | refresh summary |",
  "| --- | --- | --- | --- |",
  ...refreshed.map(
    (task) =>
      `| \`${task.id}\` | \`${String((task.blocker as Record<string, unknown>).next_check_at ?? "")}\` | \`${String((task.blocker as Record<string, unknown>).fallback_at ?? "")}\` | ${String(task.result ?? "")} |`,
  ),
  "",
  "## Evidence anchors preserved",
  "",
  "- `evidence/archive/ops-execute-1800-noon-family-fallback-review-wave-app-ops-20260712c.md` remains the review authority for the eight-carrier no-shape-change outcome.",
  "- Live `task-tree show` after this apply step should now show `trace.blocked_wait_refreshed_at` at this attempt time and `blocker.next_check_at` / `blocker.fallback_at` at `2026-07-13T18:00:00Z` / `2026-07-14T18:00:00Z` for all eight named waits.",
  "",
  "## Exact carrier set refreshed",
  "",
  ...waits.map((wait) => `- \`${wait.taskId}\``),
  "",
];

const evidenceAbsolutePath = resolve(appDir, evidencePath);
mkdirSync(dirname(evidenceAbsolutePath), { recursive: true });
writeFileSync(evidenceAbsolutePath, `${evidenceLines.join("\n")}\n`, "utf-8");

console.log(
  JSON.stringify(
    {
      attemptId,
      checkedAt,
      evidencePath,
      nextCheckAt,
      fallbackAt,
      refreshed: refreshed.map((task) => ({
        taskId: task.id,
        nextCheckAt: (task.blocker as Record<string, unknown>).next_check_at,
        fallbackAt: (task.blocker as Record<string, unknown>).fallback_at,
        refreshedAt: (task.trace as Record<string, unknown>).blocked_wait_refreshed_at,
        summary: task.result,
      })),
    },
    null,
    2,
  ),
);
