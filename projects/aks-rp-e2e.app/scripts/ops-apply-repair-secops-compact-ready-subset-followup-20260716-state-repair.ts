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

const attemptId =
  "a_ops-apply-repair-secops-compact-ready-subset-followup-20260716-state-repair_20260716144603";
const repairTaskId =
  "ops-apply-repair-secops-compact-ready-subset-followup-20260716-state-repair";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const featureLoopTaskId = "aks-feature-compact-loop";
const featureKey = "secops";
const holderTaskId = "hold-compact-secops-package-partial-frontier-20260714";
const appMemoPath =
  "evidence/archive/ops-apply-repair-secops-compact-ready-subset-followup-20260716-state-repair.md";
const appMemoAbsolute = resolve(appDir, appMemoPath);
const domainMemoPath =
  "../aks-rp-e2e/evidence/archive/secops-compact-ready-subset-followup-20260716.md";
const adoReviewMemoPath =
  "../aks-rp-e2e/evidence/archive/wait-secops-ready-subset-ado-run-172310265-result-20260715.md";
const stagingSummaryPath = "../aks-rp-e2e/features/secops/compact/staging.summary.md";
const readySubsetRunId = "172310265";

const frontierTaskIds = [
  "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
  "wait-secops-identity-sp-workflow-secret-contract-return-20260704",
  "wait-secops-identity-user-assigned-row153-runtime-return-20260709",
  "wait-secops-identity-system-assigned-breadth-execute-approval-return-20260710",
  "hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708",
  "wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708",
  "hold-spec-shared-authenticated-artifact-result-recovery-family-20260714",
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
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

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: featureLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactLoaded.state;
const secopsBefore = clone(compactState.features[featureKey]);
assert(secopsBefore, `Missing feature-compact state for ${featureKey}`);
assert(
  secopsBefore.taskId === holderTaskId,
  `Expected ${featureKey}.taskId=${holderTaskId}, got ${secopsBefore.taskId ?? "(null)"}`,
);
assert(
  typeof secopsBefore.nextStepClassification === "string" &&
    secopsBefore.nextStepClassification.includes("28732370985"),
  "Expected stale nextStepClassification to mention run 28732370985",
);
assert(
  typeof secopsBefore.resumeCondition === "string" &&
    secopsBefore.resumeCondition.includes("28732370985"),
  "Expected stale resumeCondition to mention run 28732370985",
);
assert(
  typeof secopsBefore.verificationBlocker === "string" &&
    secopsBefore.verificationBlocker.includes("28732370985"),
  "Expected stale verificationBlocker to mention run 28732370985",
);

const treeBefore = readTaskTree(config);
const holderBefore = treeBefore.tasks[holderTaskId] as TaskNode | undefined;
assert(holderBefore, `Missing holder task ${holderTaskId}`);
assert(
  asString(asRecord(holderBefore.blocker).condition).includes(
    "domain/repair-secops-compact-ready-subset-followup-20260716",
  ),
  "Expected holder blocker condition to mention the follow-up task before repair",
);

for (const frontierTaskId of frontierTaskIds) {
  assert(
    treeBefore.tasks[frontierTaskId],
    `Missing frontier carrier task ${frontierTaskId}`,
  );
}

const nextStepClassification =
  "Preserve the current seven-carrier secops compact frontier: Azure DevOps run 172310265 already consumed the only 11-spec dependency-clear ready subset, so no narrower ready subset remains now. Reopen only if one represented carrier materially changes or sharpens into a same-lineage successor.";
const waitingCondition =
  "Resume only when one of the seven represented exact secops frontier carriers materially changes, returns a bounded decision, or sharpens into a same-lineage successor. Azure DevOps run 172310265 already consumed the only dependency-clear 11-spec ready subset, so no separate ready-subset rerun remains truthful now.";
const blockedReason =
  "Azure DevOps run 172310265 already consumed the only dependency-clear 11-spec secops ready subset (pass=11, fail=0, blocked=0, error=0, skipped=0). The remaining 14 live-blocked selected members are still represented exactly by these seven carriers: wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702, wait-secops-identity-sp-workflow-secret-contract-return-20260704, wait-secops-identity-user-assigned-row153-runtime-return-20260709, wait-secops-identity-system-assigned-breadth-execute-approval-return-20260710, hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708, wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708, and hold-spec-shared-authenticated-artifact-result-recovery-family-20260714. The only selected members outside that live blocked frontier remain the two reviewed mismatch surfaces spec.secops-fips.blocked-addon-boundary.slice2 and spec.secops-fips.version-gate. Do not reopen an unchanged broad secops compact rerun while those represented blockers remain true.";
const verificationBlocker =
  "Do not dispatch another duplicate secops ready-subset rerun now: Azure DevOps run 172310265 already fully consumed the exact 11-spec dependency-clear subset, and the remaining selected inventory is governed only by the seven represented carriers plus the two reviewed mismatch surfaces outside live-ready scope. Reopen only when one carrier materially changes or sharpens.";
const lastSummary =
  "Secops compact remains package-partial on the same seven represented carriers after Azure DevOps run 172310265 fully consumed the only 11-spec dependency-clear ready subset; the two remaining non-frontier selected members stay as reviewed mismatch surfaces outside live-ready scope. No unchanged broad rerun is truthful. See evidence/archive/ops-apply-repair-secops-compact-ready-subset-followup-20260716-state-repair.md.";
const stateSummary =
  `${attemptId}: refreshed app-owned secops compact metadata so it no longer treats run 28732370985 as the active ready-subset resume surface; holder ${holderTaskId} remains current, frontierTaskIds now name the seven represented carriers, and future reopen is truthful only after a material carrier change or sharper same-lineage successor.`;
const attemptedFixLine =
  `${attemptId}: replaced stale ready-subset metadata that still pointed at run 28732370985 with the accepted current truth that Azure DevOps run 172310265 fully consumed the 11-spec ready subset and no dependency-clear secops subset remains beyond the seven represented carriers.`;

const holderCondition =
  "Accepted 2026-07-16 follow-up evidence confirmed Azure DevOps run 172310265 fully consumed the only dependency-clear 11-spec secops ready subset. Keep this compact-facing holder blocked on the same seven represented carriers (automatic capacity family, SP workflow-secret contract pair, row-153 user-assigned runtime frontier, system-assigned breadth approval boundary, residual secops-fips mixed frontier, terminal GitHub-auth artifact family, and shared-auth returned-run artifact/result recovery family). The only selected members outside that live blocked frontier remain the two reviewed mismatch surfaces spec.secops-fips.blocked-addon-boundary.slice2 and spec.secops-fips.version-gate; do not reopen a broad secops rerun unless one represented carrier materially changes or sharpens.";
const holderResumeCondition =
  "Resume only when one of the same seven represented secops carriers materially changes, returns a bounded decision, or sharpens into a same-lineage successor. The old ready-subset question is closed: Azure DevOps run 172310265 already consumed the only dependency-clear 11-spec subset.";
const holderFallbackAction =
  "If the same represented secops frontier still holds at fallback, refresh this holder from the latest exact downstream waits plus the accepted run-172310265 ready-subset accounting; do not reopen an unchanged broad secops rerun and do not recreate a ready-subset leaf unless one carrier actually changes or sharpens.";
const holderResult =
  "Accepted 2026-07-16 secops ready-subset follow-up evidence proved Azure DevOps run 172310265 already consumed the only dependency-clear 11-spec subset, so this compact-facing holder stays blocked on the same seven represented carriers and no narrower ready subset remains truthful now.";

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holder = tree.tasks[holderTaskId] as TaskNode | undefined;
  if (!holder) throw new Error(`Missing holder ${holderTaskId} during apply`);

  const blocker = asRecord(holder.blocker);
  holder.outputs = unique([...asStringArray(holder.outputs), appMemoPath]);
  holder.blocker = {
    ...blocker,
    condition: holderCondition,
    resume_condition: holderResumeCondition,
    fallback_action: holderFallbackAction,
  };
  holder.result = holderResult;
  holder.trace = {
    ...(holder.trace && typeof holder.trace === "object" && !Array.isArray(holder.trace)
      ? clone(holder.trace)
      : {}),
    blocked_wait_refreshed_at: appliedAt,
    blocked_wait_refreshed_by: "app-ops-apply-script",
    blocked_wait_refresh_summary:
      "Accepted secops ready-subset follow-up evidence closed the stale run-28732370985 next-step text: run 172310265 already consumed the only dependency-clear subset, so the holder remains blocked on the same seven represented carriers.",
  };
  saveTaskTreeWithKanbanSnapshot(config, tree);

  return clone(holder);
});

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [...frontierTaskIds],
  retryable: false,
  retryReason: waitingCondition,
  nextStepClassification,
  resumeCondition: waitingCondition,
  blockedReason,
  waitingCondition,
  attemptedFixes: unique([
    ...(Array.isArray(secopsBefore.attemptedFixes) ? secopsBefore.attemptedFixes : []),
    attemptedFixLine,
  ]),
  evidencePaths: unique([
    ...(Array.isArray(secopsBefore.evidencePaths) ? secopsBefore.evidencePaths : []),
    appMemoPath,
    domainMemoPath,
    adoReviewMemoPath,
    stagingSummaryPath,
  ]),
  reviewEvidencePath: appMemoPath,
  verificationBlocker,
  lastSummary,
  summary: stateSummary,
  lastCheckedAt: appliedAt,
});
saveFeatureCompactLoopState(compactLoaded.path, compactState);

