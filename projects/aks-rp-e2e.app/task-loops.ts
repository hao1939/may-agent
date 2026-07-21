import { readFileSync } from "node:fs";
import {
  resolveTaskTreePath,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";

export const specLoopTaskId = "aks-spec-verification-loop";
export const featureCompactLoopTaskId = "aks-feature-compact-loop";
export const scenarioNormalizationTaskId = "scenario-normalization";
export const legacyBranchReconciliationTaskId = "legacy-branch-reconciliation";

export type StandingLoopId =
  | typeof specLoopTaskId
  | typeof featureCompactLoopTaskId
  | typeof scenarioNormalizationTaskId
  | typeof legacyBranchReconciliationTaskId;

type StandingLoopDefinition = {
  id: StandingLoopId;
  action: string;
  parentId: string;
  owner: string;
  workflow: string;
  frontierLimit: number;
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
  "If test code, spec, model, or runner behavior changes, queue a fresh ADO live run for the exact spec on the changed branch before claiming pass.",
  "For ADO waits, return structured backend, run id, result/artifact path when known, and one exact typed wait condition; do not describe the wait only in prose.",
  "Classify ADO state precisely: queued/notStarted means exact wait; terminal with no artifacts means inspect timeline/logs; terminal with artifacts means review result.json and cleanup proof.",
  "On failure, classify from same-spec child assertions and artifacts: carrier/runtime defect, spec/model mismatch, target-environment prerequisite, product behavior, or artifact/ingestion issue. Choose the smallest next repair or rerun.",
  "Reviewer acceptance of an artifact review is not the same as a passing spec. Preserve pass, fail, error, wait, and terminal disposition as structured status in the spec-loop ledger.",
  "Do not update the ledger from stale prose or broad summaries; cite current files/artifacts and make the pass, wait, or terminal disposition visible in structured state.",
];

export const learnedCompactVerificationAcceptance = [
  "Start from the feature packet, declared spec list, current single-spec evidence, and prior compact artifacts before deciding the next move.",
  "Use single-spec learning as input: compact should reuse known-good carriers and represent broken or blocked specs exactly instead of hiding them inside a larger package.",
  "Every feature-owned spec must be covered by the compact package, excluded with a source-grounded reason, or represented by an exact wait or reviewed terminal disposition.",
  "Compact by compatible route shape, not by feature name alone: share clusters only when target environment, cluster shape, network, SKU, upgrade/destructive state, and prerequisites do not conflict.",
  "Be brave about cluster sharing: when shapes are compatible, prefer one or two real clusters for the feature; if required clusters stay high, split the package or explain each incompatible route group.",
  "If a compact plan selects many specs but still needs almost one cluster per spec, treat that as not really compacted: split by compatible route group or repair eligibility before live dispatch.",
  "The generated compact plan must show selected specs, route groups, required clusters, saved clusters, and why any large low-savings package was split or not compactable.",
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
  "Read the owning spec JSON and prove the exact probeRef/implementation path for each adapter row.",
  "Inspect same-spec branch, ADO run, artifact, and task evidence before deciding the next move.",
  "Choose exactly one next state: origin/dev absorbed/equivalent, publish/rebase/recheck, smallest same-spec repair, exact external wait with observer/resume condition, terminal disposition, or escalation.",
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
      "Keep every current feature spec set covered by one compact plan and schema-valid passing live proof, or by one exact wait, reviewed terminal decision, or actionable compact repair leaf.",
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
      "Keep clean current origin/dev free of missing direct scenario-test adapters; represent every missing adapter by one actionable normalization/publication leaf, exact publication wait, or reviewed terminal exception.",
    acceptance: [
      "Inventory is generated from a clean identified origin/dev revision.",
      ...learnedScenarioNormalizationAcceptance,
      "Every missing adapterPath has exactly one scenario-loop representation.",
      "While eligible work exists, at most five actionable one-adapter leaves are represented; waits and attention do not consume that frontier.",
      "Zero missing adapters means inventory completion, not a live product verdict.",
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
    input: { frontierLimit: definition.frontierLimit },
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

  const eventInput =
    event.input &&
    typeof event.input === "object" &&
    !Array.isArray(event.input)
      ? (event.input as Record<string, unknown>)
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
  const loopId = input?.loopId;
  if (!isStandingLoopId(loopId)) return null;
  const definition = standingLoopDefinitions[loopId];
  const disposition =
    typeof event.disposition === "string" ? event.disposition : undefined;

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
