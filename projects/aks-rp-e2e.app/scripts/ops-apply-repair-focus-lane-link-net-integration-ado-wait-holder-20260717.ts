import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectReadModel } from "@may-agent/sdk";
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
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";

type JsonRecord = Record<string, unknown>;

type Snapshot = {
  checkedAt: string;
  taskCount: number;
  frontier: {
    active: string[];
    review: string[];
    waiting: string[];
    runnable: string[];
    blocked: string[];
  };
  projectProposalExecutionVerification: string[];
  focusTaskExecutionVerification: string[];
  projectProposalActive: string[];
  projectProposalReview: string[];
  focusTaskActive: string[];
  focusTaskReview: string[];
  rootReadoutActive: string[];
  rootReadoutReview: string[];
  runtimeActive: string[];
  runtimeReview: string[];
  runtimeLinkedBlocked: string[];
  waitState: string;
  waitParentId: string | null;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const checkedAt = new Date().toISOString();

const projectTaskId = "project";
const repairTaskId =
  "ops/repair-focus-lane-link-net-integration-ado-wait-holder-20260717";
const focusTaskId = "focus-same-spec-verification-fix-forward-followthrough-20260715";
const staleExecutionLinkTaskId =
  "domain/repoll-net-integration-nsg-route-table-in-use-vm-prerelease-run-172659069-terminal-artifact-review-20260717";
const liveWaitTaskId =
  "wait-net-integration-nsg-route-table-in-use-vm-prerelease-ado-run-172672040-result";
const evidencePath =
  "evidence/archive/ops-repair-focus-lane-link-net-integration-ado-wait-holder-20260717.md";
const evidenceAbsPath = resolve(appDir, evidencePath);

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

function asMutableRecord(value: unknown): JsonRecord {
  return asRecord(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        )
        .map((entry) => entry.trim())
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter(
        (value): value is string => !!value && value.trim().length > 0,
      ),
    ),
  ];
}

function nodeState(task: TaskNode | undefined): string {
  return String(task?.status ?? task?.state ?? "backlog");
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function readRuntimeState(): JsonRecord {
  return asMutableRecord(loadProjectReadModel(appDir));
}

function currentFocusProposal(tree: ReturnType<typeof readTaskTree>): JsonRecord {
  const projectTask = tree.tasks[projectTaskId];
  assert(projectTask, `Task not found: ${projectTaskId}`);
  const projectContext = asMutableRecord(projectTask.context);
  return asMutableRecord(projectContext.current_focus_proposal);
}

function currentRootReadout(tree: ReturnType<typeof readTaskTree>): JsonRecord {
  const projectTask = tree.tasks[projectTaskId];
  assert(projectTask, `Task not found: ${projectTaskId}`);
  const projectContext = asMutableRecord(projectTask.context);
  return asMutableRecord(projectContext.current_root_readout);
}

function focusContext(tree: ReturnType<typeof readTaskTree>): JsonRecord {
  const focusTask = tree.tasks[focusTaskId];
  assert(focusTask, `Task not found: ${focusTaskId}`);
  return asMutableRecord(focusTask.context);
}

function executionVerificationLinksFromProposal(tree: ReturnType<typeof readTaskTree>): string[] {
  const proposalContext = asMutableRecord(currentFocusProposal(tree).context);
  const laneLinks = asMutableRecord(proposalContext.lane_links);
  return asStringArray(laneLinks.execution_verification);
}

function executionVerificationLinksFromFocusTask(tree: ReturnType<typeof readTaskTree>): string[] {
  const laneLinks = asMutableRecord(focusContext(tree).lane_links);
  return asStringArray(laneLinks.execution_verification);
}

function captureSnapshot(nowIso: string): Snapshot {
  const summary = summarizeTaskTree(config);
  const runtime = readRuntimeState();
  const runtimeCurrentFocus = asMutableRecord(runtime.currentFocus);
  const runtimeFocusMission = asMutableRecord(runtimeCurrentFocus.focusMission);

  let snapshot: Snapshot | null = null;
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const proposalContext = asMutableRecord(currentFocusProposal(tree).context);
    const focus = focusContext(tree);
    const rootReadout = currentRootReadout(tree);
    const waitTask = tree.tasks[liveWaitTaskId];
    assert(waitTask, `Task not found: ${liveWaitTaskId}`);

    snapshot = {
      checkedAt: nowIso,
      taskCount: Object.keys(tree.tasks).length,
      frontier: {
        active: [...asStringArray(summary.frontier.active)].sort((a, b) =>
          a.localeCompare(b),
        ),
        review: [...asStringArray(summary.frontier.review)].sort((a, b) =>
          a.localeCompare(b),
        ),
        waiting: [...asStringArray(summary.frontier.waiting)].sort((a, b) =>
          a.localeCompare(b),
        ),
        runnable: [...asStringArray(summary.frontier.runnable)].sort((a, b) =>
          a.localeCompare(b),
        ),
        blocked: [...asStringArray(summary.frontier.blocked)].sort((a, b) =>
          a.localeCompare(b),
        ),
      },
      projectProposalExecutionVerification:
        executionVerificationLinksFromProposal(tree),
      focusTaskExecutionVerification: executionVerificationLinksFromFocusTask(tree),
      projectProposalActive: asStringArray(proposalContext.active_task_ids),
      projectProposalReview: asStringArray(proposalContext.review_task_ids),
      focusTaskActive: asStringArray(focus.active_task_ids),
      focusTaskReview: asStringArray(focus.review_task_ids),
      rootReadoutActive: asStringArray(rootReadout.active_task_ids_excluding_self),
      rootReadoutReview: asStringArray(rootReadout.review_task_ids),
      runtimeActive: asStringArray(runtimeCurrentFocus.activeTaskIds),
      runtimeReview: asStringArray(runtimeFocusMission.reviewTaskIds),
      runtimeLinkedBlocked: asStringArray(runtimeFocusMission.linkedBlockedTaskIds),
      waitState: nodeState(waitTask),
      waitParentId:
        typeof waitTask.parent_id === "string" ? waitTask.parent_id : null,
    };
  });

  assert(snapshot, "Failed to capture snapshot");
  return snapshot;
}