const compactAfter = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: featureLoopTaskId,
  windowSize: 1,
  statePath: compactLoaded.path,
  refreshFromProject: false,
}).state.features[featureKey];
assert(compactAfter, `Missing feature-compact state for ${featureKey} after apply`);
assert(
  compactAfter.taskId === holderTaskId,
  `Expected ${featureKey}.taskId to remain ${holderTaskId}`,
);
assert(
  JSON.stringify(compactAfter.frontierTaskIds ?? []) === JSON.stringify(frontierTaskIds),
  `Expected ${featureKey}.frontierTaskIds to match the seven represented carriers`,
);
assert(
  typeof compactAfter.resumeCondition === "string" &&
    compactAfter.resumeCondition.includes(readySubsetRunId) &&
    !compactAfter.resumeCondition.includes("28732370985"),
  "Expected repaired resumeCondition to cite run 172310265 and no longer cite run 28732370985",
);
assert(
  typeof compactAfter.verificationBlocker === "string" &&
    compactAfter.verificationBlocker.includes(readySubsetRunId) &&
    !compactAfter.verificationBlocker.includes("28732370985"),
  "Expected repaired verificationBlocker to cite run 172310265 and no longer cite run 28732370985",
);

const compactVerificationCommand = `cd /app/projects/aks-rp-e2e.app && bun -e 'import { loadFeatureCompactLoopState } from "./workflows/lib/feature-compact-loop-store.ts"; const { state } = loadFeatureCompactLoopState({ appDir: process.cwd(), projectDir: ${JSON.stringify(projectDir)}, loopTaskId: ${JSON.stringify(featureLoopTaskId)}, windowSize: 1, refreshFromProject: false }); console.log(JSON.stringify(state.features.secops, null, 2));'`;

