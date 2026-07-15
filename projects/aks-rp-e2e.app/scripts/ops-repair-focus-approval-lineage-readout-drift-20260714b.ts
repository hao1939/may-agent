import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import { summarizeTaskTree, taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type ApprovalTuple = {
  pathId: string;
  approvalId: string;
  waitId: string;
  packetPath: string;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const repairTaskId = "ops/repair-focus-approval-lineage-readout-drift-20260714b";
const focusTaskId = "focus-blocked-frontier-writeback-and-holder-normalization-20260714";
const governingWaitTaskId =
  "ops/wait-project-approval-owner-return-primary-blocker-20260713";
const evidencePath =
  "evidence/archive/ops-repair-focus-approval-lineage-readout-drift-20260714b.md";
const attemptId =
  "a_ops_repair-focus-approval-lineage-readout-drift-20260714b_20260714174450";
const checkedAt = new Date().toISOString();

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function taskLabel(taskIds: string[]): string {
  return taskIds.length > 0 ? taskIds.join(", ") : "none";
}

function tupleFromWaitingFor(value: unknown): ApprovalTuple {
  const waitingFor = asRecord(value);
  const pathId = String(waitingFor.pathId ?? "").trim();
  const approvalId = String(waitingFor.approvalId ?? "").trim();
  const waitId = String(waitingFor.waitId ?? "").trim();
  const packetPath = String(waitingFor.packetPath ?? "").trim();
  if (!pathId || !approvalId || !waitId || !packetPath) {
    throw new Error(
      `Incomplete approval tuple: ${JSON.stringify(waitingFor, null, 2)}`,
    );
  }
  return { pathId, approvalId, waitId, packetPath };
}

function sameTuple(left: ApprovalTuple, right: ApprovalTuple): boolean {
  return (
    left.pathId === right.pathId &&
    left.approvalId === right.approvalId &&
    left.waitId === right.waitId &&
    left.packetPath === right.packetPath
  );
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

const summary = summarizeTaskTree(config);
const tree = readTaskTree(config);
const focusTask = tree.tasks[focusTaskId];
const waitTask = tree.tasks[governingWaitTaskId];
if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
if (!waitTask) throw new Error(`Task not found: ${governingWaitTaskId}`);

const focusTuple = tupleFromWaitingFor(asRecord(focusTask.blocker).waiting_for);
const waitTuple = tupleFromWaitingFor(asRecord(waitTask.blocker).waiting_for);
if (!sameTuple(focusTuple, waitTuple)) {
  throw new Error(
    `Focus and governing wait tuples diverge: ${JSON.stringify({ focusTuple, waitTuple }, null, 2)}`,
  );
}

const waitWaitingFor = asRecord(asRecord(waitTask.blocker).waiting_for);
const requestEventId = waitWaitingFor.requestEventId ?? null;
const messageEventId = waitWaitingFor.messageEventId ?? null;
const notificationId = waitWaitingFor.notificationId ?? null;
const dispatchLedgerLine = waitWaitingFor.dispatchLedgerLine ?? null;

const baseline = {
  active: unique(summary.frontier.active.filter((taskId) => taskId !== repairTaskId)),
  review: unique(summary.frontier.review.filter((taskId) => taskId !== repairTaskId)),
  waiting: unique((summary.frontier.waiting ?? []).filter((taskId) => taskId !== repairTaskId)),
  runnable: unique(summary.frontier.runnable.filter((taskId) => taskId !== repairTaskId)),
  blockedLeafCount: summary.counts.blocked,
};

const runtimeBefore = loadProjectReadModel(appDir) as JsonRecord;
const currentFocusBefore = asRecord(runtimeBefore.currentFocus);
const focusReviewBefore = asRecord(currentFocusBefore.focusReview);
const focusPlanBefore = asRecord(runtimeBefore.focusPlan);

const currentFocus = asRecord(runtimeBefore.currentFocus);
const focusReview = asRecord(currentFocus.focusReview);
const focusPlan = asRecord(runtimeBefore.focusPlan);

delete currentFocus.priorFocusPlanId;
delete currentFocus.priorFocusResult;
focusReview.reviewedAt = checkedAt;
focusReview.result = "needs_approval";
focusReview.note =
  `The blocked-frontier writeback and holder-normalization focus remains the correct 12-24h no-live direction, and its governing approval lineage is still carried by ${governingWaitTaskId}: pathId=${focusTuple.pathId}, approvalId=${focusTuple.approvalId}, waitId=${focusTuple.waitId}, packetPath=${focusTuple.packetPath}. Excluding ${repairTaskId}, the remaining live frontier is active=[${taskLabel(baseline.active)}], review=[${taskLabel(baseline.review)}], waiting=[${taskLabel(baseline.waiting)}], runnable=[${taskLabel(baseline.runnable)}], blocked=${baseline.blockedLeafCount}. ${focusTaskId} stays a dependent renamed branch under that same approval envelope; do not create a focus-local successor id or duplicate approval ask unless reviewed same-lineage evidence replaces the tuple.`;
currentFocus.focusReview = focusReview;

focusPlan.summary =
  `Proposed focus branch ${focusTaskId} remains blocked behind governing wait ${governingWaitTaskId}. The exact preserved approval tuple is pathId=${focusTuple.pathId}, approvalId=${focusTuple.approvalId}, waitId=${focusTuple.waitId}, packetPath=${focusTuple.packetPath}; send proof still points at requestEventId=${String(requestEventId)}, messageEventId=${String(messageEventId)}, notificationId=${String(notificationId)}, dispatchLedgerLine=${String(dispatchLedgerLine)}. Excluding ${repairTaskId}, the live no-live frontier is active=[${taskLabel(baseline.active)}], review=[${taskLabel(baseline.review)}], waiting=[${taskLabel(baseline.waiting)}], runnable=[${taskLabel(baseline.runnable)}], blocked=${baseline.blockedLeafCount}. Keep this renamed blocked-frontier focus under the same approval envelope rather than inventing a new successor or duplicate packet.`;

saveProjectRuntimeState(appDir, {
  currentFocus,
  focusPlan,
  updatedAt: checkedAt,
});

const runtimeAfter = loadProjectReadModel(appDir) as JsonRecord;
const currentFocusAfter = asRecord(runtimeAfter.currentFocus);
const focusReviewAfter = asRecord(currentFocusAfter.focusReview);
const focusPlanAfter = asRecord(runtimeAfter.focusPlan);

const result = {
  checkedAt,
  attemptId,
  repairTaskId,
  focusTaskId,
  governingWaitTaskId,
  tuple: focusTuple,
  sendProof: {
    requestEventId,
    messageEventId,
    notificationId,
    dispatchLedgerLine,
  },
  baselineExcludingRepair: baseline,
  before: {
    priorFocusPlanId:
      typeof currentFocusBefore.priorFocusPlanId === "string"
        ? currentFocusBefore.priorFocusPlanId
        : null,
    priorFocusResult:
      typeof currentFocusBefore.priorFocusResult === "string"
        ? currentFocusBefore.priorFocusResult
        : null,
    focusReviewNote:
      typeof focusReviewBefore.note === "string" ? focusReviewBefore.note : null,
    focusPlanSummary:
      typeof focusPlanBefore.summary === "string"
        ? focusPlanBefore.summary
        : null,
  },
  after: {
    priorFocusPlanId:
      typeof currentFocusAfter.priorFocusPlanId === "string"
        ? currentFocusAfter.priorFocusPlanId
        : null,
    priorFocusResult:
      typeof currentFocusAfter.priorFocusResult === "string"
        ? currentFocusAfter.priorFocusResult
        : null,
    focusReviewNote:
      typeof focusReviewAfter.note === "string" ? focusReviewAfter.note : null,
    focusPlanSummary:
      typeof focusPlanAfter.summary === "string"
        ? focusPlanAfter.summary
        : null,
  },
};

writeMemo(`# Focus approval-lineage readout drift repair — 2026-07-14

Task: \`${repairTaskId}\`
Attempt: \`${attemptId}\`

## Result

Repaired the remaining project-state focus approval readout drift without reshaping the live tree. The blocked focus branch and the governing project wait already exposed the same preserved approval tuple, so this pass updated only app-owned runtime readout fields to carry that exact tuple and removed the stale archived prior-focus reference from \`.state/project-state.json\`.

## Governing tuple verified from the live tree

- blocked focus branch: \`${focusTaskId}\`
- governing wait: \`${governingWaitTaskId}\`
- pathId: \`${focusTuple.pathId}\`
- approvalId: \`${focusTuple.approvalId}\`
- waitId: \`${focusTuple.waitId}\`
- packetPath: \`${focusTuple.packetPath}\`
- requestEventId: \`${String(requestEventId)}\`
- messageEventId: \`${String(messageEventId)}\`
- notificationId: \`${String(notificationId)}\`
- dispatchLedgerLine: \`${String(dispatchLedgerLine)}\`

## Baseline used

Per worker-mode repair rules, the baseline excludes the assigned repair leaf \`${repairTaskId}\`.

- active: ${baseline.active.length > 0 ? baseline.active.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- review: ${baseline.review.length > 0 ? baseline.review.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- waiting: ${baseline.waiting.length > 0 ? baseline.waiting.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- runnable: ${baseline.runnable.length > 0 ? baseline.runnable.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- blocked leaf count: ${baseline.blockedLeafCount}

## Runtime readout repair applied

Updated app-owned runtime state only:

- removed stale \`currentFocus.priorFocusPlanId\` / \`priorFocusResult\` archived-reference residue
- refreshed \`currentFocus.focusReview.note\` to name \`${governingWaitTaskId}\` plus the exact tuple
- refreshed \`focusPlan.summary\` to name the same tuple and send-proof lineage

### Before

- \`priorFocusPlanId\`: ${result.before.priorFocusPlanId ? `\`${result.before.priorFocusPlanId}\`` : "none"}
- \`priorFocusResult\`: ${result.before.priorFocusResult ? `\`${result.before.priorFocusResult}\`` : "none"}
- \`currentFocus.focusReview.note\`
  > ${String(result.before.focusReviewNote ?? "n/a")}
- \`focusPlan.summary\`
  > ${String(result.before.focusPlanSummary ?? "n/a")}

### After

- \`priorFocusPlanId\`: ${result.after.priorFocusPlanId ? `\`${result.after.priorFocusPlanId}\`` : "none"}
- \`priorFocusResult\`: ${result.after.priorFocusResult ? `\`${result.after.priorFocusResult}\`` : "none"}
- \`currentFocus.focusReview.note\`
  > ${String(result.after.focusReviewNote ?? "n/a")}
- \`focusPlan.summary\`
  > ${String(result.after.focusPlanSummary ?? "n/a")}

## Planner/reviewer note

No event emission was needed from this worker pass. If a later reviewer decides the governing focus tuple should be superseded, the replacement must explicitly replace the preserved \`${focusTuple.pathId}\` / \`${focusTuple.approvalId}\` / \`${focusTuple.waitId}\` / \`${focusTuple.packetPath}\` tuple rather than layering a duplicate ask on top of it.

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