function applyExecutionVerificationRepair(nowIso: string): void {
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    const focusTask = tree.tasks[focusTaskId];
    const repairTask = tree.tasks[repairTaskId];
    const waitTask = tree.tasks[liveWaitTaskId];

    assert(projectTask, `Task not found: ${projectTaskId}`);
    assert(focusTask, `Task not found: ${focusTaskId}`);
    assert(repairTask, `Task not found: ${repairTaskId}`);
    assert(waitTask, `Task not found: ${liveWaitTaskId}`);
    assert(
      nodeState(waitTask) === "blocked",
      `Expected ${liveWaitTaskId} to remain blocked, got ${nodeState(waitTask)}`,
    );

    const projectContext = asMutableRecord(projectTask.context);
    const proposal = asMutableRecord(projectContext.current_focus_proposal);
    const proposalContext = asMutableRecord(proposal.context);
    const proposalLaneLinks = asMutableRecord(proposalContext.lane_links);
    proposalLaneLinks.execution_verification = [liveWaitTaskId];
    proposalContext.lane_links = proposalLaneLinks;
    proposal.context = proposalContext;
    projectContext.current_focus_proposal = proposal;
    projectTask.context = projectContext;
    projectTask.updated_at = nowIso;

    const focus = asMutableRecord(focusTask.context);
    const focusLaneLinks = asMutableRecord(focus.lane_links);
    focusLaneLinks.execution_verification = [liveWaitTaskId];
    focus.lane_links = focusLaneLinks;
    focusTask.context = focus;
    focusTask.updated_at = nowIso;

    repairTask.updated_at = nowIso;

    saveTaskTreeWithKanbanSnapshot(config, tree);
  });

  syncProjectReadout(config, nowIso);
}

