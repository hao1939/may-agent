import type { TaskIntent } from "@may-agent/sdk";

export const specLoopTaskId = "aks-spec-verification-loop";
export const featureCompactLoopTaskId = "aks-feature-compact-loop";
export const masterValidationCompactTaskId = "master-validation-compact";
export const scenarioNormalizationTaskId = "scenario-normalization";
export const legacyBranchReconciliationTaskId = "legacy-branch-reconciliation";
export const repositorySkillMaintenanceTaskId = "repository-skill-maintenance";

export type StandingLoopId =
  | typeof specLoopTaskId
  | typeof featureCompactLoopTaskId
  | typeof masterValidationCompactTaskId
  | typeof scenarioNormalizationTaskId
  | typeof legacyBranchReconciliationTaskId
  | typeof repositorySkillMaintenanceTaskId;

type StandingLoopDefinition = {
  id: StandingLoopId;
  action: string;
  parentId: string;
  agent: string;
  workflow?: string;
  frontierLimit: number;
  input?: Record<string, unknown>;
  outcome: string;
  acceptance: string[];
  priority: "P0" | "P1";
};

export const learnedSpecVerificationAcceptance = [
  "Read hot facts first: current spec JSON, feature model, runner code, and prior ADO/result artifacts before deciding the next move.",
  "Compare nearby good and bad same-family examples before changing the carrier; reuse the proven runner/helper pattern instead of inventing a new shape.",
  "Normalize the carrier before rerun: use the shared runner helpers and target-environment wiring, and keep subscription, region, resource-group, and cluster names generated from the run context.",
  "A single-spec carrier must be self-contained for staging: explicit target environment, owned resource group/cluster when live behavior requires one, and cleanup evidence or a precise cleanup blocker.",
  "Prefer repository REST/API helpers for AKS operations; do not add new az CLI behavior inside test carriers unless the spec explicitly tests CLI behavior.",
  "Do not depend on mounted private AKS RP source, hidden precreated clusters, or local-only files. If preflight flags a policy violation, create the exact carrier repair before rerunning.",
  "Before queueing ADO, verify the branch/commit ADO will run. Push intended domain changes first, or explicitly record that the run is proving older remote source.",
  "Treat execution-surface failures from a retired backend as stale evidence. In particular, a GitHub Actions auth or workflow failure cannot justify a terminal disposition after the project moved to ADO; re-evaluate the ready spec on the current ADO path or preserve one exact current blocker.",
  "A live pass must prove real AKS work when the spec needs it: same spec id, ADO run, result path, resource group or cluster identity, key assertions, and cleanup/disposition evidence. A fast no-cluster pass is inconclusive unless the spec is explicitly source-only.",
  "If test code, spec, model, or runner behavior changes, require a fresh ADO live run for the exact spec on the changed branch before claiming pass; when spec-live-reconciliation is bound, leave dispatch to that workflow after committing the clean source change.",
  "For ADO waits, preserve structured backend, run id, result/artifact path when known, and one exact typed wait condition; when spec-live-reconciliation is bound, the workflow returns that Condition.",
  "Classify ADO state precisely: queued/notStarted means exact wait; terminal with no artifacts means inspect timeline/logs; terminal with artifacts means review result.json and cleanup proof.",
  "On failure, classify from same-spec child assertions and artifacts: carrier/runtime defect, spec/model mismatch, target-environment prerequisite, product behavior, or artifact/ingestion issue. Choose the smallest next repair or rerun.",
  "Reviewer acceptance of an artifact review is not the same as a passing spec. Preserve pass, fail, error, wait, and terminal disposition as structured status in the spec-loop ledger.",
  "Do not update the ledger from stale prose or broad summaries; cite current files/artifacts and make the pass, wait, or terminal disposition visible in structured state.",
];

