import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectReadModel } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const currentTaskId =
  "ops-apply-ops-apply-ops-apply-ops-apply-refresh-focus-readout-post-no-li";
const reviewedTaskId =
  "ops-apply-ops-apply-ops-apply-refresh-focus-readout-post-no-live-refill-";
const projectTaskId = "project";
const evidencePath =
  "evidence/archive/ops-apply-ops-apply-ops-apply-ops-apply-refresh-focus-readout-post-no-li.md";
const attemptId =
  "a_ops-apply-ops-apply-ops-apply-ops-apply-refresh-focus-readout-post-no-li_20260714200812";
const checkedAt = new Date().toISOString();
const excludedTaskIds = [currentTaskId, reviewedTaskId];

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

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

const runtimeBefore = loadProjectReadModel(appDir) as JsonRecord;
const beforeCurrentFocus = asRecord(runtimeBefore.currentFocus);
const beforeFocusReview = asRecord(beforeCurrentFocus.focusReview);
const beforeFocusPlan = asRecord(runtimeBefore.focusPlan);
const beforeTree = readTaskTree(config);
const beforeProjectProposal = asRecord(
  asRecord(beforeTree.tasks[projectTaskId]?.context).current_focus_proposal,
);

const syncResult = syncProjectReadout(config, checkedAt);

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  if (Object.keys(currentFocusProposal).length === 0) return;

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.evidence_path = evidencePath;
  currentFocusProposal.status = "updated";
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const runtimeAfter = loadProjectReadModel(appDir) as JsonRecord;
const afterCurrentFocus = asRecord(runtimeAfter.currentFocus);
const afterFocusReview = asRecord(afterCurrentFocus.focusReview);
const afterFocusPlan = asRecord(runtimeAfter.focusPlan);
const afterState = asRecord(runtimeAfter.currentState);
const afterTree = readTaskTree(config);
const afterProjectProposal = asRecord(
  asRecord(afterTree.tasks[projectTaskId]?.context).current_focus_proposal,
);
const focusTaskIds = asStringArray(afterCurrentFocus.activeTaskIds);
const proposedTaskIds = asStringArray(afterCurrentFocus.proposedTaskIds);
const actualActiveLeafIds =
  syncResult.counts.active > 0
    ? syncResult.liveFocusTaskIds.slice(0, syncResult.counts.active)
    : [];
const representedIds = unique([...focusTaskIds, ...proposedTaskIds]);
const excludedRepresentedIds = representedIds.filter((id) => excludedTaskIds.includes(id));
const missingRepresentedIds = representedIds.filter((id) => !afterTree.tasks[id]);
const doneRepresentedIds = representedIds.filter((id) => {
  const task = afterTree.tasks[id];
  const state = String(task?.status ?? task?.state ?? "backlog");
  return state === "done";
});

const result = {
  checkedAt,
  attemptId,
  currentTaskId,
  reviewedTaskId,
  syncResult,
  before: {
    currentStateSummary:
      typeof asRecord(runtimeBefore.currentState).summary === "string"
        ? asRecord(runtimeBefore.currentState).summary
        : null,
    currentFocusSummary:
      typeof beforeCurrentFocus.summary === "string"
        ? beforeCurrentFocus.summary
        : null,
    focusReviewNote:
      typeof beforeFocusReview.note === "string" ? beforeFocusReview.note : null,
    focusPlanSummary:
      typeof beforeFocusPlan.summary === "string" ? beforeFocusPlan.summary : null,
    proposalReason:
      typeof beforeProjectProposal.reason === "string"
        ? beforeProjectProposal.reason
        : null,
  },
  after: {
    currentStateSummary:
      typeof afterState.summary === "string" ? afterState.summary : null,
    currentFocusSummary:
      typeof afterCurrentFocus.summary === "string"
        ? afterCurrentFocus.summary
        : null,
    focusReviewNote:
      typeof afterFocusReview.note === "string" ? afterFocusReview.note : null,
    focusPlanSummary:
      typeof afterFocusPlan.summary === "string" ? afterFocusPlan.summary : null,
    proposalReason:
      typeof afterProjectProposal.reason === "string"
        ? afterProjectProposal.reason
        : null,
    proposalEvidencePath:
      typeof afterProjectProposal.evidence_path === "string"
        ? afterProjectProposal.evidence_path
        : null,
    actualActiveLeafIds,
    focusTaskIds,
    proposedTaskIds,
  },
  verification: {
    excludedRepresentedIds,
    missingRepresentedIds,
    doneRepresentedIds,
  },
};

writeMemo(`# Focus/readout sync follow-up repair — 2026-07-14

Task: \`${currentTaskId}\`
Attempt: \`${attemptId}\`

## Result

Extended the durable app readout sync path, re-ran it against live app state, and refreshed the remaining stale metadata surfaces so the runtime readout and project current-focus proposal now match the current non-repair frontier.

## Live non-repair frontier after sync

- actual active leaf ids: ${actualActiveLeafIds.length > 0 ? actualActiveLeafIds.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- represented focus task ids: ${focusTaskIds.slice(0, 12).map((taskId) => `\`${taskId}\``).join(", ") || "none"}${focusTaskIds.length > 12 ? ` (+${focusTaskIds.length - 12} more)` : ""}
- proposed task ids sample: ${proposedTaskIds.slice(0, 12).map((taskId) => `\`${taskId}\``).join(", ") || "none"}${proposedTaskIds.length > 12 ? ` (+${proposedTaskIds.length - 12} more)` : ""}
- excluded represented ids: ${excludedRepresentedIds.length > 0 ? excludedRepresentedIds.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- missing represented ids: ${missingRepresentedIds.length > 0 ? missingRepresentedIds.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- done represented ids: ${doneRepresentedIds.length > 0 ? doneRepresentedIds.map((taskId) => `\`${taskId}\``).join(", ") : "none"}

## Before → after

- \`currentState.summary\`
  - before: ${String(result.before.currentStateSummary ?? "n/a")}
  - after: ${String(result.after.currentStateSummary ?? "n/a")}
- \`currentFocus.focusReview.note\`
  - before: ${String(result.before.focusReviewNote ?? "n/a")}
  - after: ${String(result.after.focusReviewNote ?? "n/a")}
- \`focusPlan.summary\`
  - before: ${String(result.before.focusPlanSummary ?? "n/a")}
  - after: ${String(result.after.focusPlanSummary ?? "n/a")}
- \`project.context.current_focus_proposal.reason\`
  - before: ${String(result.before.proposalReason ?? "n/a")}
  - after: ${String(result.after.proposalReason ?? "n/a")}
- \`project.context.current_focus_proposal.evidence_path\`
  - after: ${String(result.after.proposalEvidencePath ?? "n/a")}

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