function verify(before: Snapshot, after: Snapshot): string[] {
  const problems: string[] = [];
  const beforeHadStale =
    before.projectProposalExecutionVerification.includes(staleExecutionLinkTaskId) ||
    before.focusTaskExecutionVerification.includes(staleExecutionLinkTaskId);
  if (!beforeHadStale) {
    problems.push(
      `Baseline no longer shows stale execution_verification link ${staleExecutionLinkTaskId}; expected the task to repair a live stale reference.`,
    );
  }

  if (after.projectProposalExecutionVerification.includes(staleExecutionLinkTaskId)) {
    problems.push(
      `project.context.current_focus_proposal.context.lane_links.execution_verification still includes stale id ${staleExecutionLinkTaskId}.`,
    );
  }
  if (after.focusTaskExecutionVerification.includes(staleExecutionLinkTaskId)) {
    problems.push(
      `${focusTaskId}.context.lane_links.execution_verification still includes stale id ${staleExecutionLinkTaskId}.`,
    );
  }

  const expectedExecutionLinks = JSON.stringify([liveWaitTaskId]);
  if (
    JSON.stringify(after.projectProposalExecutionVerification) !==
    expectedExecutionLinks
  ) {
    problems.push(
      `project proposal execution_verification should be [${liveWaitTaskId}] but is [${formatList(after.projectProposalExecutionVerification)}].`,
    );
  }
  if (
    JSON.stringify(after.focusTaskExecutionVerification) !== expectedExecutionLinks
  ) {
    problems.push(
      `focus task execution_verification should be [${liveWaitTaskId}] but is [${formatList(after.focusTaskExecutionVerification)}].`,
    );
  }

  if (after.waitState !== "blocked") {
    problems.push(
      `${liveWaitTaskId} changed state to ${after.waitState}; expected blocked wait stewardship to remain intact.`,
    );
  }
  if (before.waitParentId !== after.waitParentId) {
    problems.push(
      `${liveWaitTaskId} parent changed from ${before.waitParentId ?? "null"} to ${after.waitParentId ?? "null"}.`,
    );
  }
  if (before.taskCount !== after.taskCount) {
    problems.push(
      `Task count changed from ${before.taskCount} to ${after.taskCount}; expected metadata-only repair with no duplicate poll task creation.`,
    );
  }

  if (
    JSON.stringify(after.projectProposalReview) !==
    JSON.stringify(after.frontier.review)
  ) {
    problems.push(
      `project current_focus_proposal review_task_ids [${formatList(after.projectProposalReview)}] do not match live review frontier [${formatList(after.frontier.review)}].`,
    );
  }
  if (JSON.stringify(after.focusTaskReview) !== JSON.stringify(after.frontier.review)) {
    problems.push(
      `focus task review_task_ids [${formatList(after.focusTaskReview)}] do not match live review frontier [${formatList(after.frontier.review)}].`,
    );
  }
  if (JSON.stringify(after.runtimeReview) !== JSON.stringify(after.frontier.review)) {
    problems.push(
      `runtime focusMission.reviewTaskIds [${formatList(after.runtimeReview)}] do not match live review frontier [${formatList(after.frontier.review)}].`,
    );
  }
  if (JSON.stringify(after.projectProposalActive) !== JSON.stringify(after.frontier.active)) {
    problems.push(
      `project current_focus_proposal active_task_ids [${formatList(after.projectProposalActive)}] do not match live active frontier [${formatList(after.frontier.active)}].`,
    );
  }
  if (JSON.stringify(after.focusTaskActive) !== JSON.stringify(after.frontier.active)) {
    problems.push(
      `focus task active_task_ids [${formatList(after.focusTaskActive)}] do not match live active frontier [${formatList(after.frontier.active)}].`,
    );
  }
  if (JSON.stringify(after.runtimeActive) !== JSON.stringify(after.frontier.active)) {
    problems.push(
      `runtime currentFocus.activeTaskIds [${formatList(after.runtimeActive)}] do not match live active frontier [${formatList(after.frontier.active)}].`,
    );
  }

  return problems;
}

