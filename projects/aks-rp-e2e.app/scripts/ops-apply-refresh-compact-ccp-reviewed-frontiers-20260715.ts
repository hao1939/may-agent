import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree } from "../workflows/lib/task-tree-store.ts";

type TaskNodeLike = {
  id?: string;
  goal?: string;
  blocker?: unknown;
};

type SpecLoopState = {
  specs?: Record<
    string,
    {
      taskId?: string | null;
      status?: string | null;
      catalogStatus?: string | null;
      catalogSpecState?: string | null;
      review?: {
        classification?: string | null;
        lastAction?: string | null;
      } | null;
    }
  >;
};

const attemptId =
  "a_ops-apply-refresh-compact-ccp-reviewed-frontiers-20260715-state-repair_20260715005227";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const loopTaskId = "aks-feature-compact-loop";
const domainMemoPath =
  "evidence/archive/domain-refresh-compact-ccp-reviewed-frontiers-20260715.md";
const domainMemoAbsolutePath = resolve(projectDir, domainMemoPath);
const appMemoPath =
  "evidence/archive/ops-apply-refresh-compact-ccp-reviewed-frontiers-20260715-state-repair.md";
const specLoopPath = resolve(appDir, ".state/spec-loop/state.json");

type FeatureRepairSpec = {
  featureKey: "ccp-agent" | "ccp-autoupgrader-pipeline";
  holderTaskId: string;
  expectedWaitingType: string;
  ownerReason: string;
  nextStepClassification: string;
  summary: string;
  evidencePaths: string[];
  expectedRepresentedTaskIds?: string[];
  expectedRepresentedSpecIds?: string[];
};

const featureRepairs: FeatureRepairSpec[] = [
  {
    featureKey: "ccp-agent",
    holderTaskId: "hold-compact-ccp-agent-reviewed-exception-frontier",
    expectedWaitingType: "split-frontier",
    ownerReason:
      "The three non-migration CCP-agent candidates already left this compact reviewed-exception holder. The only remaining compact-facing blocker is the represented downstream wait wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708 for spec.ccp.tunnelfront-konnectivity-migration.",
    nextStepClassification:
      "preserve one exact represented split-frontier wait until wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708 materially changes; do not recreate the retired mixed promotion frontier or rerun compact unchanged",
    summary:
      "Refreshed ccp-agent compact projection to the sharpened represented split-frontier holder: controller-visible waitingFor now points at wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708 for spec.ccp.tunnelfront-konnectivity-migration instead of the stale generic compact wait.",
    evidencePaths: [
      "features/ccp-agent/compact/staging.summary.md",
      "evidence/archive/ccp-agent-promotion-candidates-frontier-review-20260711.md",
      "evidence/archive/await-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708.md",
    ],
    expectedRepresentedTaskIds: [
      "wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708",
    ],
    expectedRepresentedSpecIds: [
      "spec.ccp.tunnelfront-konnectivity-migration",
    ],
  },
  {
    featureKey: "ccp-autoupgrader-pipeline",
    holderTaskId:
      "hold-compact-ccp-autoupgrader-pipeline-reviewed-exception-frontier",
    expectedWaitingType: "pipeline.result.or.artifact.available",
    ownerReason:
      "The sole compact member remains spec.ccp-autoupgrader.pipeline-daily-master as a source-grounded pipeline-only carrier. Stronger same-path proof still requires authoritative ADO pipeline 459172 access or a returned authoritative artifact rather than a project-staging rerun.",
    nextStepClassification:
      "preserve the pipeline-only proof ceiling until authoritative pipeline 459172 access or a returned same-path artifact materially changes the frontier; do not imply generic staging recovery or rerun compact unchanged",
    summary:
      "Refreshed ccp-autoupgrader-pipeline compact projection to the sharpened pipeline-only proof ceiling holder: controller-visible waitingFor now uses pipeline.result.or.artifact.available instead of the stale generic compact wait.",
    evidencePaths: [
      "features/ccp-autoupgrader-pipeline/compact/staging.summary.md",
      "evidence/archive/capture-spec-ccp-autoupgrader-pipeline-daily-master-source-check-ceiling-20260628.md",
      "evidence/archive/review-compact-feature-ccp-autoupgrader-environment-alternate-or-escalation-20260630.md",
    ],
  },
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
  ];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stableSnapshot(feature: FeatureCompactItemState | undefined) {
  if (!feature) return null;
  return {
    taskId: feature.taskId ?? null,
    frontierTaskIds: feature.frontierTaskIds ?? null,
    ownerReason: feature.ownerReason ?? null,
    blockedReason: feature.blockedReason ?? null,
    waitingFor: feature.waitingFor ?? null,
    waitingCondition: feature.waitingCondition ?? null,
    observedBy: feature.observedBy ?? null,
    observationMethod: feature.observationMethod ?? null,
    nextCheckAt: feature.nextCheckAt ?? null,
    fallbackAt: feature.fallbackAt ?? null,
    fallbackAction: feature.fallbackAction ?? null,
    reviewEvidencePath: feature.reviewEvidencePath ?? null,
    summary: feature.summary ?? null,
    lastSummary: feature.lastSummary ?? null,
  };
}

