import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type MutableRecord = Record<string, unknown>;

type HolderSnapshot = {
  revision: number | null;
  acceptance: string[];
  contextDownstreamCarrierTaskIds: string[];
  contextArchivedTerminalReviewEvidencePath: string | null;
  traceDownstreamCarrierTaskIds: string[];
  traceArchivedTerminalReviewEvidencePath: string | null;
  blockerCondition: string | null;
  blockerResumeCondition: string | null;
  blockerWaitingForDownstreamCarrierTaskIds: string[];
};

const attemptId =
  "a_ops_apply-reconcile-shared-ado-same-run-stall-family-compact-pointer-after-archive-20260716_20260716181301";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const holderTaskId = "hold-compact-network-cni-package-partial-frontier-20260716r";
const archivedTerminalTaskId =
  "domain/review-network-cni-cilium-preview-upgrade-rerun-172487147-terminal";
const archivedTerminalBlockedTaskId =
  "domain/review-network-cni-cilium-preview-upgrade-rerun-172487147-terminal-blocked";
const archivedTerminalRefreshEvidencePath =
  "../aks-rp-e2e/evidence/archive/review-network-cni-cilium-preview-upgrade-rerun-172487147-terminal-refresh-20260716.md";
const liveDownstreamCarrierTaskIds = [
  "wait-spec-network-cni-azure-overlay-dual-stack-row94-live-surface-20260702",
  "wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703",
  "hold-spec-network-cni-vm-prerelease-calico-eno-row192-196-frontier-20260710",
] as const;
const evidencePath = resolve(
  appDir,
  "evidence/archive/ops-apply-reconcile-shared-ado-same-run-stall-family-compact-pointer-after-archive-20260716.md",
);
const evidencePathRelative =
  "evidence/archive/ops-apply-reconcile-shared-ado-same-run-stall-family-compact-pointer-after-archive-20260716.md";

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf8");
}

function snapshot(task: TaskNode | undefined): HolderSnapshot | null {
  if (!task) return null;
  const context = asRecord(task.context);
  const trace = asRecord(task.trace);
  const blocker = asRecord(task.blocker);
  const waitingFor = asRecord(blocker.waiting_for);
  return {
    revision:
      typeof task.revision === "number"
        ? task.revision
        : Number.isFinite(Number(task.revision))
          ? Number(task.revision)
          : null,
    acceptance: Array.isArray(task.acceptance)
      ? task.acceptance.filter((entry): entry is string => typeof entry === "string")
      : [],
    contextDownstreamCarrierTaskIds: asStringArray(
      context.downstreamCarrierTaskIds,
    ),
    contextArchivedTerminalReviewEvidencePath:
      asString(context.archivedTerminalReviewEvidencePath) || null,
    traceDownstreamCarrierTaskIds: asStringArray(trace.downstream_carrier_task_ids),
    traceArchivedTerminalReviewEvidencePath:
      asString(trace.archived_terminal_review_evidence_path) || null,
    blockerCondition: asString(blocker.condition) || null,
    blockerResumeCondition: asString(blocker.resume_condition) || null,
    blockerWaitingForDownstreamCarrierTaskIds: asStringArray(
      waitingFor.downstreamCarrierTaskIds,
    ),
  };
}

function downstreamCarrierHits() {
  const tree = readTaskTree(config);
  const openTasks = Object.values(tree.tasks ?? {}).filter(
    (task) => task && !["done", "closed"].includes(asString(task.state)),
  );
  const ids = [archivedTerminalTaskId, archivedTerminalBlockedTaskId];
  const hits: Array<{
    id: string;
    state: string;
    field: string;
    carrier: string;
  }> = [];
  for (const task of openTasks) {
    const taskRecord = task as TaskNode;
    for (const [field, value] of [
      [
        "context.downstreamCarrierTaskIds",
        asRecord(taskRecord.context).downstreamCarrierTaskIds,
      ],
      [
        "trace.downstream_carrier_task_ids",
        asRecord(taskRecord.trace).downstream_carrier_task_ids,
      ],
      [
        "blocker.waiting_for.downstreamCarrierTaskIds",
        asRecord(asRecord(taskRecord.blocker).waiting_for).downstreamCarrierTaskIds,
      ],
    ] as const) {
      const carriers = asStringArray(value);
      for (const id of ids) {
        if (carriers.includes(id)) {
          hits.push({
            id: asString(taskRecord.id),
            state: asString(taskRecord.state),
            field,
            carrier: id,
          });
        }
      }
    }
  }
  return hits;
}