export const learnedCompactVerificationAcceptance = [
  "Start from the feature packet, declared spec list, current single-spec evidence, and prior compact artifacts before deciding the next move.",
  "When the task input includes representationReview, treat those fenced parent direct-child and completion-receipt facts as the task-authority evidence for cited holders. Do not query task-state files or the task-tree CLI from this workflow, and do not reference a historical task id that the review does not identify as a current direct child or immutable receipt.",
  "Use single-spec learning as input: compact should reuse known-good carriers and represent broken or blocked specs exactly instead of hiding them inside a larger package.",
  "Every feature-owned spec must be covered by the compact package, excluded with a source-grounded reason, or represented by an exact wait or reviewed terminal disposition.",
  "An unbound compact owner task is shared/read-only. When current evidence cites an existing source branch, commit, dispatch metadata, or task worktree, inspect and verify that exact branch/worktree in place; do not copy its delta into the shared canonical dev checkout just to review it.",
  "If review shows an executable compact plan, spec, carrier, or runner source must change, do not edit or publish from the shared canonical checkout and do not return a self-targeting update action. If this task is already bound to spec-live-reconciliation, continue that same task. Otherwise create exactly one direct child bound to spec-live-reconciliation with the complete feature specIds, livePlanPath, fixed target, and any prepared sourceBranch/sourceCommit, then keep this compact task waiting on that live child. Do not create a sibling or successor chain. Use domain-task-execution only for a truly source-only compact patch that requires no live behavior proof.",
  "Treat the selected feature as one natural ordered journey candidate. Split physical cluster reuse only for a named required immutable-property conflict or an unrecoverable logical-history conflict; scenario names, shape-key names, create calls, and delete calls are not split reasons by themselves.",
  "Model cluster requirements as partial constraints: unspecified properties do not conflict, test-local inputs such as kubeconfig scope do not belong to cluster shape, mutable differences are reconciled, and useful post-state is retained for the next test.",
  "Minimize transitions in this order: reuse current state, create test-local resources, apply a mutable update, apply a disruptive update, then recreate the cluster only when unavoidable. Put destructive work last when dependencies permit.",
  "A normalized test may receive the current cluster context or call the standard create/update/delete helpers. Repeated create against satisfied state is a no-op; every test cleans its local resources; suite cleanup owns anything left at the end.",
  "If a compact plan selects many specs but still needs almost one cluster per spec, treat that as unfinished compact work: repair partial requirements, state transitions, normalized lifecycle participation, or cleanup before accepting the plan.",
  "The generated compact plan must show selected specs, ordered journey groups, planned cluster creates/recreates/updates when available, saved clusters, and one concrete reason for every unavoidable split.",
  "The compact plan must run through the same live runner and target-environment wiring as single specs. No no-op, dry-run, or metadata-only pass counts as live proof for AKS behavior.",
  "Before dispatching compact ADO, verify the branch/commit ADO will run and push intended domain changes first.",
  "A live ADO result must be ingested per spec branch; preserve passing branches from a nonpassing aggregate and create focused work only for failing or inconclusive branches.",
  "For ADO waits, return structured backend, run id, result/artifact path when known, and one exact typed wait condition; do not describe the wait only in prose.",
  "Validate the disposition against the post-action graph: if proposed close actions remove the sole live child, return converged only after this task's ledger/output acceptance is satisfied; otherwise preserve a real live child or exact typed Condition. Never return waiting with neither after the proposed mutations.",
  "Classify compact ADO state precisely: queued/notStarted means exact wait; terminal with no artifacts means inspect timeline/logs/preflight; terminal with artifacts means review per-branch result and cleanup proof.",
  "Do not rerun a whole unchanged package when selectionBlocker, metadata eligibility, or route-shape facts say a smaller repair is needed first.",
  "When a compact aggregate fails, isolate the smallest failing branch or reduced route group, learn from sibling pass evidence, repair that surface, then rerun the compact package only after the repair changes the package.",
];