const memo = `# App-ops apply — secops compact ready-subset metadata repair — 2026-07-16

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Supported mechanism: app-local script using feature-compact loop store helpers plus task-tree lock/save helpers (no direct JSON editing)

## Baseline before repair

### Live holder before repair

Supported read used before apply:

    cd /app/projects/aks-rp-e2e.app && bun run task-tree -- show ${holderTaskId}

Observed stale holder facts before apply:

- Holder id remained \`${holderTaskId}\`.
- Holder blocker condition still referenced active follow-up task \`domain/repair-secops-compact-ready-subset-followup-20260716\` as if the narrower-ready-subset question were still open.
- Holder blocker resume condition still allowed the follow-up task to answer whether a narrower subset exists, even though accepted review evidence already says no dependency-clear subset remains.

### Feature-compact state before repair

The app-owned secops row in \`.state/feature-compact-loop/state.json\` still carried stale ready-subset metadata:

- \`nextStepClassification\`: ${JSON.stringify(secopsBefore.nextStepClassification ?? null)}
- \`resumeCondition\`: ${JSON.stringify(secopsBefore.resumeCondition ?? null)}
- \`verificationBlocker\`: ${JSON.stringify(secopsBefore.verificationBlocker ?? null)}
- \`frontierTaskIds\`: ${JSON.stringify(secopsBefore.frontierTaskIds ?? [])}

## Accepted current truth applied

Grounding evidence used for this repair:

- Domain memo: \`${domainMemoPath}\`
- ADO ready-subset result review: \`${adoReviewMemoPath}\`
- Compact summary: \`${stagingSummaryPath}\`

Accepted truth restored:

1. Azure DevOps run \`${readySubsetRunId}\` already fully consumed the only dependency-clear 11-spec secops ready subset.
2. No dependency-clear secops ready subset remains now.
3. The remaining live blocked secops frontier is governed only by these seven represented carriers:
   - \`${frontierTaskIds[0]}\`
   - \`${frontierTaskIds[1]}\`
   - \`${frontierTaskIds[2]}\`
   - \`${frontierTaskIds[3]}\`
   - \`${frontierTaskIds[4]}\`
   - \`${frontierTaskIds[5]}\`
   - \`${frontierTaskIds[6]}\`
4. The two selected members outside that live blocked frontier remain the reviewed mismatch surfaces \`spec.secops-fips.blocked-addon-boundary.slice2\` and \`spec.secops-fips.version-gate\`.

## Repair applied

### Task-tree holder refresh

The live blocked holder stayed the same id, but its blocker text was refreshed to current truth and this app memo was added to outputs.

After apply, supported read should show:

- holder id still \`${holderTaskId}\`
- blocker condition cites run \`${readySubsetRunId}\`, not the stale run-28732370985 ready-subset surface
- blocker text says no narrower ready subset remains unless one represented carrier materially changes or sharpens

### Feature-compact loop refresh

The app-owned secops feature row now records the exact represented frontier and current resume truth:

- \`taskId\` remains \`${compactAfter.taskId ?? "null"}\`
- \`frontierTaskIds\` is now ${JSON.stringify(compactAfter.frontierTaskIds ?? [])}
- \`nextStepClassification\` is now ${JSON.stringify(compactAfter.nextStepClassification ?? null)}
- \`resumeCondition\` is now ${JSON.stringify(compactAfter.resumeCondition ?? null)}
- \`verificationBlocker\` is now ${JSON.stringify(compactAfter.verificationBlocker ?? null)}
- \`reviewEvidencePath\` is now ${JSON.stringify(compactAfter.reviewEvidencePath ?? null)}

## Spec-loop note

This repair did not need a \`.state/spec-loop/state.json\` rewrite. The accepted truth here was metadata drift on the compact-facing holder/state wording, not a stale per-spec state pointer. Spec-loop remained a read-only parity check for the seven represented carriers.

## Verification reads after apply

1. Live holder:

       cd /app/projects/aks-rp-e2e.app && bun run task-tree -- show ${holderTaskId}

   Expected current facts:

   - \`state = blocked\`
   - \`outputs\` includes \`${appMemoPath}\`
   - \`blocker.condition\` cites run \`${readySubsetRunId}\`
   - \`blocker.condition\` no longer treats \`domain/repair-secops-compact-ready-subset-followup-20260716\` as an open question

2. App-owned compact state:

       ${compactVerificationCommand}

   Expected current facts:

   - \`taskId = ${holderTaskId}\`
   - \`frontierTaskIds\` lists the seven represented carrier task ids
   - \`resumeCondition\` cites run \`${readySubsetRunId}\`
   - \`resumeCondition\` no longer cites run \`28732370985\`
   - \`verificationBlocker\` no longer cites run \`28732370985\`
`;

writeText(appMemoAbsolute, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      repairTaskId,
      holderTaskId,
      frontierTaskIds: compactAfter.frontierTaskIds ?? null,
      before: {
        nextStepClassification: secopsBefore.nextStepClassification ?? null,
        resumeCondition: secopsBefore.resumeCondition ?? null,
        verificationBlocker: secopsBefore.verificationBlocker ?? null,
        frontierTaskIds: secopsBefore.frontierTaskIds ?? null,
      },
      after: {
        nextStepClassification: compactAfter.nextStepClassification ?? null,
        resumeCondition: compactAfter.resumeCondition ?? null,
        verificationBlocker: compactAfter.verificationBlocker ?? null,
        frontierTaskIds: compactAfter.frontierTaskIds ?? null,
        reviewEvidencePath: compactAfter.reviewEvidencePath ?? null,
      },
      holder: {
        outputs: treeMutation.outputs ?? null,
        blockerCondition: asString(asRecord(treeMutation.blocker).condition) || null,
        blockerResumeCondition:
          asString(asRecord(treeMutation.blocker).resume_condition) || null,
      },
      memoPath: appMemoPath,
    },
    null,
    2,
  ),
);
