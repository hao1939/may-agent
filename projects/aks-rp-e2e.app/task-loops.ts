import { readFileSync } from "node:fs";
import {
  projectRuntimePaths,
  resolveTaskTreePath,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";

export const specLoopTaskId = "aks-spec-verification-loop";
export const featureCompactLoopTaskId = "aks-feature-compact-loop";
export const scenarioNormalizationTaskId = "scenario-normalization";
export const legacyBranchReconciliationTaskId = "legacy-branch-reconciliation";
export const repositorySkillMaintenanceTaskId = "repository-skill-maintenance";

export type StandingLoopId =
  | typeof specLoopTaskId
  | typeof featureCompactLoopTaskId
  | typeof scenarioNormalizationTaskId
  | typeof legacyBranchReconciliationTaskId
  | typeof repositorySkillMaintenanceTaskId;

type StandingLoopDefinition = {
  id: StandingLoopId;
  action: string;
  parentId: string;
  owner: string;
  workflow: string;
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
  "Use single-spec learning as input: compact should reuse known-good carriers and represent broken or blocked specs exactly instead of hiding them inside a larger package.",
  "Every feature-owned spec must be covered by the compact package, excluded with a source-grounded reason, or represented by an exact wait or reviewed terminal disposition.",
  "An unbound compact owner task is shared/read-only. When current evidence cites an existing source branch, commit, dispatch metadata, or task worktree, inspect and verify that exact branch/worktree in place; do not copy its delta into the shared canonical dev checkout just to review it.",
  "If review shows repository source must change, do not edit or publish from the shared canonical checkout. Rebind the same task to a task-worktree workflow such as domain-task-execution and carry forward the exact source branch/worktree evidence needed for the mutating follow-up.",
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
  "For a plain scenario carrier, completion requires current strict inventory to stop listing scenarioTestPath in both remainingSpecReferencedPlainScenarioUnits and remainingRepoPlainScenarioFiles; a sibling .test.ts wrapper that still imports the plain .ts carrier is progress, not completion.",
  "Preserve active behavior while removing a plain carrier by moving reusable code into the direct .test.ts implementation or a shared library outside features/*/tests/*.ts.",
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
    owner: "app-ops",
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
    owner: "app-ops",
    workflow: "feature-compact-loop-controller",
    frontierLimit: 3,
    outcome:
      "Keep every current feature spec set covered by one minimum-transition feature journey and schema-valid passing live proof, or by one exact wait, reviewed terminal decision, or actionable compact repair leaf.",
    acceptance: [
      "The ledger contains every current feature and its owned-spec fingerprint.",
      ...learnedCompactVerificationAcceptance,
      "Every incomplete feature has exactly one feature-loop representation.",
      "While eligible work exists, at most three actionable compact leaves are represented; waits and attention do not consume that frontier.",
    ],
    priority: "P1",
  },
  [scenarioNormalizationTaskId]: {
    id: scenarioNormalizationTaskId,
    action: "scenario-normalization",
    parentId: "group/scenario-normalization",
    owner: "aks-explorer",
    workflow: "normalize-scenario-frontier",
    frontierLimit: 5,
    outcome:
      "Drive clean current origin/dev to a passing strict scenario inventory; represent every missing adapter, spec-referenced plain scenario carrier, and repository-only plain scenario carrier by one actionable normalization leaf, exact external wait, or reviewed terminal disposition until none remain.",
    acceptance: [
      "Inventory is generated from a clean identified origin/dev revision.",
      ...learnedScenarioNormalizationAcceptance,
      "Every remaining missing adapter or plain-carrier strict-inventory row has exactly one scenario-loop representation.",
      "While eligible work exists, at most five actionable one-adapter leaves are represented; waits and attention do not consume that frontier.",
      "Outstanding normalization live-execution slots are separately capped at five total actionable or exact pipeline-backed wait holders so queued/notStarted and inProgress ADO runs cannot grow beyond the intended frontier while earlier runs drain.",
      "Completion requires strict-passed true, zero spec-referenced plain scenario units, and zero repository plain scenario files on clean current origin/dev; this is source-inventory completion, not a live product verdict.",
    ],
    priority: "P0",
  },
  [legacyBranchReconciliationTaskId]: {
    id: legacyBranchReconciliationTaskId,
    action: "legacy-branch-reconciliation",
    parentId: "group/app-operations",
    owner: "app-ops",
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
    owner: "aks-explorer",
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
      "Do not queue live pipelines, use an existing standalone build, or mutate Azure solely for skill evaluation without explicit authorization; inspection, local validation, dry runs, and queue previews are the default.",
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

export function standingLoopIntent(
  loopId: StandingLoopId,
): ProjectAppTaskIntent {
  const definition = standingLoopDefinitions[loopId];
  return {
    id: definition.id,
    parentId: definition.parentId,
    outcome: definition.outcome,
    acceptance: definition.acceptance,
    mode: "maintain",
    owner: definition.owner,
    workflow: definition.workflow,
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

type TaskProjection = {
  tasks?: Record<
    string,
    {
      input?: Record<string, unknown>;
    }
  >;
};

type TaskStateParentProjection = {
  resources?: Record<
    string,
    {
      spec?: {
        parentId?: string;
      };
    }
  >;
  receipts?: Record<
    string,
    {
      parentId?: string;
    }
  >;
};

const dedicatedLoopIdByParent = new Map<string, StandingLoopId>([
  [standingLoopDefinitions[specLoopTaskId].parentId, specLoopTaskId],
  [
    standingLoopDefinitions[featureCompactLoopTaskId].parentId,
    featureCompactLoopTaskId,
  ],
  [
    standingLoopDefinitions[scenarioNormalizationTaskId].parentId,
    scenarioNormalizationTaskId,
  ],
]);

function persistedTaskLoopId(
  appDir: string,
  taskId: string,
): StandingLoopId | undefined {
  try {
    const state = JSON.parse(
      readFileSync(projectRuntimePaths(appDir).taskStatePath, "utf8"),
    ) as TaskStateParentProjection;
    const visited = new Set<string>();
    let currentTaskId: string | undefined = taskId;
    while (currentTaskId && !visited.has(currentTaskId)) {
      visited.add(currentTaskId);
      const parentId =
        state.resources?.[currentTaskId]?.spec?.parentId ??
        state.receipts?.[currentTaskId]?.parentId;
      if (typeof parentId !== "string" || !parentId) return undefined;
      const loopId = dedicatedLoopIdByParent.get(parentId);
      if (loopId) return loopId;
      if (isStandingLoopId(parentId)) return parentId;
      currentTaskId = parentId;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function eventTaskId(event: Record<string, unknown>): string {
  const target =
    event.target &&
    typeof event.target === "object" &&
    !Array.isArray(event.target)
      ? (event.target as Record<string, unknown>)
      : {};
  const value = target.taskId ?? event.taskId ?? event.task_id;
  return typeof value === "string" ? value.trim() : "";
}

export function loopRefillWakeForTaskEvent(
  appDir: string,
  event: Record<string, unknown>,
): ProjectAppEvent | null {
  if (event.type !== "project.task.reconciled") return null;
  const taskId = eventTaskId(event);
  if (!taskId || isStandingLoopId(taskId)) return null;

  const data =
    event.data && typeof event.data === "object" && !Array.isArray(event.data)
      ? (event.data as Record<string, unknown>)
      : {};
  const eventInput =
    data.input && typeof data.input === "object" && !Array.isArray(data.input)
      ? (data.input as Record<string, unknown>)
      : undefined;
  let input = eventInput;
  if (!input) {
    try {
      const projection = JSON.parse(
        readFileSync(resolveTaskTreePath(appDir), "utf8"),
      ) as TaskProjection;
      input = projection.tasks?.[taskId]?.input;
    } catch {
      return null;
    }
  }
  const loopId = isStandingLoopId(input?.loopId)
    ? input.loopId
    : persistedTaskLoopId(appDir, taskId);
  if (!isStandingLoopId(loopId)) return null;
  const definition = standingLoopDefinitions[loopId];
  const disposition =
    typeof data.disposition === "string" ? data.disposition : undefined;

  return {
    type: "project.task.tick",
    source: "aks-rp-e2e-app",
    target: { project: "aks-rp-e2e", taskId: loopId },
    action: definition.action,
    reason: "loop-leaf-reconciled",
    data: {
      project: "aks-rp-e2e",
      taskId: loopId,
      task_id: loopId,
      sourceTaskId: taskId,
      ...(disposition ? { disposition } : {}),
    },
  };
}