export const learnedScenarioNormalizationAcceptance = [
  "Start from clean current origin/dev, not the dirty local repair branch.",
  "Read the owning spec JSON and prove the exact probeRef/implementation path for each adapter or plain-carrier row.",
  "Inspect same-spec branch, ADO run, artifact, and task evidence before deciding the next move.",
  "Choose exactly one next state: origin/dev absorbed/equivalent, publish/rebase/recheck, smallest same-spec repair, exact external wait with observer/resume condition, terminal disposition, or escalation.",
  "After the required scoped and live proof passes, integrate the tested commit directly into dev and verify it is reachable from origin/dev; do not open or wait on a PR merely to reach dev.",
  "A task branch, pushed commit, passing run, or active PR is progress evidence, not completion. The row is normalized only when current origin/dev contains the accepted carrier or an exact terminal disposition.",
  "A standalone direct .test.ts carrier must execute the scenario in-process on the Vitest surface. A child-process wrapper that shells to Bun, a plain .ts carrier, or another local script is migration scaffolding, not normalization completion.",
  "Use official Learn, Azure REST API specs, and checked-in design docs as contract authority. Mounted AKS RP or Go source is implementation evidence only, and private/local filesystem paths cannot be required carrier inputs or source-of-truth grounding.",
  "For a plain scenario carrier, completion requires current strict inventory to stop listing scenarioTestPath in both remainingSpecReferencedPlainScenarioUnits and remainingRepoPlainScenarioFiles; a sibling .test.ts wrapper that still imports the plain .ts carrier is progress, not completion.",
  "Preserve active behavior while removing a plain carrier by moving reusable code into the direct .test.ts implementation or a shared library outside features/*/tests/*.ts.",
  "Keep source-layout normalization separate from product-contract adjudication: when existing behavior, assertions, and a disputed expectation can be preserved unchanged in direct .test.ts or feature lib source, integrate that normalized source with the truthful current terminal posture and keep any owner approval or escalation as independent follow-up; wait only when the missing authority must decide the implementation itself.",
  "Do not close from filename similarity, stale task summaries, broad plain-TS counters, or review/attention residue alone.",
];

export const standingLoopDefinitions: Record<
  StandingLoopId,
  StandingLoopDefinition
