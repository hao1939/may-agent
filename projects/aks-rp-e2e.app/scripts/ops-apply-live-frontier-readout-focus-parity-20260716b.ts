import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type FrontierSnapshot = {
  activeAll: string[];
  activeExcludingSelf: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blockedLeafCount: number;
};

type DirtyOwner = {
  path: string;
  taskId: string;
  state: string;
  rationale: string;
};

type Comparison = {
  live: FrontierSnapshot;
  projectRootReadout: JsonRecord;
  projectFocusProposal: JsonRecord;
  runtimeFocusMission: JsonRecord;
  runtimeCurrentFocus: JsonRecord;
  mismatches: string[];
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const repairTaskId = "ops/reconcile-live-frontier-readout-focus-parity-20260716b";
const evidencePath =
  "evidence/archive/ops-reconcile-live-frontier-readout-focus-parity-20260716b.md";
const evidenceAbsPath = resolve(appDir, evidencePath);
const appliedAt = new Date().toISOString();

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim())
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value && value.trim().length > 0))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function nodeState(task: TaskNode | undefined): string {
  return String(task?.status ?? task?.state ?? "backlog");
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function runJsonCommand(args: string[]): unknown {
  const result = spawnSync("bun", args, {
    cwd: appDir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: bun ${args.join(" ")}\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  return JSON.parse(result.stdout);
}

function liveFrontierFromSummary(): FrontierSnapshot {
  const summary = summarizeTaskTree(config);
  const activeAll = asStringArray(summary.frontier.active).sort((a, b) => a.localeCompare(b));
  return {
    activeAll,
    activeExcludingSelf: activeAll.filter((id) => id !== repairTaskId),
    review: asStringArray(summary.frontier.review).sort((a, b) => a.localeCompare(b)),
    waiting: asStringArray(summary.frontier.waiting).sort((a, b) => a.localeCompare(b)),
    runnable: asStringArray(summary.frontier.runnable).sort((a, b) => a.localeCompare(b)),
    blockedLeafCount: Number(summary.counts.blocked ?? asStringArray(summary.frontier.blocked).length),
  };
}

function projectTaskFromShowCommand(): JsonRecord {
  return asRecord(runJsonCommand(["run", "task-tree", "show", "project"]));
}

function runtimeStateFile(): JsonRecord {
  return JSON.parse(readFileSync(resolve(appDir, ".state/project-state.json"), "utf8")) as JsonRecord;
}

function mismatchLines(label: string, expected: string[], actual: string[]): string[] {
  const expectedNorm = [...expected].sort((a, b) => a.localeCompare(b));
  const actualNorm = [...actual].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(expectedNorm) === JSON.stringify(actualNorm)) return [];
  return [
    `${label}: expected [${formatList(expectedNorm)}] but found [${formatList(actualNorm)}]`,
  ];
}

function compareCurrentState(): Comparison {
  const live = liveFrontierFromSummary();
  const showProject = projectTaskFromShowCommand();
  const projectContext = asRecord(showProject.context);
  const projectRootReadout = asRecord(projectContext.current_root_readout);
  const projectFocusProposal = asRecord(projectContext.current_focus_proposal);
  const proposalContext = asRecord(projectFocusProposal.context);
  const runtime = runtimeStateFile();
  const runtimeCurrentFocus = asRecord(runtime.currentFocus);
  const runtimeFocusMission = asRecord(runtimeCurrentFocus.focusMission);

  const mismatches = [
    ...mismatchLines(
      "project.context.current_root_readout.active_task_ids_excluding_self",
      live.activeExcludingSelf,
      asStringArray(projectRootReadout.active_task_ids_excluding_self),
    ),
    ...mismatchLines(
      "project.context.current_root_readout.review_task_ids",
      live.review,
      asStringArray(projectRootReadout.review_task_ids),
    ),
    ...mismatchLines(
      "project.context.current_root_readout.waiting_task_ids",
      live.waiting,
      asStringArray(projectRootReadout.waiting_task_ids),
    ),
    ...mismatchLines(
      "project.context.current_root_readout.runnable_task_ids",
      live.runnable,
      asStringArray(projectRootReadout.runnable_task_ids),
    ),
    ...mismatchLines(
      "project.context.current_focus_proposal.context.active_task_ids",
      live.activeExcludingSelf,
      asStringArray(proposalContext.active_task_ids),
    ),
    ...mismatchLines(
      "project.context.current_focus_proposal.context.review_task_ids",
      live.review,
      asStringArray(proposalContext.review_task_ids),
    ),
    ...mismatchLines(
      "project.context.current_focus_proposal.context.waiting_task_ids",
      live.waiting,
      asStringArray(proposalContext.waiting_task_ids),
    ),
    ...mismatchLines(
      "project.context.current_focus_proposal.context.runnable_task_ids",
      live.runnable,
      asStringArray(proposalContext.runnable_task_ids),
    ),
    ...mismatchLines(
      "runtime currentFocus.activeTaskIds",
      live.activeExcludingSelf,
      asStringArray(runtimeCurrentFocus.activeTaskIds),
    ),
    ...mismatchLines(
      "runtime currentFocus.focusMission.reviewTaskIds",
      live.review,
      asStringArray(runtimeFocusMission.reviewTaskIds),
    ),
    ...mismatchLines(
      "runtime currentFocus.focusMission.waitingTaskIds",
      live.waiting,
      asStringArray(runtimeFocusMission.waitingTaskIds),
    ),
    ...mismatchLines(
      "runtime currentFocus.focusMission.runnableTaskIds",
      live.runnable,
      asStringArray(runtimeFocusMission.runnableTaskIds),
    ),
  ];

  return {
    live,
    projectRootReadout,
    projectFocusProposal,
    runtimeFocusMission,
    runtimeCurrentFocus,
    mismatches,
  };
}

function isTopLevelBlockedWaitTask(taskId: string): boolean {
  return /(^ops\/wait-|^wait-)/.test(taskId);
}

function publicationSentence(rootReadout: JsonRecord, tree: ReturnType<typeof readTaskTree>): string {
  const acceptedPublicationLeafId =
    typeof rootReadout.accepted_publication_leaf_id === "string"
      ? rootReadout.accepted_publication_leaf_id.trim()
      : "";
  if (!acceptedPublicationLeafId) {
    return `Project root contract remains scoped to ${String(rootReadout.contract_scope ?? "live frontier parity snapshot")}.`;
  }
  if (tree.tasks[acceptedPublicationLeafId]) {
    return `${acceptedPublicationLeafId} is still live in the task tree and must remain represented by the root contract.`;
  }
  const archivedAt =
    typeof rootReadout.accepted_publication_leaf_archived_at === "string" &&
    rootReadout.accepted_publication_leaf_archived_at.trim().length > 0
      ? ` at ${String(rootReadout.accepted_publication_leaf_archived_at)}`
      : "";
  const archiveFile =
    typeof rootReadout.accepted_publication_leaf_archive_file === "string" &&
    rootReadout.accepted_publication_leaf_archive_file.trim().length > 0
      ? ` in ${String(rootReadout.accepted_publication_leaf_archive_file)}`
      : "";
  return `${acceptedPublicationLeafId} is archived done and absent from the live task map${archivedAt}${archiveFile}.`;
}

function blockedLineageSentence(blockedLineageIds: string[], topLevelBlockedIds: string[]): string {
  const blockedLineage = formatList(blockedLineageIds);
  const topLevelBlocked = formatList(topLevelBlockedIds);
  if (
    blockedLineageIds.length === topLevelBlockedIds.length &&
    blockedLineageIds.every((id, index) => id === topLevelBlockedIds[index])
  ) {
    return `Exact top-level blocked steward waits remain ${topLevelBlocked}.`;
  }
  return `Preserved blocked carrier lineage remains ${blockedLineage}. Exact top-level blocked steward waits remain ${topLevelBlocked}.`;
}

function buildFrontierVector(frontier: FrontierSnapshot): string {
  return `active=[${formatList(frontier.activeExcludingSelf)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}`;
}

function dirtyOwners(tree: ReturnType<typeof readTaskTree>): DirtyOwner[] {
  const status = spawnSync("git", ["-C", projectDir, "status", "--short", "--untracked-files=all"], {
    encoding: "utf8",
    env: process.env,
  });
  if (status.status !== 0) {
    throw new Error(`git status failed\n${status.stdout ?? ""}${status.stderr ?? ""}`);
  }
  const files = status.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => line.slice(3).trim())
    .sort((a, b) => a.localeCompare(b));

  return files.map((file) => {
    if (file === "features/egress-lockdown.yaml" || file.startsWith("features/egress-lockdown/")) {
      const taskId = "verify-spec-egress-lockdown-windows-baseline-retry-202607160456-1";
      return {
        path: file,
        taskId,
        state: nodeState(tree.tasks[taskId]),
        rationale:
          "The dirty file belongs to the exact live Windows egress-lockdown spec slice: spec-loop state binds spec.egress-lockdown.windows-baseline to this active task, and the dirty surfaces are the feature/spec/test files for that spec.",
      };
    }
    if (
      file === "package.json" ||
      file === "runner/README.md" ||
      file === "runner/ci/queue-ado-spec-batch.ts"
    ) {
      const taskId = "domain/normalize-scenario-net-integration-five-spec-batch-20260716";
      return {
        path: file,
        taskId,
        state: nodeState(tree.tasks[taskId]),
        rationale:
          "The dirty file is the batched Azure DevOps runner/helper surface used to prove one five-spec normalization batch with exactly one run, which matches this active task's exact goal.",
      };
    }
    return {
      path: file,
      taskId: "UNMAPPED",
      state: "unknown",
      rationale: "No exact live owner rule matched this dirty path.",
    };
  });
}

const before = compareCurrentState();
const summaryAtApply = summarizeTaskTree(config);
const frontierAtApply: FrontierSnapshot = {
  activeAll: asStringArray(summaryAtApply.frontier.active).sort((a, b) => a.localeCompare(b)),
  activeExcludingSelf: asStringArray(summaryAtApply.frontier.active)
    .sort((a, b) => a.localeCompare(b))
    .filter((id) => id !== repairTaskId),
  review: asStringArray(summaryAtApply.frontier.review).sort((a, b) => a.localeCompare(b)),
  waiting: asStringArray(summaryAtApply.frontier.waiting).sort((a, b) => a.localeCompare(b)),
  runnable: asStringArray(summaryAtApply.frontier.runnable).sort((a, b) => a.localeCompare(b)),
  blockedLeafCount: Number(
    summaryAtApply.counts.blocked ?? asStringArray(summaryAtApply.frontier.blocked).length,
  ),
};
const mutated = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks.project;
  const repairTask = tree.tasks[repairTaskId];
  if (!projectTask) throw new Error("Task not found: project");
  if (!repairTask) throw new Error(`Task not found: ${repairTaskId}`);

  const summary = summaryAtApply;
  const frontier: FrontierSnapshot = frontierAtApply;

  const projectContext = asRecord(projectTask.context);
  const currentRootReadout = asRecord(projectContext.current_root_readout);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const proposalContext = asRecord(currentFocusProposal.context);
  const projectChildren = Array.isArray(projectTask.children)
    ? projectTask.children.filter(
        (child): child is string => typeof child === "string" && child.trim().length > 0,
      )
    : [];
  const topLevelBlockedIds = projectChildren
    .filter((id) => isTopLevelBlockedWaitTask(id) && nodeState(tree.tasks[id]) === "blocked")
    .sort((a, b) => a.localeCompare(b));
  const blockedLineageIds = unique([
    ...asStringArray(proposalContext.blocked_task_ids),
    ...asStringArray(proposalContext.linked_blocked_task_ids),
    ...asStringArray(currentRootReadout.top_level_blocked_ids),
    ...topLevelBlockedIds,
  ]).filter((id) => nodeState(tree.tasks[id]) === "blocked");
  const scope =
    typeof currentRootReadout.contract_scope === "string" && currentRootReadout.contract_scope.trim().length > 0
      ? currentRootReadout.contract_scope.trim()
      : "live frontier parity snapshot";
  const publication = publicationSentence(currentRootReadout, tree);
  const blockedSentence = blockedLineageSentence(blockedLineageIds, topLevelBlockedIds);
  const frontierVector = buildFrontierVector(frontier);
  const proposalId =
    typeof currentFocusProposal.id === "string" && currentFocusProposal.id.trim().length > 0
      ? currentFocusProposal.id.trim()
      : "focus-same-spec-verification-fix-forward-followthrough-20260715";
  const proposalTitle =
    typeof currentFocusProposal.title === "string" && currentFocusProposal.title.trim().length > 0
      ? currentFocusProposal.title.trim()
      : "live root-frontier follow-through with exact blocked carriers";
  const proposedTaskIds = unique([
    ...frontier.activeExcludingSelf,
    ...frontier.review,
    ...frontier.waiting,
    ...frontier.runnable,
    ...blockedLineageIds,
  ]);

  const owners = dirtyOwners(tree);
  const ownerSummary = owners.map((owner) => `${owner.path} -> ${owner.taskId}`).join("; ");
  const proposalReason =
    `Current live root frontier excluding ${repairTaskId} is ${frontierVector}. ` +
    `${publication} ${blockedSentence} Dirty domain repo ownership is recorded at ${evidencePath}: ${ownerSummary}.`;

  proposalContext.horizon = typeof proposalContext.horizon === "string" ? proposalContext.horizon : "12-24h";
  proposalContext.success_criteria = [
    `project.context.current_root_readout, project.context.current_focus_proposal, and .state/project-state.json all represent ${frontierVector} excluding ${repairTaskId}.`,
    `No live active or review leaf other than ${repairTaskId} is omitted from stored readouts.`,
    `Dirty domain repo ownership remains explicit: ${ownerSummary}.`,
    blockedSentence,
  ];
  proposalContext.progress_review = {
    reviewed_at: appliedAt,
    result: "updated",
    evidence_path: evidencePath,
    answers: {
      learned_or_verified: [
        `Fresh frontier comparison showed readout drift against ${frontierVector}.`,
        `Repaired app surfaces now carry the same active/review/waiting/runnable sets sampled at ${appliedAt}.`,
        `Dirty domain repo ownership is no longer anonymous: ${ownerSummary}.`,
      ],
      live_execution_posture:
        frontier.activeExcludingSelf.length > 0
          ? `Active work remains ${formatList(frontier.activeExcludingSelf)} with review work ${formatList(frontier.review)}.`
          : `No non-self active work remains; review work is ${formatList(frontier.review)}.`,
      blocker_mix: blockedSentence,
      parallel_leafs: `Current live frontier excluding ${repairTaskId} has ${frontier.activeExcludingSelf.length} active, ${frontier.review.length} review, ${frontier.waiting.length} waiting, and ${frontier.runnable.length} runnable leaves.`,
      goal_alignment:
        "This repair only rewrites app-owned readout state and dirty-file ownership attribution; it does not create, route, or widen domain work.",
    },
  };
  proposalContext.lane_links = {
    active: frontier.activeExcludingSelf,
    review: frontier.review,
    waiting: frontier.waiting,
    runnable: frontier.runnable,
    blocked_stewardship: topLevelBlockedIds,
    dirty_domain_repo_owners: owners.map((owner) => `${owner.path} -> ${owner.taskId}`),
  };
  proposalContext.active_task_ids = frontier.activeExcludingSelf;
  proposalContext.review_task_ids = frontier.review;
  proposalContext.waiting_task_ids = frontier.waiting;
  proposalContext.runnable_task_ids = frontier.runnable;
  proposalContext.blocked_task_ids = blockedLineageIds;
  proposalContext.linked_blocked_task_ids = blockedLineageIds;
  proposalContext.proposed_task_ids = proposedTaskIds;

  currentFocusProposal.id = proposalId;
  currentFocusProposal.title = proposalTitle;
  currentFocusProposal.status = "updated";
  currentFocusProposal.reviewed_at = appliedAt;
  currentFocusProposal.needs_approval = false;
  currentFocusProposal.reason = proposalReason;
  currentFocusProposal.evidence_path = evidencePath;
  currentFocusProposal.context = proposalContext;

  currentRootReadout.updated_at = appliedAt;
  currentRootReadout.excludes_task_id = repairTaskId;
  currentRootReadout.contract_scope = scope;
  currentRootReadout.active_task_ids_excluding_self = frontier.activeExcludingSelf;
  currentRootReadout.active_task_ids_including_self = unique([
    ...frontier.activeExcludingSelf,
    ...(nodeState(repairTask) === "active" ? [repairTaskId] : []),
  ]);
  currentRootReadout.review_task_ids = frontier.review;
  currentRootReadout.waiting_task_ids = frontier.waiting;
  currentRootReadout.runnable_task_ids = frontier.runnable;
  currentRootReadout.blocked_leaf_count = frontier.blockedLeafCount;
  currentRootReadout.top_level_blocked_ids = topLevelBlockedIds;
  currentRootReadout.top_level_blocked_root_ids = topLevelBlockedIds;
  currentRootReadout.root_frontier_readout_repaired_at = appliedAt;
  currentRootReadout.root_frontier_readout_repaired_by = worker;
  currentRootReadout.root_frontier_readout_repair_attempt_id = process.env.ATTEMPT_ID ?? repairTaskId;
  currentRootReadout.root_frontier_readout_repair_evidence_path = evidencePath;

  projectContext.current_root_readout = currentRootReadout;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectContext.current_focus_proposal_progress_review_refreshed_at = appliedAt;
  projectContext.current_focus_proposal_progress_review_refreshed_by = "app-ops-script";
  projectContext.current_focus_proposal_progress_review_evidence_path = evidencePath;
  projectTask.context = projectContext;
  projectTask.summary =
    `Project-root readout at ${appliedAt} mirrors project.context.current_root_readout (${scope}): ` +
    `app-ops follow-through active=[${formatList(frontier.activeExcludingSelf)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}. ` +
    `${publication} ${blockedSentence}`;
  projectTask.strategy_context = `Planner parity repair (${appliedAt}): ${proposalReason}`;
  projectTask.progress = {
    updated_at: appliedAt,
    active_excluding_self: frontier.activeExcludingSelf.length,
    active_including_self: frontier.activeAll.length,
    review: frontier.review.length,
    waiting: frontier.waiting.length,
    runnable: frontier.runnable.length,
    blocked: frontier.blockedLeafCount,
    done: Number(summary.counts.done ?? 0),
    leaf_total: Number(summary.leaf_total ?? 0),
    top_level_blocked: topLevelBlockedIds.length,
  };
  projectTask.updated_at = appliedAt;
  projectTask.trace = {
    ...asRecord(projectTask.trace),
    live_frontier_focus_parity_repaired_at: appliedAt,
    live_frontier_focus_parity_repaired_by: "app-ops-script",
    live_frontier_focus_parity_repair_attempt_id: process.env.ATTEMPT_ID ?? repairTaskId,
    live_frontier_focus_parity_repair_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  const runtime = asRecord(loadProjectReadModel(appDir));
  const currentState = asRecord(runtime.currentState);
  const currentStateMetrics = asRecord(currentState.metrics);
  const currentFocus = asRecord(runtime.currentFocus);
  const currentFocusReview = asRecord(currentFocus.focusReview);
  const currentFocusMission = asRecord(currentFocus.focusMission);
  const focusPlan = asRecord(runtime.focusPlan);

  currentState.summary = projectTask.summary;
  currentState.activeTaskId = frontier.activeExcludingSelf[0] ?? null;
  currentState.metrics = {
    ...currentStateMetrics,
    blockedLeafCount: frontier.blockedLeafCount,
    runnableLeafCount: frontier.runnable.length,
    activeLeafCount: frontier.activeExcludingSelf.length,
    reviewLeafCount: frontier.review.length,
    waitingLeafCount: frontier.waiting.length,
  };

  currentFocus.summary =
    `Current root-frontier follow-through is active=[${formatList(frontier.activeExcludingSelf)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}]. ` +
    `${publication} ${blockedSentence}`;
  currentFocus.nextAction =
    `Keep the root contract truthful: active=[${formatList(frontier.activeExcludingSelf)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}]. ` +
    `Use dirty domain repo owner map in ${evidencePath} before treating unpublished changes as anonymous residue.`;
  currentFocus.activeTaskIds = frontier.activeExcludingSelf;
  currentFocus.proposedTaskIds = proposedTaskIds;
  currentFocusReview.reviewedAt = appliedAt;
  currentFocusReview.result = "updated";
  currentFocusReview.note = `Frontier parity repair refreshed live app readouts to ${frontierVector} excluding ${repairTaskId}. Dirty domain repo ownership is ${ownerSummary}.`;
  currentFocusReview.evidencePath = evidencePath;
  currentFocus.focusReview = currentFocusReview;
  currentFocusMission.id = proposalId;
  currentFocusMission.title = proposalTitle;
  currentFocusMission.horizon =
    typeof proposalContext.horizon === "string" ? proposalContext.horizon : "12-24h";
  currentFocusMission.successCriteria = [
    `Runtime focus surfaces represent ${frontierVector} excluding ${repairTaskId}.`,
    `Review frontier remains [${formatList(frontier.review)}] and active frontier remains [${formatList(frontier.activeExcludingSelf)}].`,
    `Dirty domain repo ownership remains explicit: ${ownerSummary}.`,
    blockedSentence,
  ];
  currentFocusMission.activeTaskIds = frontier.activeExcludingSelf;
  currentFocusMission.reviewTaskIds = frontier.review;
  currentFocusMission.waitingTaskIds = frontier.waiting;
  currentFocusMission.runnableTaskIds = frontier.runnable;
  currentFocusMission.linkedBlockedTaskIds = blockedLineageIds;
  currentFocusMission.evidencePath = evidencePath;
  currentFocus.focusMission = currentFocusMission;
  currentFocus.focusPlanId = proposalId;

  focusPlan.summary = `Focus plan root readout mirrors ${frontierVector} excluding ${repairTaskId}. ${publication} ${blockedSentence}`;
  focusPlan.currentProposalId = proposalId;
  focusPlan.evidencePath = evidencePath;

  saveProjectRuntimeState(appDir, {
    currentState,
    currentFocus,
    focusPlan,
    updatedAt: appliedAt,
  });

  return {
    frontier,
    topLevelBlockedIds,
    blockedLineageIds,
    owners,
    scope,
    publication,
    blockedSentence,
    proposalReason,
    ownerSummary,
  };
});

