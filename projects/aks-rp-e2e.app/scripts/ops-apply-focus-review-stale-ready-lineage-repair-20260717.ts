import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type ArchivedTaskLookup = {
  archiveFile: string;
  task: JsonRecord;
};

type Snapshot = {
  checkedAt: string;
  frontier: {
    active: string[];
    review: string[];
    waiting: string[];
    runnable: string[];
    blocked: string[];
  };
  focusTask: JsonRecord;
  projectFocusProposal: JsonRecord;
  runtimeCurrentFocus: JsonRecord;
  runtimeFocusMission: JsonRecord;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const checkedAt = new Date().toISOString();
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops_apply-focus-review-stale-ready-lineage-repair-20260717_manual";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const projectTaskId = "project";
const focusTaskId = "focus-same-spec-verification-fix-forward-followthrough-20260715";
const repairTaskId = "ops/apply-focus-review-stale-ready-lineage-repair-20260717";
const evidencePath =
  "evidence/archive/ops-apply-focus-review-stale-ready-lineage-repair-20260717.md";
const evidenceAbsPath = resolve(appDir, evidencePath);

const staleReadySubsetIds = [
  "domain/queue-egress-lockdown-vhd-ready-subset-20260717",
  "domain/queue-managementplane-addon-addonv2-ready-subset-20260717",
  "domain/queue-network-isolated-outbound-none-ready-subset-20260717",
] as const;

const currentLiveWaitCandidates = [
  "wait-cluster-autoscaler-vm-prerelease-profile-matrix-ado-run-172674993-result",
  "wait-network-cni-cilium-enterprise-addon-vm-prerelease-ado-run-172675000-result",
  "wait-net-integration-nsg-route-table-in-use-vm-prerelease-ado-run-172672040-result",
  "wait-network-isolated-managed-acr-outbound-none-vm-prerelease-ado-run-172675474-result",
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
  "wait-spec-open-service-mesh-addon-westus2-network-ownership-throttling-return-20260704",
] as const;

const managementplaneArchivedId =
  "domain/inspect-managementplane-addon-addonv2-run-172675593-terminal-result-20260717";
const policyArchivedId =
  "domain/sync-policy-addon-basic-pubsub-ready-frontier-carrier-20260717";
const egressRepairArchivedId =
  "domain/repair-egress-lockdown-vhd-live-carrier-gap-20260717";
const egressWaitArchivedId =
  "wait-egress-lockdown-vm-prerelease-vhd-matrix-ado-run-172682750-result";

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function findArchivedTask(taskId: string): ArchivedTaskLookup | null {
  const archiveDir = resolve(appDir, ".state/tasks/archive");
  const files = readdirSync(archiveDir)
    .filter((name) => name.startsWith("done-leaves-") && name.endsWith(".json"))
    .sort()
    .reverse();

  for (const file of files) {
    const archive = JSON.parse(readFileSync(resolve(archiveDir, file), "utf8")) as JsonRecord;
    const tasks = Array.isArray(archive.tasks) ? archive.tasks : [];
    for (const task of tasks) {
      const record = asRecord(task);
      if (record.id === taskId) {
        return {
          archiveFile: `.state/tasks/archive/${file}`,
          task: record,
        };
      }
    }
  }

  return null;
}

function taskState(task: JsonRecord | undefined): string {
  if (!task) return "missing";
  return String(task.state ?? task.status ?? "unknown");
}

function captureSnapshot(): Snapshot {
  const summary = summarizeTaskTree(config);
  const runtime = asRecord(loadProjectReadModel(appDir));
  const runtimeCurrentFocus = asRecord(runtime.currentFocus);
  const runtimeFocusMission = asRecord(runtimeCurrentFocus.focusMission);

  let snapshot: Snapshot | null = null;
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    const focusTask = tree.tasks[focusTaskId];
    assert(projectTask, `Task not found: ${projectTaskId}`);
    assert(focusTask, `Task not found: ${focusTaskId}`);
    const projectContext = asRecord(projectTask.context);

    snapshot = {
      checkedAt,
      frontier: {
        active: [...summary.frontier.active],
        review: [...summary.frontier.review],
        waiting: [...summary.frontier.waiting],
        runnable: [...summary.frontier.runnable],
        blocked: [...summary.frontier.blocked],
      },
      focusTask: cloneJson(focusTask),
      projectFocusProposal: cloneJson(projectContext.current_focus_proposal),
      runtimeCurrentFocus: cloneJson(runtimeCurrentFocus),
      runtimeFocusMission: cloneJson(runtimeFocusMission),
    };
  });

  assert(snapshot, "Failed to capture snapshot");
  return snapshot;
}