> = {
  [specLoopTaskId]: {
    id: specLoopTaskId,
    action: "spec-loop",
    parentId: "group/spec-verification",
    agent: "app-ops",
    workflow: "spec-loop-controller",
    frontierLimit: 5,
    outcome:
      "Keep every current executable AKS E2E spec represented by proof-backed pass state, one exact resumable wait, one reviewed terminal decision, or one actionable verification leaf.",
    acceptance: [
      "The catalog and app-owned spec-loop ledger contain the same current spec identities.",
      ...learnedSpecVerificationAcceptance,
      "Every incomplete spec has exactly one spec-loop representation by specId.",
      "While eligible work exists, at most five actionable spec leaves are represented; waits and attention do not consume that frontier.",
    ],
    priority: "P1",
  },
  [featureCompactLoopTaskId]: {
    id: featureCompactLoopTaskId,
    action: "feature-compact-loop",
    parentId: "group/feature-compact",
    agent: "app-ops",
    workflow: "feature-compact-loop-controller",
    frontierLimit: 3,
    input: {
      refillEnabled: false,
    },
    outcome:
      "Preserve current feature-compact work and exact waits without refilling broad feature-first work while the master-validation compact campaign is the active project goal.",
    acceptance: [
      "The ledger contains every current feature and its owned-spec fingerprint.",
      ...learnedCompactVerificationAcceptance,
      "Every incomplete feature has exactly one feature-loop representation.",
      "Do not declare new broad feature-first leaves while frontierLimit is zero; existing actionable work may finish and exact waits remain represented.",
    ],
    priority: "P1",
  },
  [masterValidationCompactTaskId]: {
    id: masterValidationCompactTaskId,
    action: "master-validation-compact",
    parentId: "group/feature-compact",
    agent: "aks-explorer",
    frontierLimit: 3,
    input: {
      selectorPath: "ci/feature-sets/master-validation.txt",
      target: "staging",
      selectorCount: 82,
      orderedSelectorSha256:
        "fead61bfcfe026556a0cbba74a7480a02f977be73bfe1dbededa19fa0c66c649",
      // sourceCommit and integratedSourceCommit remain the final adjudicated
      // source coordinate consumed by existing loop readers. The immutable
      // generation-1 receipt coordinates are retained separately.
      sourceCommit: "4decec583c8175a4d2cd493455f2d203a8e4f181",
      generationSourceCommit: "e70485474183f3198144078fdd4bb661304a0d24",
      authorityReceiptTaskId:
        "domain/replan-master-validation-safe-pareto-origin-eec9d9f5-20260820",
      authorityReceiptGeneration: 1,
      authorityArtifactCommit: "8872188481b77a5cca50312e80d8adcf4a2c0e2f",
      canonicalEquivalenceDriftExclusions: [
        "/id",
        "/createdAt",
        "/materialization/generatedAt",
      ],
      canonicalEquivalenceRemainingDifference:
        "/provenance/knowledgeModelFingerprint",
      integratedSourceCommit: "4decec583c8175a4d2cd493455f2d203a8e4f181",
      finalAdjudicatedSourceCommit: "4decec583c8175a4d2cd493455f2d203a8e4f181",
      planPath:
        "evidence/pipelines/master-validation-current-origin-e7048547-feature-journey-plan-20260820.json",
      planSha256:
        "7868989dca44a038902105617089702686cc5a45c3a83033044e3462c4dcdca5",
      proofMatrixPath:
        "evidence/pipelines/master-validation-current-origin-e7048547-feature-journey-proof-matrix-20260820.md",
      proofMatrixSha256:
        "012d21bba5bba6d366906f4d8507695bc24fe75e6d2c55ce0fff0088a6a694c2",
      logicalBaselineClusterBirths: 82,
      logicalCarrierCount: 41,
      logicalClusterBirthsNeeded: 41,
      logicalClusterBirthsSaved: 41,
      logicalClusterBirthSavingsRate: 0.5,
      physicalBaselineClusterBirths: 93,
      physicalClusterBirthsNeeded: 51,
      physicalClusterBirthsSaved: 42,
      physicalClusterBirthSavingsRate: 0.45161290322580644,
      safeguardGetCount: 44,
      runnableSpecCount: 72,
      terminalRouteCount: 10,
      physicalBoundaryCount: 50,
      materialization: "ready",
      projectedCriticalMinutes: 57.975133,
      projectedPackedMinutes: 59.800883,
      projectedMinutes: 59.800883,
      semanticLowerBoundBirths: 26,
      semanticRecordCount: 1609,
      semanticEdgeCount: 1338,
      historicalDisprovedAspiration: {
        maximumPhysicalClusterBirths: 16,
        minimumPhysicalClusterBirthsSaved: 64,
        minimumSavingsRate: 0.8,
      },
      maximumLiveCompactRuns: 3,
    },
    outcome:
      "Maintain the exact current 82-selector staging master-validation safe-Pareto authority generated from clean origin/dev@e70485474183f3198144078fdd4bb661304a0d24 and declared by the immutable generation-1 receipt domain/replan-master-validation-safe-pareto-origin-eec9d9f5-20260820 with final source 4decec583c8175a4d2cd493455f2d203a8e4f181, with 82 logical baseline births reduced to 41 and 93 physical baseline cluster births reduced to 51, saving 42 physical births (45.161290322580644%), while preserving every semantic boundary and replanning whenever authoritative inputs drift.",
    acceptance: [
      "Treat ci/feature-sets/master-validation.txt as the exact campaign scope: current authority is 82 ordered unique selectors with ordered-selector SHA-256 fead61bfcfe026556a0cbba74a7480a02f977be73bfe1dbededa19fa0c66c649.",
      "Accept immutable generation-1 receipt domain/replan-master-validation-safe-pareto-origin-eec9d9f5-20260820: generation source origin/dev@e70485474183f3198144078fdd4bb661304a0d24, authority artifact commit 8872188481b77a5cca50312e80d8adcf4a2c0e2f, and final source 4decec583c8175a4d2cd493455f2d203a8e4f181 only while plan evidence/pipelines/master-validation-current-origin-e7048547-feature-journey-plan-20260820.json SHA-256 7868989dca44a038902105617089702686cc5a45c3a83033044e3462c4dcdca5 and proof matrix evidence/pipelines/master-validation-current-origin-e7048547-feature-journey-proof-matrix-20260820.md SHA-256 012d21bba5bba6d366906f4d8507695bc24fe75e6d2c55ce0fff0088a6a694c2 remain current and prove 82 logical baseline births, 41 logical carriers and births needed, 41 logical births saved (savings rate 0.5), 93 physical baseline births, 51 physical births needed, 42 physical births saved (savings rate 0.45161290322580644), 44 safeguard GETs, 72 runnable operations, ten terminal routes, 50 physical boundaries, ready materialization, exactly 57.975133 projected critical minutes, and exactly 59.800883 projected packed minutes.",
      "Treat current final-source drift as canonically equivalent to the accepted authority only after excluding /id, /createdAt, and /materialization/generatedAt, with /provenance/knowledgeModelFingerprint as the sole remaining difference.",
      "Retain at most 16 physical births, at least 64 saved, and 80% savings only as the historically disproved aspiration: the independently regenerated current weighted semantic floor is 26 births over 1,609 channel-qualified semantic records, 1,338 unique semantic edges, and 50 physical boundaries.",
      "The integrated 51-birth safe-Pareto fallback satisfies this maintenance wave while the independently verifiable 26-birth weighted semantic floor remains valid and no semantics-preserving improvement is demonstrated.",
      "Replan from clean current origin/dev on selector identity or order drift, knowledge-model drift, semantic-edge drift, runtime-profile drift, authority-artifact drift, planner or runner drift, or integrated-source drift; do not reuse stale authority hashes after drift.",
      "Never remove, relabel, ignore, or weaken a source-authored semantic boundary, immutable-property split, lifecycle requirement, target constraint, terminal-route fact, or safeguard merely to improve birth or savings metrics.",
      "Plan the selector set as one natural cross-feature journey before physical bucketing; partition only for a named immutable-property conflict or unrecoverable logical-history conflict and report the exact boundary for every split.",
      "Keep at most three actionable direct children and at most three compact Azure DevOps runs queued or in progress; do not queue Azure for declaration adoption or unchanged authority, and queue live work only for a bounded evidenced change that requires fresh staging proof.",
      "A source-changing child converges only after exact-source staging per-spec and cleanup proof is accepted and tested source is integrated into origin/dev, or one exact typed external Condition preserves the next wake fact.",
    ],
    priority: "P0",
  },
  [scenarioNormalizationTaskId]: {
    id: scenarioNormalizationTaskId,
    action: "scenario-normalization",
    parentId: "group/scenario-normalization",
    agent: "aks-explorer",
    workflow: "normalize-scenario-frontier",
    frontierLimit: 5,
    input: {
      requiredRepositoryCheckCommand: "bun run check",
      qualityInventoryRequired: true,
      qualityInventoryFocus: [
        "official-learn-api-grounding",
        "standalone-direct-carrier-contract",
        "canonical-target-mutation-fixture-cleanup",
        "current-source-staging-live-proof",
      ],
    },
    outcome:
      "Drive clean current origin/dev beyond file-layout migration into truthful direct-carrier normalization: every active spec should end in a readable standalone direct .test.ts implementation (or exact external blocker), grounded expectations and scoped resource/state DAG, and accepted current-source live proof or exact blocker/escalation; repository-only plain scenario carriers must also be removed or truthfully represented.",
    acceptance: [
      "Inventory and review evidence are generated from a clean identified origin/dev revision, and completion also requires a passing full repository check on the reviewed source.",
      ...learnedScenarioNormalizationAcceptance,
      "Treat zero missing adapters / zero spec-referenced plain scenario units / zero repository plain scenario files as file-layout completion only; do not converge while unreferenced plain carriers, unpaired adapters, stale file-layout-only normalization receipts, or active-spec direct-carrier contract gaps remain.",
      "For each active spec in scope, verify the current spec JSON, direct .test.ts carrier, exact probeRef/implementation path, scoped resource/state DAG and expectations, and primary Learn/API-spec grounding; checked-in design docs may refine the public contract, but mounted AKS RP or Go source remains implementation evidence rather than source-of-truth policy.",
      "A normalized carrier is a readable standalone direct .test.ts implementation using the canonical resolved target, explicit mutation safety gate, explicit fixture ownership, safe cleanup, truthful result reporting, and shared helpers only for genuinely repeated mechanics or variants; invoke scenario logic in-process instead of via child-process wrappers, and remove migration-only wiring assertions and tracked runtime-evidence scaffolding when they are no longer the current contract.",
      "Every remaining current surface has exactly one scenario-loop representation: accepted current-source live proof, one exact external blocker/wait/escalation, or one bounded feature-sized repair that still needs staging proof and direct dev integration.",
      "Reconcile stale normalization children and receipts by replacing any still-relevant file-layout-only lineage with one current feature-sized child or exact blocker; do not create a parallel scenario-normalization controller task.",
      "While eligible work exists, keep at most five actionable feature-sized normalization repairs represented; waits and attention do not consume that frontier.",
      "Outstanding normalization live-execution slots are separately capped at five total actionable or exact pipeline-backed wait holders so queued/notStarted and inProgress ADO runs cannot grow beyond the intended frontier while earlier runs drain.",
      "Completion requires strict-passed true on clean current origin/dev, a passing full repository check, and accepted current-source live proof or an exact external blocker/escalation for every current spec in scope.",
    ],
    // This is a continuously refilled maintenance frontier. Keeping its
    // ordinary leaves at P0 can occupy every domain slot and starve the spec
    // and feature-compact loops indefinitely. Concrete incidents may still
    // use P0; routine normalization shares the P1 maintenance lane.
    priority: "P1",
  },
  [legacyBranchReconciliationTaskId]: {
    id: legacyBranchReconciliationTaskId,
    action: "legacy-branch-reconciliation",
    parentId: "group/app-operations",
    agent: "app-ops",
    workflow: "legacy-branch-reconciliation-controller",
    frontierLimit: 1,
    outcome:
      "Reconcile every legacy task branch to one terminal outcome: its valuable change is integrated into origin/dev, or it is explicitly rejected; then remove the branch and any resolved workspace residue.",
    acceptance: [
      "Inventory branch content against current origin/dev rather than treating local or remote storage as completion.",
      "Keep exactly one exact-branch verification actionable at once so origin/dev has one integration writer.",
      "Apply the branch to current origin/dev and rerun conventional scoped checks; allow existing base failures but reject any new failure or debt.",
      "A branch converges only after its passing result reaches origin/dev, or its tree is already represented; then remove its local and remote refs.",
      "Keep conflicting or failing source refs and report the exact evidence for focused repair.",
      "Never delete an attached or dirty recovery workspace through the clean-branch controller.",
    ],
    priority: "P0",
  },
  [repositorySkillMaintenanceTaskId]: {
    id: repositorySkillMaintenanceTaskId,
    action: "repository-skill-maintenance",
    parentId: "group/domain-work",
    agent: "aks-explorer",
    workflow: "domain-task-execution",
    frontierLimit: 1,
    input: {
      skillPath: "skills/aks-rp-e2e",
      reviewIntervalMs: 86_400_000,
      safeEvaluationOnly: true,
    },
    outcome:
      "Keep the aks-rp-e2e repository skill accurate, easy to discover, simple to use, and verified against representative real repository tasks.",
    acceptance: [
      "Evaluate the checked-in skill from clean current origin/dev and identify the exact skill and repository revisions under review.",
      "Start representative user journeys from realistic human requests and use the skill as the primary entry point. In every review, exercise current repository examples from distinct capabilities: explain a real feature or spec and cross-check the inspector's feature path, mutation gate, resource ownership, target, and expected result against source; give executable staging and existing-standalone guidance; diagnose a real recent result or artifact; and plan or review one realistic TypeScript scenario migration. Also cover safe local checks, one checked-in feature set, and Azure DevOps queue previews where they materially support those cases.",
      "For the migration case, inspect one current spec-referenced plain TypeScript carrier and its sibling .test.ts adapter rather than accepting the inventory count alone. Trace mode selection, exact mutation-gate comparison, target inputs, owned versus shared resources, assertions, structured status, and cleanup through the code; verify that check mode and the admission helpers would catch a broken safety gate.",
      "Before running each case, write its expected outcome. Judge the observed answer for correctness, safety, completeness, executable commands, evidence traceability, and unnecessary complexity; command success alone is not acceptance.",
      "Use current repository files, schemas, scripts, and real existing artifacts rather than toy fixtures. Preserve the user-shaped prompt, raw command output, cited source facts, and observed friction so another reviewer can audit the conclusion.",
      "When a case performs poorly, decide whether the defect is in the skill, repository UX or tooling, product behavior, or the evaluation case itself. Do not distort the skill to satisfy an invalid case.",
      "For each real gap, improve the smallest durable surface: SKILL.md, a directly linked reference, a TypeScript or JavaScript helper, agents/openai.yaml, README usage, or the underlying repository UX. Do not add prose or automation without a demonstrated case that needs it.",
      "Keep SKILL.md concise and procedural; keep detailed guidance in directly linked references; keep reusable automation in tested TypeScript or JavaScript run with Bun.",
      "Keep SKILL.md frontmatter, agents/openai.yaml, repository README usage, scripts, examples, current CLI, runner behavior, schemas, and pipeline parameters aligned without duplicating design documentation.",
      "After every material change, rerun the same failed user case, the other review cases, the checked-in skill example suite, and proportionate repository checks. Continue until no material gap remains; if that is not possible in the current iteration, leave one exact child task with the failed case, evidence, owner, and acceptance.",
      "Do not queue live pipelines, use an existing standalone build, or change Azure resources solely for skill evaluation without explicit authorization; inspection, local validation, dry runs, and queue previews are the default.",
      "Integrate ordinary correctness and usability improvements directly into dev through the task-owned workflow. Escalate only a real product, policy, benchmark, or human-approval boundary.",
      "Report a compact case table with the prompt, expected outcome, observed result, gap, change, and verification. Do not commit transient run output. When no material gap exists, converge with evidence for the evaluated revisions and wait for the next scheduled or manual pulse.",
      "Maintain this one stable task; do not create recurring review-task chains for the same skill-quality responsibility.",
    ],
    priority: "P1",
  },
};