function buildEvidence(before: Snapshot, after: Snapshot): string {
  return `# Focus lane link repair — net-integration ADO wait holder

- Checked at: ${after.checkedAt}
- Repair task: \`${repairTaskId}\`
- Focus task: \`${focusTaskId}\`
- Stale missing-id reference: \`${staleExecutionLinkTaskId}\`
- Live wait holder preserved: \`${liveWaitTaskId}\`

## Baseline

- Live controller-visible frontier from \`bun run task-tree frontier\` equivalent:
  - active: \`[${formatList(before.frontier.active)}]\`
  - review: \`[${formatList(before.frontier.review)}]\`
  - waiting: \`[${formatList(before.frontier.waiting)}]\`
  - runnable: \`[${formatList(before.frontier.runnable)}]\`
- \`project.context.current_focus_proposal.context.lane_links.execution_verification\`: \`[${formatList(before.projectProposalExecutionVerification)}]\`
- \`${focusTaskId}.context.lane_links.execution_verification\`: \`[${formatList(before.focusTaskExecutionVerification)}]\`
- \`project.context.current_focus_proposal.context.active_task_ids\`: \`[${formatList(before.projectProposalActive)}]\`
- \`project.context.current_focus_proposal.context.review_task_ids\`: \`[${formatList(before.projectProposalReview)}]\`
- \`${focusTaskId}.context.active_task_ids\`: \`[${formatList(before.focusTaskActive)}]\`
- \`${focusTaskId}.context.review_task_ids\`: \`[${formatList(before.focusTaskReview)}]\`
- \`project.context.current_root_readout.active_task_ids_excluding_self\`: \`[${formatList(before.rootReadoutActive)}]\`
- \`project.context.current_root_readout.review_task_ids\`: \`[${formatList(before.rootReadoutReview)}]\`
- Runtime \`currentFocus.activeTaskIds\`: \`[${formatList(before.runtimeActive)}]\`
- Runtime \`currentFocus.focusMission.reviewTaskIds\`: \`[${formatList(before.runtimeReview)}]\`
- Wait holder state: \`${liveWaitTaskId}\` is \`${before.waitState}\` under parent \`${before.waitParentId ?? "null"}\`.

## Applied repair

Used an app-owned tree-lock repair script plus \`syncProjectReadout()\` to:

1. Replace the stale \`execution_verification\` lane link on both focus metadata surfaces with the exact live wait holder \`${liveWaitTaskId}\`.
2. Preserve the existing blocked wait task and its parent lineage unchanged.
3. Re-sync runtime/project readout surfaces from the live task tree so review remains limited to the actual live review leaves.

## After repair

- Live controller-visible frontier:
  - active: \`[${formatList(after.frontier.active)}]\`
  - review: \`[${formatList(after.frontier.review)}]\`
  - waiting: \`[${formatList(after.frontier.waiting)}]\`
  - runnable: \`[${formatList(after.frontier.runnable)}]\`
- \`project.context.current_focus_proposal.context.lane_links.execution_verification\`: \`[${formatList(after.projectProposalExecutionVerification)}]\`
- \`${focusTaskId}.context.lane_links.execution_verification\`: \`[${formatList(after.focusTaskExecutionVerification)}]\`
- \`project.context.current_focus_proposal.context.active_task_ids\`: \`[${formatList(after.projectProposalActive)}]\`
- \`project.context.current_focus_proposal.context.review_task_ids\`: \`[${formatList(after.projectProposalReview)}]\`
- \`${focusTaskId}.context.active_task_ids\`: \`[${formatList(after.focusTaskActive)}]\`
- \`${focusTaskId}.context.review_task_ids\`: \`[${formatList(after.focusTaskReview)}]\`
- \`project.context.current_root_readout.active_task_ids_excluding_self\`: \`[${formatList(after.rootReadoutActive)}]\`
- \`project.context.current_root_readout.review_task_ids\`: \`[${formatList(after.rootReadoutReview)}]\`
- Runtime \`currentFocus.activeTaskIds\`: \`[${formatList(after.runtimeActive)}]\`
- Runtime \`currentFocus.focusMission.reviewTaskIds\`: \`[${formatList(after.runtimeReview)}]\`
- Runtime \`currentFocus.focusMission.linkedBlockedTaskIds\`: \`[${formatList(after.runtimeLinkedBlocked)}]\`
- Wait holder state: \`${liveWaitTaskId}\` remains \`${after.waitState}\` under parent \`${after.waitParentId ?? "null"}\`.

## Verification

- The stale missing-id reference no longer appears in either repaired \`execution_verification\` lane-link surface.
- Both repaired lane links now point only at \`${liveWaitTaskId}\`, so the net-integration family is represented by the existing exact wait holder rather than a missing review task id.
- Review remains limited to the live review leaves \`[${formatList(after.frontier.review)}]\` across task-tree focus metadata and runtime readout surfaces.
- Task count stayed \`${before.taskCount}\` before and after the repair, so no duplicate poll task was created.
- The wait holder stayed blocked and retained the same parent lineage, preserving the watchdog-owned resume/fallback contract.
`;
}

const before = captureSnapshot(checkedAt);
applyExecutionVerificationRepair(checkedAt);
const after = captureSnapshot(checkedAt);
const problems = verify(before, after);
assert.equal(
  problems.length,
  0,
  `Focus lane-link repair verification failed:\n- ${problems.join("\n- ")}`,
);

mkdirSync(dirname(evidenceAbsPath), { recursive: true });
writeFileSync(evidenceAbsPath, buildEvidence(before, after));
console.log(JSON.stringify({
  checkedAt,
  evidencePath,
  repairedExecutionVerification: after.projectProposalExecutionVerification,
  frontier: after.frontier,
  waitState: after.waitState,
  taskCountBefore: before.taskCount,
  taskCountAfter: after.taskCount,
}, null, 2));