const specLoop = readJson<SpecLoopState>(specLoopPath);
const migrationSpec = specLoop.specs?.["spec.ccp.tunnelfront-konnectivity-migration"];
const autoupgraderSpec =
  specLoop.specs?.["spec.ccp-autoupgrader.pipeline-daily-master"];
assert(migrationSpec, "Missing spec-loop row for spec.ccp.tunnelfront-konnectivity-migration");
assert(
  autoupgraderSpec,
  "Missing spec-loop row for spec.ccp-autoupgrader.pipeline-daily-master",
);

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});
const tree = readTaskTree(config);
const { state, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});

const beforeCompactState = Object.fromEntries(
  featureRepairs.map((repair) => [
    repair.featureKey,
    stableSnapshot(state.features[repair.featureKey]),
  ]),
);

for (const repair of featureRepairs) {
  const holder = tree.tasks[repair.holderTaskId] as TaskNodeLike | undefined;
  assert(holder, `Missing holder task ${repair.holderTaskId}`);
  const blocker = asRecord(holder.blocker);
  const waitingFor = asRecord(blocker.waiting_for);
  const resumeCondition = asString(blocker.resume_condition);
  const condition = asString(blocker.condition);
  const observedBy = asRecord(blocker.observed_by);
  const observationMethod = asString(blocker.observation_method);
  const blockerOwner = asString(blocker.owner);
  const waitingType = asString(waitingFor.type);

  assert(
    waitingType === repair.expectedWaitingType,
    `${repair.holderTaskId} waiting_for.type expected ${repair.expectedWaitingType}, found ${waitingType ?? "(null)"}`,
  );
  assert(condition, `Missing blocker.condition for ${repair.holderTaskId}`);
  assert(
    resumeCondition,
    `Missing blocker.resume_condition for ${repair.holderTaskId}`,
  );
  assert(
    Object.keys(observedBy).length > 0,
    `Missing blocker.observed_by for ${repair.holderTaskId}`,
  );
  assert(
    observationMethod,
    `Missing blocker.observation_method for ${repair.holderTaskId}`,
  );
  assert(blockerOwner, `Missing blocker.owner for ${repair.holderTaskId}`);

  if (repair.expectedRepresentedTaskIds) {
    const representedTaskIds = asStringArray(waitingFor.representedTaskIds);
    assert(
      JSON.stringify(representedTaskIds) ===
        JSON.stringify(repair.expectedRepresentedTaskIds),
      `${repair.holderTaskId} representedTaskIds mismatch: expected ${JSON.stringify(repair.expectedRepresentedTaskIds)}, found ${JSON.stringify(representedTaskIds)}`,
    );
  }
  if (repair.expectedRepresentedSpecIds) {
    const representedSpecIds = asStringArray(waitingFor.representedSpecIds);
    assert(
      JSON.stringify(representedSpecIds) ===
        JSON.stringify(repair.expectedRepresentedSpecIds),
      `${repair.holderTaskId} representedSpecIds mismatch: expected ${JSON.stringify(repair.expectedRepresentedSpecIds)}, found ${JSON.stringify(representedSpecIds)}`,
    );
  }

  const existing = state.features[repair.featureKey];
  assert(existing, `Missing compact feature row for ${repair.featureKey}`);

  const evidencePaths = unique([
    ...(existing.evidencePaths ?? []),
    ...repair.evidencePaths,
    domainMemoAbsolutePath,
    appMemoPath,
  ]);
  const attemptedFixes = unique([
    ...(existing.attemptedFixes ?? []),
    `${attemptId}: refreshed ${repair.featureKey} compact projection from generic waitingFor.type=${String(asRecord(existing.waitingFor).type ?? "(null)")} to ${repair.expectedWaitingType} using ${repair.holderTaskId}.`,
  ]);

  updateFeatureCompactItem(state, repair.featureKey, {
    status: "blocked",
    errorClass: "reviewed-exception",
    retryable: false,
    retryReason: resumeCondition,
    taskId: repair.holderTaskId,
    ownerReason: repair.ownerReason,
    attemptedFixes,
    nextStepClassification: repair.nextStepClassification,
    resumeCondition,
    blockedAt: asString(blocker.blocked_at) ?? existing.blockedAt ?? appliedAt,
    blockedReason: condition,
    waitingFor,
    waitingCondition: resumeCondition,
    observedBy,
    observationMethod,
    nextCheckAt: asString(blocker.next_check_at) ?? existing.nextCheckAt ?? null,
    blockerOwner,
    fallbackAt: asString(blocker.fallback_at) ?? existing.fallbackAt ?? null,
    fallbackAction:
      asString(blocker.fallback_action) ?? existing.fallbackAction ?? null,
    resumeAction:
      existing.resumeAction ??
      `Reset this feature compact record to pending only after ${resumeCondition}`,
    lastCheckedAt: appliedAt,
    evidencePaths,
    reviewEvidencePath: appMemoPath,
    summary: repair.summary,
    lastSummary: repair.summary,
  });
}

