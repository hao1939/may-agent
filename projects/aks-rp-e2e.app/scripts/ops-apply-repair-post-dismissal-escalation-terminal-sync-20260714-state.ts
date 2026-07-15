import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadProjectReadModel,
  saveProjectRuntimeState,
} from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const repairTaskId =
  "ops-apply-repair-post-dismissal-escalation-terminal-sync-20260714-state-";
const projectTaskId = "project";
const evidencePath =
  "evidence/archive/ops-apply-repair-post-dismissal-escalation-terminal-sync-20260714-state-.md";
const attemptId =
  "a_ops-apply-repair-post-dismissal-escalation-terminal-sync-20260714-state-_20260714170821";
const checkedAt = new Date().toISOString();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
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

function label(taskIds: string[]): string {
  return taskIds.length > 0 ? taskIds.join(", ") : "none";
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

const summaryBefore = summarizeTaskTree(config);

const treeResult = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const frontierBefore = summaryBefore.frontier;
  const actualFrontier = {
    active: unique(frontierBefore.active),
    review: unique(frontierBefore.review),
    waiting: unique(frontierBefore.waiting ?? []),
    runnable: unique(frontierBefore.runnable),
    blockedLeafCount: summaryBefore.counts.blocked,
  };

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const priorProjectReason =
    typeof currentFocusProposal.reason === "string"
      ? currentFocusProposal.reason
      : "";
  const projectTraceBefore = asRecord(projectTask.trace);
  const priorProjectOutputs = asStringArray(projectTask.outputs);

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.reason =
    `At ${checkedAt} the truthful live frontier is active=[${label(actualFrontier.active)}], review=[${label(actualFrontier.review)}], waiting=[${label(actualFrontier.waiting)}], runnable=[${label(actualFrontier.runnable)}], blocked=${actualFrontier.blockedLeafCount}. The earlier terminal-frontier finality proposal is archived settled history; keep project/app readout grounded in the current live repair leaf and the exact blocked waits already preserved in the task tree.`;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...priorProjectOutputs, evidencePath]);
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_post_dismissal_terminal_sync_repaired_at: checkedAt,
    current_focus_proposal_post_dismissal_terminal_sync_repaired_by:
      "app-ops-script",
    current_focus_proposal_post_dismissal_terminal_sync_repair_attempt_id:
      attemptId,
    current_focus_proposal_post_dismissal_terminal_sync_repair_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    actualFrontier,
    priorProjectReason,
    nextProjectReason: currentFocusProposal.reason,
  };
});

const readoutSync = syncProjectReadout(config, checkedAt);
const runtimeState = loadProjectReadModel(appDir) as Record<string, unknown>;
const currentFocus = asRecord(runtimeState.currentFocus);
const focusReview = asRecord(currentFocus.focusReview);
const focusPlan = asRecord(runtimeState.focusPlan);

focusReview.reviewedAt = checkedAt;
focusReview.result = "updated";
focusReview.note =
  `Current live frontier is active=[${label(treeResult.actualFrontier.active)}], review=[${label(treeResult.actualFrontier.review)}], waiting=[${label(treeResult.actualFrontier.waiting)}], runnable=[${label(treeResult.actualFrontier.runnable)}], blocked=${treeResult.actualFrontier.blockedLeafCount}. The earlier terminal-frontier finality proposal is archived settled history. Immediate next step is to finish the current active repair leaf and keep summaries aligned to the live task tree.`;
currentFocus.focusReview = focusReview;

focusPlan.summary =
  `The earlier Terminal frontier finality reconciliation proposal is archived settled history. Current live 12-24h frontier is active=[${label(treeResult.actualFrontier.active)}], review=[${label(treeResult.actualFrontier.review)}], waiting=[${label(treeResult.actualFrontier.waiting)}], runnable=[${label(treeResult.actualFrontier.runnable)}], blocked=${treeResult.actualFrontier.blockedLeafCount}. Live execution stays paused while exact blocked waits remain preserved in the task tree.`;

saveProjectRuntimeState(appDir, {
  currentFocus,
  focusPlan,
  updatedAt: checkedAt,
});

const runtimeAfter = loadProjectReadModel(appDir) as Record<string, unknown>;
const currentFocusAfter = asRecord(runtimeAfter.currentFocus);
const focusReviewAfter = asRecord(currentFocusAfter.focusReview);
const focusPlanAfter = asRecord(runtimeAfter.focusPlan);

const result = {
  checkedAt,
  attemptId,
  repairTaskId,
  projectTaskId,
  actualFrontier: treeResult.actualFrontier,
  priorProjectReason: treeResult.priorProjectReason,
  nextProjectReason: treeResult.nextProjectReason,
  readoutSync,
  focusReviewNote: focusReviewAfter.note ?? null,
  focusPlanSummary: focusPlanAfter.summary ?? null,
};