export function isStandingLoopId(value: unknown): value is StandingLoopId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(standingLoopDefinitions, value)
  );
}

export function standingLoopIntent(loopId: StandingLoopId): TaskIntent {
  const definition = standingLoopDefinitions[loopId];
  return {
    id: definition.id,
    parentId: definition.parentId,
    outcome: definition.outcome,
    acceptance: definition.acceptance,
    mode: "maintain",
    agent: definition.agent,
    ...(definition.workflow ? { workflow: definition.workflow } : {}),
    input: {
      frontierLimit: definition.frontierLimit,
      ...(definition.input ?? {}),
    },
    priority: definition.priority,
  };
}

export type LoopWorkIdentity = {
  loopId: StandingLoopId;
  workKey: string;
  workRevision: string;
};

export type LoopRepresentation = {
  taskId: string;
  phase?: string;
};

export type LoopFrontierAccounting = {
  actionableTaskIds: string[];
  waitingTaskIds: string[];
  attentionTaskIds: string[];
  terminalTaskIds: string[];
  available: number;
};

const actionablePhases = new Set(["active", "backlog", "pending", "running"]);
const waitingPhases = new Set(["blocked", "waiting"]);
const terminalPhases = new Set(["closed", "converged", "done"]);

export function loopFrontierAccounting(
  representations: LoopRepresentation[],
  frontierLimit: number,
): LoopFrontierAccounting {
  const actionableTaskIds = new Set<string>();
  const waitingTaskIds = new Set<string>();
  const attentionTaskIds = new Set<string>();
  const terminalTaskIds = new Set<string>();

  for (const representation of representations) {
    const phase = String(representation.phase ?? "")
      .trim()
      .toLowerCase();
    if (actionablePhases.has(phase)) {
      actionableTaskIds.add(representation.taskId);
    } else if (waitingPhases.has(phase)) {
      waitingTaskIds.add(representation.taskId);
    } else if (terminalPhases.has(phase)) {
      terminalTaskIds.add(representation.taskId);
    } else {
      attentionTaskIds.add(representation.taskId);
    }
  }

  return {
    actionableTaskIds: [...actionableTaskIds],
    waitingTaskIds: [...waitingTaskIds],
    attentionTaskIds: [...attentionTaskIds],
    terminalTaskIds: [...terminalTaskIds],
    available: Math.max(0, frontierLimit - actionableTaskIds.size),
  };
}