const after = compareCurrentState();

mkdirSync(dirname(evidenceAbsPath), { recursive: true });
writeFileSync(
  evidenceAbsPath,
  `# Ops reconcile — live frontier / readout / focus parity — 2026-07-16\n\n- Task: \`${repairTaskId}\`\n- Applied at: \`${appliedAt}\`\n- App repo: \`${appDir}\`\n- Domain repo: \`${projectDir}\`\n\n## Baseline command-backed comparison before repair\n\n### Live frontier at capture\n\n- active including self: [${formatList(before.live.activeAll)}]\n- active excluding self: [${formatList(before.live.activeExcludingSelf)}]\n- review: [${formatList(before.live.review)}]\n- waiting: [${formatList(before.live.waiting)}]\n- runnable: [${formatList(before.live.runnable)}]\n- blocked leaf count: ${before.live.blockedLeafCount}\n\n### Stored surfaces before repair\n\n#### project.context.current_root_readout\n\n\`\`\`json\n${JSON.stringify(before.projectRootReadout, null, 2)}\n\`\`\`\n\n#### project.context.current_focus_proposal\n\n\`\`\`json\n${JSON.stringify(before.projectFocusProposal, null, 2)}\n\`\`\`\n\n#### .state/project-state.json currentFocus.focusMission\n\n\`\`\`json\n${JSON.stringify(before.runtimeFocusMission, null, 2)}\n\`\`\`\n\n### Named active/review/waiting/runnable mismatches before repair\n\n${before.mismatches.length > 0 ? before.mismatches.map((line) => `- ${line}`).join("\n") : "- none"}\n\n## Applied app-layer repair\n\nUpdated only app-owned state surfaces so the stored readouts sample the same live frontier timestamp while intentionally omitting only \`${repairTaskId}\` from the non-self arrays:\n\n- \`project.context.current_root_readout\`\n- \`project.context.current_focus_proposal\`\n- \`project.summary\`, \`project.strategy_context\`, and \`project.progress\`\n- \`.state/project-state.json -> currentState\`, \`currentFocus\`, and \`focusPlan\`\n\nRepair sentence used for the proposal/readout surfaces:\n\n> ${mutated.proposalReason}\n\n## Dirty domain repo ownership at apply time\n\n| Dirty path | Live owner task | State | Rationale |\n| --- | --- | --- | --- |\n${mutated.owners.map((owner) => `| \`${owner.path}\` | \`${owner.taskId}\` | \`${owner.state}\` | ${owner.rationale.replace(/\|/g, "\\|")} |`).join("\n")}\n\n## Verification after repair\n\n### Live frontier at verification\n\n- active including self: [${formatList(after.live.activeAll)}]\n- active excluding self: [${formatList(after.live.activeExcludingSelf)}]\n- review: [${formatList(after.live.review)}]\n- waiting: [${formatList(after.live.waiting)}]\n- runnable: [${formatList(after.live.runnable)}]\n- blocked leaf count: ${after.live.blockedLeafCount}\n\n### Stored surfaces after repair\n\n#### project.context.current_root_readout\n\n\`\`\`json\n${JSON.stringify(after.projectRootReadout, null, 2)}\n\`\`\`\n\n#### project.context.current_focus_proposal\n\n\`\`\`json\n${JSON.stringify(after.projectFocusProposal, null, 2)}\n\`\`\`\n\n#### .state/project-state.json currentFocus.focusMission\n\n\`\`\`json\n${JSON.stringify(after.runtimeFocusMission, null, 2)}\n\`\`\`\n\n### Named active/review/waiting/runnable mismatches after repair\n\n${after.mismatches.length > 0 ? after.mismatches.map((line) => `- ${line}`).join("\n") : "- none"}\n\n## Acceptance check\n\n- Fresh command-backed comparison captured before repair and every active/review/waiting/runnable mismatch was named: ${before.mismatches.length > 0 ? "yes" : "no mismatches existed"}.\n- project.context.current_root_readout and current focus proposal now match the live frontier at one timestamp, excluding only \`${repairTaskId}\`: ${after.mismatches.length === 0 ? "yes" : "no"}.\n- Current dirty domain repo files are linked to live owner tasks: ${mutated.owners.every((owner) => owner.taskId !== "UNMAPPED") ? "yes" : "no"}.\n`,
);

console.log(
  JSON.stringify(
    {
      appliedAt,
      repairTaskId,
      evidencePath,
      beforeMismatchCount: before.mismatches.length,
      afterMismatchCount: after.mismatches.length,
      dirtyOwners: mutated.owners,
    },
    null,
    2,
  ),
);