function queuedSameRunReruns() {
  const tree = readTaskTree(config);
  const openTasks = Object.values(tree.tasks ?? {}).filter(
    (task) => task && !["done", "closed"].includes(asString(task.state)),
  );
  return openTasks
    .map((task) => task as TaskNode)
    .filter((task) => {
      const id = asString(task.id);
      return id.includes("172487147") && /(queue|retry|rerun)/i.test(id);
    })
    .map((task) => ({
      id: asString(task.id),
      state: asString(task.state),
      parent_id: asString(task.parent_id),
      goal: asString(task.goal),
    }));
}

const baselineTree = readTaskTree(config);
const baselineHolder = baselineTree.tasks[holderTaskId];
assert(baselineHolder, `Missing holder task ${holderTaskId}`);
const baselineSnapshot = snapshot(baselineHolder);
const baselineHits = downstreamCarrierHits();
const baselineQueuedReruns = queuedSameRunReruns();

const updatedSnapshot = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holder = tree.tasks[holderTaskId];
  assert(holder, `Missing holder task ${holderTaskId} during apply`);

  const context = asRecord(holder.context);
  context.downstreamCarrierTaskIds = [...liveDownstreamCarrierTaskIds];
  context.archivedTerminalReviewEvidencePath = archivedTerminalRefreshEvidencePath;
  holder.context = context;

  const trace = asRecord(holder.trace);
  trace.downstream_carrier_task_ids = [...liveDownstreamCarrierTaskIds];
  trace.archived_terminal_review_evidence_path =
    archivedTerminalRefreshEvidencePath;
  trace.same_run_terminal_archive_reconciled_at = appliedAt;
  trace.same_run_terminal_archive_reconciled_by = worker;
  holder.trace = trace;

  const acceptance = Array.isArray(holder.acceptance)
    ? holder.acceptance.filter((entry): entry is string => typeof entry === "string")
    : [];
  assert(acceptance.length >= 2, `${holderTaskId} acceptance is missing item[1]`);
  acceptance[1] =
    "The holder names the exact current live downstream holders wait-spec-network-cni-azure-overlay-dual-stack-row94-live-surface-20260702, wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703, and hold-spec-network-cni-vm-prerelease-calico-eno-row192-196-frontier-20260710, while preserving archived run-172487147 terminal review evidence at ../aks-rp-e2e/evidence/archive/review-network-cni-cilium-preview-upgrade-rerun-172487147-terminal-refresh-20260716.md as audit-only context and recording that spec.network-cni.azure-overlay-ilpip already normalized to pass from archived authenticated-launcher evidence and therefore does not justify recreating domain/retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714 as a blocked holder.";
  holder.acceptance = acceptance;

  const blocker = asRecord(holder.blocker);
  blocker.condition =
    "2026-07-16 same-run normalization applied: this compact family holder preserves archived ILPIP pass evidence while routing the remaining live downstream carriers through wait-spec-network-cni-azure-overlay-dual-stack-row94-live-surface-20260702, wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703, and hold-spec-network-cni-vm-prerelease-calico-eno-row192-196-frontier-20260710; preserve ../aks-rp-e2e/evidence/archive/review-network-cni-cilium-preview-upgrade-rerun-172487147-terminal-refresh-20260716.md as audit-only context and do not recreate stale ILPIP blocked work or restore archived run-172487147 same-run carriers as live blockers.";
  blocker.resume_condition =
    "Resume only when one of wait-spec-network-cni-azure-overlay-dual-stack-row94-live-surface-20260702, wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703, or hold-spec-network-cni-vm-prerelease-calico-eno-row192-196-frontier-20260710 materially changes the same-lineage frontier, or when compact diagnostics retire/reclassify the inherited active frontier.";
  const waitingFor = asRecord(blocker.waiting_for);
  waitingFor.downstreamCarrierTaskIds = [...liveDownstreamCarrierTaskIds];
  blocker.waiting_for = waitingFor;
  holder.blocker = blocker;

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return snapshot(tree.tasks[holderTaskId]);
});

const postApplyTree = readTaskTree(config);
const postApplyHolder = postApplyTree.tasks[holderTaskId];
assert(postApplyHolder, `Missing holder task ${holderTaskId} after apply`);
const postApplySnapshot = snapshot(postApplyHolder);
const postApplyHits = downstreamCarrierHits();
const postApplyQueuedReruns = queuedSameRunReruns();

assert(
  JSON.stringify(postApplySnapshot?.contextDownstreamCarrierTaskIds ?? []) ===
    JSON.stringify([...liveDownstreamCarrierTaskIds]),
  "context.downstreamCarrierTaskIds did not match expected live carrier set",
);
assert(
  JSON.stringify(postApplySnapshot?.traceDownstreamCarrierTaskIds ?? []) ===
    JSON.stringify([...liveDownstreamCarrierTaskIds]),
  "trace.downstream_carrier_task_ids did not match expected live carrier set",
);
assert(
  JSON.stringify(postApplySnapshot?.blockerWaitingForDownstreamCarrierTaskIds ?? []) ===
    JSON.stringify([...liveDownstreamCarrierTaskIds]),
  "blocker.waiting_for.downstreamCarrierTaskIds did not match expected live carrier set",
);
assert(postApplyHits.length === 0, "Archived downstream-carrier ids still appear in open-task carrier fields");
assert(postApplyQueuedReruns.length === 0, "An unchanged rerun is still queued for run 172487147");