const before = captureSnapshot();

const archivedManagementplane = findArchivedTask(managementplaneArchivedId);
const archivedPolicy = findArchivedTask(policyArchivedId);
const archivedEgressRepair = findArchivedTask(egressRepairArchivedId);
const archivedEgressWait = findArchivedTask(egressWaitArchivedId);

assert(archivedManagementplane, `Archived task not found: ${managementplaneArchivedId}`);
assert(archivedPolicy, `Archived task not found: ${policyArchivedId}`);
assert(archivedEgressRepair, `Archived task not found: ${egressRepairArchivedId}`);
assert(archivedEgressWait, `Archived task not found: ${egressWaitArchivedId}`);

const liveSummary = summarizeTaskTree(config);
const liveBlockedSet = new Set(liveSummary.frontier.blocked);
const currentLiveWaitIds = currentLiveWaitCandidates.filter((id) => liveBlockedSet.has(id));
assert(
  currentLiveWaitIds.length === currentLiveWaitCandidates.length,
  `Expected all current live wait ids to remain blocked. Found ${currentLiveWaitIds.length}/${currentLiveWaitCandidates.length}`,
);
assert(
  !liveSummary.frontier.active.some((id) => staleReadySubsetIds.includes(id as (typeof staleReadySubsetIds)[number])),
  "A stale ready-subset id is still on the live active frontier",
);

const staleIdSentence = `[${staleReadySubsetIds.join(", ")}]`;
const currentLiveWaitSentence = `[${currentLiveWaitIds.join(", ")}]`;
const managementplaneNote = `${managementplaneArchivedId} archived in ${archivedManagementplane.archiveFile} with result ${JSON.stringify(archivedManagementplane.task.result ?? null)}.`;
const policyNote = `${policyArchivedId} archived in ${archivedPolicy.archiveFile} with result ${JSON.stringify(archivedPolicy.task.result ?? null)}.`;
const egressWaitTrace = asRecord(archivedEgressWait.task.trace);
const egressNoCurrentHolderNote = `No current live holder remains for egress-lockdown: ${egressRepairArchivedId} archived in ${archivedEgressRepair.archiveFile}, and ${egressWaitArchivedId} archived in ${archivedEgressWait.archiveFile} after stale close at ${JSON.stringify(egressWaitTrace.stale_wait_closed_at ?? null)} with reason ${JSON.stringify(egressWaitTrace.stale_wait_closed_reason ?? archivedEgressWait.task.result ?? null)}.`;
const readyPathResolutionNotes = [
  `Current live same-lineage wait for network-isolated is ${currentLiveWaitIds.find((id) => id.includes("network-isolated"))}.`,
  managementplaneNote,
  policyNote,
  egressNoCurrentHolderNote,
];