saveFeatureCompactLoopState(compactStatePath, state);

const { state: compactAfter } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});

const afterCompactState = Object.fromEntries(
  featureRepairs.map((repair) => {
    const row = compactAfter.features[repair.featureKey];
    assert(row, `Missing compact feature row after save for ${repair.featureKey}`);
    assert(
      asString(asRecord(row.waitingFor).type) === repair.expectedWaitingType,
      `${repair.featureKey} waitingFor.type expected ${repair.expectedWaitingType} after save, found ${String(asRecord(row.waitingFor).type ?? "(null)")}`,
    );
    assert(
      row.reviewEvidencePath === appMemoPath,
      `${repair.featureKey} reviewEvidencePath expected ${appMemoPath}, found ${row.reviewEvidencePath ?? "(null)"}`,
    );
    return [repair.featureKey, stableSnapshot(row)];
  }),
);

const memo = `# App apply: refresh compact CCP reviewed frontiers — 2026-07-15

- Task: \`ops-apply-refresh-compact-ccp-reviewed-frontiers-20260715-state-repair\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`

## Authority used

- Domain memo: \`${domainMemoPath}\`
- Live holders: \`hold-compact-ccp-agent-reviewed-exception-frontier\`, \`hold-compact-ccp-autoupgrader-pipeline-reviewed-exception-frontier\`
- App compact state: \`.state/feature-compact-loop/state.json\`
- App spec state (read only): \`.state/spec-loop/state.json\`

## Baseline before compact-state refresh

The domain memo already identified the required holder repairs. Before this apply step, the controller-visible compact rows were still generic in the same way:

- \`ccp-agent\` row still had \`waitingFor.type=publish.auth.ready\` and stale mixed-frontier retry wording.
- \`ccp-autoupgrader-pipeline\` row still had \`waitingFor.type=publish.auth.ready\` and no app review memo path.

### Pre-refresh snapshots

#### ccp-agent
\`\`\`json
${JSON.stringify(beforeCompactState["ccp-agent"], null, 2)}
\`\`\`

#### ccp-autoupgrader-pipeline
\`\`\`json
${JSON.stringify(beforeCompactState["ccp-autoupgrader-pipeline"], null, 2)}
\`\`\`

## Applied repair

1. Trusted the reviewed holder text/blocker state as the live source of truth after the two exact \`task-tree update-text\` repairs.
2. Refreshed the mirrored compact-loop rows for \`ccp-agent\` and \`ccp-autoupgrader-pipeline\` so the controller-visible projection now matches those sharpened holders.
3. Re-read \`.state/spec-loop/state.json\` and confirmed no spec-loop mutation was required for either represented spec lineage.

## Spec-loop inspection (no write required)

### spec.ccp.tunnelfront-konnectivity-migration
\`\`\`json
${JSON.stringify(migrationSpec, null, 2)}
\`\`\`

### spec.ccp-autoupgrader.pipeline-daily-master
\`\`\`json
${JSON.stringify(autoupgraderSpec, null, 2)}
\`\`\`

## After refresh

### ccp-agent
\`\`\`json
${JSON.stringify(afterCompactState["ccp-agent"], null, 2)}
\`\`\`

### ccp-autoupgrader-pipeline
\`\`\`json
${JSON.stringify(afterCompactState["ccp-autoupgrader-pipeline"], null, 2)}
\`\`\`

## Result

- \`ccp-agent\` compact projection now exposes the represented split-frontier wait with \`waitingFor.type=split-frontier\`, represented task \`wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708\`, and represented spec \`spec.ccp.tunnelfront-konnectivity-migration\`.
- \`ccp-autoupgrader-pipeline\` compact projection now exposes the pipeline-only proof ceiling with \`waitingFor.type=pipeline.result.or.artifact.available\`.
- No unchanged compact rerun was reopened, and no spec-loop row needed repair.
`;

writeText(resolve(appDir, appMemoPath), memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appMemoPath,
      compactStatePath,
      specLoopPath,
      beforeCompactState,
      afterCompactState,
      specLoopInspection: {
        migration: migrationSpec,
        autoupgrader: autoupgraderSpec,
      },
    },
    null,
    2,
  ),
);