writeText(
  evidencePath,
  `# Applied reconcile memo: shared ADO same-run stall family compact pointer after archive

Date: ${appliedAt}
Task: ops/apply-reconcile-shared-ado-same-run-stall-family-compact-pointer-after-archive-20260716
Attempt: ${attemptId}
Output: ${evidencePathRelative}

## Summary

Applied a bounded live holder repair on \`${holderTaskId}\` so archived run \`172487147\` task ids are no longer presented as live downstream carriers. The holder now preserves \`${archivedTerminalRefreshEvidencePath}\` as audit-only context while the live downstream-carrier arrays, acceptance text, blocker condition, and blocker resume path point only at the three remaining live holders.

## Live downstream-carrier set after repair

\
\
\
${JSON.stringify(liveDownstreamCarrierTaskIds, null, 2)}

## Baseline before apply

### Holder snapshot before apply

\
\
\
${JSON.stringify(baselineSnapshot, null, 2)}

### Open-task downstream-carrier hits before apply

\
\
\
${JSON.stringify(baselineHits, null, 2)}

### Queued same-run reruns before apply

\
\
\
${JSON.stringify(baselineQueuedReruns, null, 2)}

## Apply details

Updated only \`${holderTaskId}\`:

- replaced \`context.downstreamCarrierTaskIds\` with the three-item live carrier set
- replaced \`trace.downstream_carrier_task_ids\` with the same three-item live carrier set
- replaced \`blocker.waiting_for.downstreamCarrierTaskIds\` with the same three-item live carrier set
- rewrote acceptance item 2 so archived run \`172487147\` is retained only as audit context via \`${archivedTerminalRefreshEvidencePath}\`
- rewrote \`blocker.condition\` and \`blocker.resume_condition\` so archived run \`172487147\` is no longer presented as a live downstream carrier
- recorded audit-only evidence-path mirrors at \`context.archivedTerminalReviewEvidencePath\` and \`trace.archived_terminal_review_evidence_path\`

## Holder snapshot after apply

\
\
\
${JSON.stringify(updatedSnapshot, null, 2)}

## Verification

### Post-apply holder snapshot from task tree

\
\
\
${JSON.stringify(postApplySnapshot, null, 2)}

### Open-task downstream-carrier hits after apply

\
\
\
${JSON.stringify(postApplyHits, null, 2)}

### Queued same-run reruns after apply

\
\
\
${JSON.stringify(postApplyQueuedReruns, null, 2)}

## Reviewer checks to reproduce

### Holder show

\`\`\`bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show ${holderTaskId}
\`\`\`

Expected live fields:

- no \`${archivedTerminalTaskId}\` entry in \`context.downstreamCarrierTaskIds\`
- no \`${archivedTerminalTaskId}\` entry in \`trace.downstream_carrier_task_ids\`
- no \`${archivedTerminalBlockedTaskId}\` entry in \`blocker.waiting_for.downstreamCarrierTaskIds\`
- \`context.downstreamCarrierTaskIds\`, \`trace.downstream_carrier_task_ids\`, and \`blocker.waiting_for.downstreamCarrierTaskIds\` all equal the three-item set above

### Open-task downstream-carrier search

\`\`\`bash
cd /app/projects/aks-rp-e2e.app && bun -e '
const { readFileSync } = require("fs");
const tree = JSON.parse(readFileSync("tasks/tree.json", "utf8"));
const open = Object.values(tree.tasks || {}).filter((task) => task && !["done", "closed"].includes(task.state));
const ids = [
  "${archivedTerminalTaskId}",
  "${archivedTerminalBlockedTaskId}",
];
const hits = [];
for (const task of open) {
  for (const [field, value] of [
    ["context.downstreamCarrierTaskIds", task.context?.downstreamCarrierTaskIds],
    ["trace.downstream_carrier_task_ids", task.trace?.downstream_carrier_task_ids],
    ["blocker.waiting_for.downstreamCarrierTaskIds", task.blocker?.waiting_for?.downstreamCarrierTaskIds],
  ]) {
    if (!Array.isArray(value)) continue;
    for (const id of ids) if (value.includes(id)) hits.push({ id: task.id, state: task.state, field, carrier: id });
  }
}
console.log(JSON.stringify(hits, null, 2));
'
\`\`\`

Observed after apply: \`[]\`
`);