const repairedCarrierSentence = `The focus review records current ready-path carrier truth without retired ready-subset queue ids: live waits are ${currentLiveWaitSentence}; managementplane now resolves through archived same-lineage result ${managementplaneArchivedId}; policy-addon now resolves through archived same-lineage sync carrier ${policyArchivedId}; and ${egressNoCurrentHolderNote} Retired ids ${staleIdSentence} are not represented as current active ready-subset leaves or current ready-path carriers.`;
const repairedLearnedSentence = `Current live waits are ${currentLiveWaitSentence}. Archived same-lineage replacements are ${managementplaneArchivedId} and ${policyArchivedId}; ${egressNoCurrentHolderNote} Retired ids ${staleIdSentence} are absent from the live frontier and removed from current focus carrier arrays.`;
const repairReasonSentence = `Ready-path stale queue-carrier claims were reconciled at apply time: live waits are ${currentLiveWaitSentence}; managementplane/policy now rely on archived same-lineage result notes (${managementplaneArchivedId}, ${policyArchivedId}); and egress-lockdown has no current live holder because ${egressWaitArchivedId} closed stale after pass sync.`;
const repairSummarySentence = `Ready-path stale queue-carrier claims are now repaired against the live frontier. Current live waits are ${currentLiveWaitSentence}; managementplane/policy carrier truth now points to archived same-lineage result notes, and egress-lockdown has no current live holder because the follow-on wait closed stale after pass sync.`;

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  const focusTask = tree.tasks[focusTaskId];
  assert(projectTask, `Task not found: ${projectTaskId}`);
  assert(focusTask, `Task not found: ${focusTaskId}`);

  const focusAcceptance = [...asStringArray(focusTask.acceptance)];
  focusAcceptance[1] = repairedCarrierSentence;
  focusTask.acceptance = focusAcceptance;
  focusTask.outputs = unique([...asStringArray(focusTask.outputs), evidencePath]);
  focusTask.updated_at = checkedAt;

  const focusContext = asRecord(focusTask.context);
  const successCriteria = [...asStringArray(focusContext.success_criteria)];
  successCriteria[1] = repairedCarrierSentence;
  focusContext.success_criteria = successCriteria;
  focusContext.ready_subset_active_leaf_ids = [];
  focusContext.exact_wait_ready_path_ids = [...currentLiveWaitIds];
  focusContext.ready_path_resolution_notes = [...readyPathResolutionNotes];
  focusContext.observations = {
    ...asRecord(focusContext.observations),
    structural_status:
      "Focus metadata now follows live root-frontier truth and current ready-path carrier truth; retired ready-subset queue ids were removed from current carrier arrays.",
  };

  const focusLaneLinks = asRecord(focusContext.lane_links);
  focusLaneLinks.replay_implementation = [];
  focusLaneLinks.execution_verification = [...currentLiveWaitIds];
  focusContext.lane_links = focusLaneLinks;

  const progressReview = asRecord(focusContext.progress_review);
  progressReview.last_reviewed_at = checkedAt;
  progressReview.status = "updated";
  progressReview.summary = repairSummarySentence;
  progressReview.evidence = unique([
    ...asStringArray(progressReview.evidence),
    `Repair evidence: ${evidencePath}`,
  ]);
  const progressAnswers = asRecord(progressReview.answers);
  const learned = [...asStringArray(progressAnswers.learned_or_verified)];
  learned[1] = repairedLearnedSentence;
  progressAnswers.learned_or_verified = learned;
  progressAnswers.blocker_mix =
    "Live ready-path wait carriers remain the concrete blocked work; stale queue-carrier bookkeeping was removed from current focus metadata without reopening execution.";
  progressAnswers.goal_alignment =
    "Removing retired ready-subset queue ids keeps current focus carrier truth aligned with the live frontier and same-lineage result evidence.";
  progressReview.answers = progressAnswers;
  focusContext.progress_review = progressReview;
  focusTask.context = focusContext;
  focusTask.trace = {
    ...asRecord(focusTask.trace),
    ready_path_queue_wait_followthrough_refreshed_at: checkedAt,
    ready_path_queue_wait_followthrough_refreshed_by: worker,
    ready_path_queue_wait_followthrough_evidence_path: evidencePath,
    stale_ready_lineage_repaired_at: checkedAt,
    stale_ready_lineage_repaired_by: worker,
    stale_ready_lineage_repair_attempt_id: attemptId,
    stale_ready_lineage_repair_evidence_path: evidencePath,
  };

  const projectContext = asRecord(projectTask.context);
  const proposal = asRecord(projectContext.current_focus_proposal);
  proposal.reviewed_at = checkedAt;
  proposal.reason = `${String(proposal.reason ?? "").trim()} ${repairReasonSentence}`.trim();
  proposal.evidence_path = evidencePath;

  const proposalContext = asRecord(proposal.context);
  const proposalSuccessCriteria = [...asStringArray(proposalContext.success_criteria)];
  proposalSuccessCriteria[1] = repairedCarrierSentence;
  proposalContext.success_criteria = proposalSuccessCriteria;
  proposalContext.ready_path_resolution_notes = [...readyPathResolutionNotes];

  const proposalLaneLinks = asRecord(proposalContext.lane_links);
  proposalLaneLinks.replay_implementation = [];
  proposalLaneLinks.execution_verification = [...currentLiveWaitIds];
  proposalContext.lane_links = proposalLaneLinks;

  const proposalProgressReview = asRecord(proposalContext.progress_review);
  proposalProgressReview.reviewed_at = checkedAt;
  proposalProgressReview.result = "updated";
  proposalProgressReview.evidence_path = evidencePath;
  const proposalAnswers = asRecord(proposalProgressReview.answers);
  const proposalLearned = [...asStringArray(proposalAnswers.learned_or_verified)];
  proposalLearned[1] = repairedLearnedSentence;
  proposalAnswers.learned_or_verified = proposalLearned;
  proposalAnswers.blocker_mix =
    "The focus packet now keeps only live waits in current carrier arrays; archived same-lineage managementplane/policy notes and egress no-current-holder proof stay textual.";
  proposalAnswers.goal_alignment =
    "Planner-visible focus metadata is now truthful about which ready-path carriers are live waits versus archived same-lineage evidence.";
  proposalProgressReview.answers = proposalAnswers;
  proposalContext.progress_review = proposalProgressReview;
  proposal.context = proposalContext;

  projectContext.current_focus_proposal = proposal;
  projectContext.current_focus_proposal_progress_review_refreshed_at = checkedAt;
  projectContext.current_focus_proposal_progress_review_refreshed_by = worker;
  projectContext.current_focus_proposal_progress_review_evidence_path = evidencePath;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...asStringArray(projectTask.outputs), evidencePath]);
  projectTask.updated_at = checkedAt;
  projectTask.trace = {
    ...asRecord(projectTask.trace),
    current_focus_proposal_progress_review_refreshed_at: checkedAt,
    current_focus_proposal_progress_review_refreshed_by: worker,
    current_focus_proposal_progress_review_evidence_path: evidencePath,
    stale_ready_lineage_repaired_at: checkedAt,
    stale_ready_lineage_repaired_by: worker,
    stale_ready_lineage_repair_attempt_id: attemptId,
    stale_ready_lineage_repair_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

syncProjectReadout(config, checkedAt);

const runtime = asRecord(loadProjectReadModel(appDir));
const currentFocus = asRecord(runtime.currentFocus);
const currentFocusReview = asRecord(currentFocus.focusReview);
const currentFocusMission = asRecord(currentFocus.focusMission);
const focusPlan = asRecord(runtime.focusPlan);

currentFocusReview.reviewedAt = checkedAt;
currentFocusReview.result = "updated";
currentFocusReview.note = repairReasonSentence;
currentFocusReview.evidencePath = evidencePath;
currentFocus.focusReview = currentFocusReview;

currentFocusMission.successCriteria = [
  ...(asStringArray(currentFocusMission.successCriteria).length > 0
    ? asStringArray(currentFocusMission.successCriteria)
    : asStringArray(asRecord(readTaskTree(config).tasks[focusTaskId]?.context).success_criteria)),
];
const missionSuccessCriteria = [...asStringArray(currentFocusMission.successCriteria)];
missionSuccessCriteria[1] = repairedCarrierSentence;
currentFocusMission.successCriteria = missionSuccessCriteria;
currentFocusMission.evidencePath = evidencePath;
currentFocusMission.readyPathResolutionNotes = [...readyPathResolutionNotes];
currentFocus.focusMission = currentFocusMission;

focusPlan.evidencePath = evidencePath;

saveProjectRuntimeState(appDir, {
  currentState: asRecord(runtime.currentState),
  currentFocus,
  focusPlan,
  updatedAt: checkedAt,
});

const after = captureSnapshot();

function extractFocusSurface(snapshot: Snapshot): {
  acceptance1: string | null;
  success1: string | null;
  learned1: string | null;
  replayImplementation: string[];
  executionVerification: string[];
  readySubsetActiveLeafIds: string[];
  exactWaitReadyPathIds: string[];
  proposalSuccess1: string | null;
  proposalLearned1: string | null;
  proposalReplayImplementation: string[];
  proposalExecutionVerification: string[];
  runtimeMissionSuccess1: string | null;
} {
  const focusTask = asRecord(snapshot.focusTask);
  const focusContext = asRecord(focusTask.context);
  const focusProgressReview = asRecord(focusContext.progress_review);
  const focusAnswers = asRecord(focusProgressReview.answers);
  const focusLaneLinks = asRecord(focusContext.lane_links);

  const proposal = asRecord(snapshot.projectFocusProposal);
  const proposalContext = asRecord(proposal.context);
  const proposalProgressReview = asRecord(proposalContext.progress_review);
  const proposalAnswers = asRecord(proposalProgressReview.answers);
  const proposalLaneLinks = asRecord(proposalContext.lane_links);

  const runtimeMission = asRecord(snapshot.runtimeFocusMission);

  return {
    acceptance1: asStringArray(focusTask.acceptance)[1] ?? null,
    success1: asStringArray(focusContext.success_criteria)[1] ?? null,
    learned1: asStringArray(focusAnswers.learned_or_verified)[1] ?? null,
    replayImplementation: asStringArray(focusLaneLinks.replay_implementation),
    executionVerification: asStringArray(focusLaneLinks.execution_verification),
    readySubsetActiveLeafIds: asStringArray(focusContext.ready_subset_active_leaf_ids),
    exactWaitReadyPathIds: asStringArray(focusContext.exact_wait_ready_path_ids),
    proposalSuccess1: asStringArray(proposalContext.success_criteria)[1] ?? null,
    proposalLearned1: asStringArray(proposalAnswers.learned_or_verified)[1] ?? null,
    proposalReplayImplementation: asStringArray(proposalLaneLinks.replay_implementation),
    proposalExecutionVerification: asStringArray(proposalLaneLinks.execution_verification),
    runtimeMissionSuccess1: asStringArray(runtimeMission.successCriteria)[1] ?? null,
  };
}

const afterSurface = extractFocusSurface(after);
assert.deepEqual(afterSurface.replayImplementation, [], "Focus replay_implementation should be empty after repair");
assert.deepEqual(afterSurface.proposalReplayImplementation, [], "Proposal replay_implementation should be empty after repair");
assert.deepEqual(afterSurface.readySubsetActiveLeafIds, [], "ready_subset_active_leaf_ids should be empty after repair");
assert.deepEqual(
  afterSurface.executionVerification,
  [...currentLiveWaitIds],
  "Focus execution_verification should contain only current live waits",
);
assert.deepEqual(
  afterSurface.proposalExecutionVerification,
  [...currentLiveWaitIds],
  "Proposal execution_verification should contain only current live waits",
);
assert.deepEqual(
  afterSurface.exactWaitReadyPathIds,
  [...currentLiveWaitIds],
  "exact_wait_ready_path_ids should contain only current live waits",
);

const beforeSurface = extractFocusSurface(before);
const memo = `# App apply — focus review stale ready-lineage repair — 2026-07-17

- Attempt: \`${attemptId}\`
- Applied at: \`${checkedAt}\`
- Task: \`${repairTaskId}\`

## Scope

Repair the current focus holder metadata/text so it no longer names retired ready-subset queue ids as current ready-path carriers. This apply step refreshed the focus task, project current-focus proposal, and mirrored runtime focus mission only; it did not emit events or change task states/review decisions.

## Fresh live frontier at apply time

- active: ${JSON.stringify(before.frontier.active)}
- review: ${JSON.stringify(before.frontier.review)}
- waiting: ${JSON.stringify(before.frontier.waiting)}
- runnable: ${JSON.stringify(before.frontier.runnable)}
- blocked (relevant current waits): ${JSON.stringify(currentLiveWaitIds)}

## Fresh task-tree show / archive-equivalent inspection at apply time

- \`${staleReadySubsetIds[0]}\`: not present in live frontier; archived repair evidence shows no current live holder remains.
- \`${staleReadySubsetIds[1]}\`: live \`task-tree show\` equivalent is now not-found; archived successor inspection task is ${managementplaneNote}
- \`${staleReadySubsetIds[2]}\`: current live replacement wait is \`${currentLiveWaitIds.find((id) => id.includes("network-isolated"))}\` in blocked state.
- Policy same-lineage archived replacement: ${policyNote}
- Egress same-lineage no-current-holder proof: ${egressNoCurrentHolderNote}

## Before-state focus fields inspected

### Focus task \`${focusTaskId}\`

- \`acceptance[1]\`: ${JSON.stringify(beforeSurface.acceptance1)}
- \`context.success_criteria[1]\`: ${JSON.stringify(beforeSurface.success1)}
- \`context.progress_review.answers.learned_or_verified[1]\`: ${JSON.stringify(beforeSurface.learned1)}
- \`context.lane_links.replay_implementation\`: ${JSON.stringify(beforeSurface.replayImplementation)}
- \`context.lane_links.execution_verification\`: ${JSON.stringify(beforeSurface.executionVerification)}
- \`context.ready_subset_active_leaf_ids\`: ${JSON.stringify(beforeSurface.readySubsetActiveLeafIds)}
- \`context.exact_wait_ready_path_ids\`: ${JSON.stringify(beforeSurface.exactWaitReadyPathIds)}

### \`project.context.current_focus_proposal\`

- \`context.success_criteria[1]\`: ${JSON.stringify(beforeSurface.proposalSuccess1)}
- \`context.progress_review.answers.learned_or_verified[1]\`: ${JSON.stringify(beforeSurface.proposalLearned1)}
- \`context.lane_links.replay_implementation\`: ${JSON.stringify(beforeSurface.proposalReplayImplementation)}
- \`context.lane_links.execution_verification\`: ${JSON.stringify(beforeSurface.proposalExecutionVerification)}

### Runtime \`currentFocus.focusMission\`

- \`successCriteria[1]\`: ${JSON.stringify(beforeSurface.runtimeMissionSuccess1)}

## After-state focus fields inspected

### Focus task \`${focusTaskId}\`

- \`acceptance[1]\`: ${JSON.stringify(afterSurface.acceptance1)}
- \`context.success_criteria[1]\`: ${JSON.stringify(afterSurface.success1)}
- \`context.progress_review.answers.learned_or_verified[1]\`: ${JSON.stringify(afterSurface.learned1)}
- \`context.lane_links.replay_implementation\`: ${JSON.stringify(afterSurface.replayImplementation)}
- \`context.lane_links.execution_verification\`: ${JSON.stringify(afterSurface.executionVerification)}
- \`context.ready_subset_active_leaf_ids\`: ${JSON.stringify(afterSurface.readySubsetActiveLeafIds)}
- \`context.exact_wait_ready_path_ids\`: ${JSON.stringify(afterSurface.exactWaitReadyPathIds)}

### \`project.context.current_focus_proposal\`

- \`context.success_criteria[1]\`: ${JSON.stringify(afterSurface.proposalSuccess1)}
- \`context.progress_review.answers.learned_or_verified[1]\`: ${JSON.stringify(afterSurface.proposalLearned1)}
- \`context.lane_links.replay_implementation\`: ${JSON.stringify(afterSurface.proposalReplayImplementation)}
- \`context.lane_links.execution_verification\`: ${JSON.stringify(afterSurface.proposalExecutionVerification)}

### Runtime \`currentFocus.focusMission\`

- \`successCriteria[1]\`: ${JSON.stringify(afterSurface.runtimeMissionSuccess1)}

## Verification verdict

- Retired ids ${staleIdSentence} are absent from the repaired focus carrier fields above.
- Focus \`replay_implementation\` and \`ready_subset_active_leaf_ids\` are now empty because no current active ready-subset leaves remain on the live frontier.
- Focus/proposal \`execution_verification\` and focus \`exact_wait_ready_path_ids\` now contain only current live waits ${currentLiveWaitSentence}.
- Managementplane and policy replacement truth is carried as archived same-lineage notes, not as fake live leaves.
- Egress-lockdown explicitly records that no current live holder remains because the follow-on wait closed stale after pass sync.
`;

mkdirSync(dirname(evidenceAbsPath), { recursive: true });
writeFileSync(evidenceAbsPath, memo, "utf8");

console.log(
  JSON.stringify(
    {
      checkedAt,
      attemptId,
      evidencePath,
      currentLiveWaitIds,
      readyPathResolutionNotes,
      afterSurface,
    },
    null,
    2,
  ),
);