writeMemo(`# Post-dismissal escalation terminal sync — 2026-07-14

Task: \`${repairTaskId}\`
Attempt: \`${attemptId}\`

## Result

Applied the bounded app-owned focus/readout sync to the live project task and runtime project readout. The exact terminal dismissal for \`esc_1784047796732_at1a04\` still requires an authorized reviewer/planner event emit, so this worker records the canonical event payload and the separate escalation-hygiene successor proposal rather than emitting runtime events.

## Live frontier used as source of truth

- active: ${result.actualFrontier.active.length > 0 ? result.actualFrontier.active.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- review: ${result.actualFrontier.review.length > 0 ? result.actualFrontier.review.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- waiting: ${result.actualFrontier.waiting.length > 0 ? result.actualFrontier.waiting.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- runnable: ${result.actualFrontier.runnable.length > 0 ? result.actualFrontier.runnable.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- blocked leaf count: ${result.actualFrontier.blockedLeafCount}

## Bounded readout repair applied

Updated app-owned state through the supported task-tree save path plus runtime readout sync:

- refreshed \`project.context.current_focus_proposal.reason\`
- ran \`syncProjectReadout(...)\`
- refreshed runtime \`.state/project-state.json -> currentFocus.focusReview.note\`
- refreshed runtime \`.state/project-state.json -> focusPlan.summary\`

### Before

> ${result.priorProjectReason}

### After

> ${result.nextProjectReason}

### Runtime readout after sync

- \`currentFocus.focusReview.note\`
  > ${result.focusReviewNote}
- \`focusPlan.summary\`
  > ${result.focusPlanSummary}

## Canonical terminal dismissal proposal

\`\`\`json
{
  "type": "escalation.dismissed",
  "owner": "agent:app-ops",
  "data": {
    "escalationId": "esc_1784047796732_at1a04",
    "reason": "Dismissed as obsolete post-dismissal residue. The later planner-applied canonical repair already emitted the four reviewed stale nonapproval escalation.dismissed events, no replacement same-lineage replay row is needed for this residue, and the remaining work is broader blank-resume escalation-family hygiene outside this bounded sync repair leaf."
  }
}
\`\`\`

## Separate successor status

During this repair window, the planner already added the separate live successor:

\`\`\`json
{
  "id": "ops/reconcile-handled-may-blank-resume-escalation-family-20260714",
  "parentId": "project",
  "state": "active",
  "kind": "domain_leaf",
  "priority": "P2",
  "owner": "app-ops",
  "goal": "Classify the still-open handled agent:may runtime:session-finish escalations with blank resumeCondition, then apply the smallest supported app-side repair so each lineage is either terminally closed or replaced by one exact live wait with explicit resume metadata.",
  "outputs": [
    "evidence/archive/ops-reconcile-handled-may-blank-resume-escalation-family-20260714.md"
  ],
  "acceptance": [
    "Every still-open handled agent:may runtime:session-finish escalation with blank resumeCondition in the current integrity family is classified as terminally dismissible, already resolved, replace-with-exact-live-wait, or intentionally still open with explicit nonblank metadata.",
    "For each lineage in scope, the task tree/runtime records the canonical closure or the exact replacement holder instead of leaving a passive blank-resume handled escalation row.",
    "A post-repair recheck shows aks-rp-e2e.process.integrity.task-tree-problem-count = 0, or the evidence names the exact remaining non-family problem that keeps the metric above zero."
  ],
  "conflict_scope": [
    "process-integrity:handled-may-blank-resume-family"
  ]
}
\`\`\`

This worker therefore only needed to leave the canonical dismissal payload for \`esc_1784047796732_at1a04\` and confirm that the broader blank-resume family now has its own separate active owner.

Suggested initial member set for that successor (excluding \`esc_1784047796732_at1a04\`):

- \`esc_1784047256439_pxwew1\`
- \`esc_1784046982365_dq44yg\`
- \`esc_1784046317801_aps2wv\`
- \`esc_1784046308766_f7ec5p\`
- \`esc_1784029859303_vp62bh\`
- \`esc_1784025702408_bjctf7\`
- \`esc_1784014325105_6war51\`
- \`esc_1784006334756_6tx27x\`
- \`esc_1784005192428_yl2qy3\`
- \`esc_1783997879206_9fox72\`
- \`esc_1783995629961_9fzqmh\`
- \`esc_1783995592272_ri5f5c\`
- \`esc_1783969522790_6as2kv\`

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
