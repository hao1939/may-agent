import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  appendToolJournal,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "@may-agent/sdk";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-ops-apply-repair-stale-active-carrier-repair-transition-20260716-state-repair-state-repair_20260716062132";
const appliedAt = new Date().toISOString();

const carrierTaskId = "ops-apply-repair-default-hosted-pool-carriers-20260716-state-repair";
const reviewedRepairTaskId =
  "ops-apply-repair-stale-active-carrier-repair-transition-20260716-state-repair";
const currentRepairTaskId =
  "ops-apply-ops-apply-repair-stale-active-carrier-repair-transition-20260716-state-repair-state-repair";
const priorAttemptId =
  "a_ops-apply-repair-default-hosted-pool-carriers-20260716-state-repair_20260716060245";
const priorTaskRevision = 0;
const droppedSummary =
  "Applied the app-owned wrong-pool carrier state repair by retargeting the live egress publication holder to ADO run 172471986, updating the spec-loop/feature-compact/runtime readout state, and recording evidence that the old five-spec and outbound-lb wrong-pool waits were already non-live archived lineage rather than active canonical holders.";
const droppedEvidence = [
  "evidence/archive/ops-apply-repair-default-hosted-pool-carriers-20260716-state-repair.md",
  ".state/spec-loop/state.json",
  ".state/feature-compact-loop/state.json",
];
const memoPath =
  "evidence/archive/ops-apply-ops-apply-repair-stale-active-carrier-repair-transition-20260716-state-repair-state-repair.md";
const memoAbsolute = resolve(appDir, memoPath);

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function taskState(task: { state?: unknown; status?: unknown } | undefined): string {
  return String(task?.status ?? task?.state ?? "missing");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

const before = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const carrier = tree.tasks[carrierTaskId] as TaskNode | undefined;
  const childIds = asStringArray(carrier?.children);
  const children = childIds.map((id) => tree.tasks[id] as TaskNode | undefined);
  return {
    carrier,
    childIds,
    childStates: children.map((child) => ({
      id: child?.id ?? "missing",
      state: taskState(child),
    })),
    trace: asRecord(carrier?.trace),
    context: asRecord(carrier?.context),
  };
});

assert(before.carrier, `Missing task ${carrierTaskId}`);
assert(taskState(before.carrier) === "active", `${carrierTaskId} is not active`);
assert((before.carrier?.revision ?? null) === 2, `${carrierTaskId} revision is not 2`);
assert(before.childIds.length > 0, `${carrierTaskId} has no live child tasks`);

const mutated = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const carrier = tree.tasks[carrierTaskId] as TaskNode | undefined;
  assert(carrier, `Missing task during mutation: ${carrierTaskId}`);

  const trace = asRecord(carrier.trace);
  const context = asRecord(carrier.context);
  const priorLate = Array.isArray(trace.late_worker_completions)
    ? [...trace.late_worker_completions]
    : [];
  const filteredLate = priorLate.filter((entry) => {
    const record = asRecord(entry);
    return !(record.attempt_id === priorAttemptId && record.task_revision === priorTaskRevision);
  });

  const children = asStringArray(carrier.children)
    .map((id) => tree.tasks[id] as TaskNode | undefined)
    .filter((task): task is TaskNode => Boolean(task));
  const preservedChildStates = children.map((child) => ({
    taskId: child.id,
    state: taskState(child),
  }));

  const provenanceRecord = {
    sourceTaskId: carrierTaskId,
    supersededRepairTaskId: reviewedRepairTaskId,
    recordedByTaskId: currentRepairTaskId,
    sourceAttemptId: priorAttemptId,
    sourceTaskRevision: priorTaskRevision,
    result: "done",
    summary: droppedSummary,
    evidence: droppedEvidence,
    preservedActiveRevision: carrier.revision ?? null,
    preservedChildStates,
    reviewMemoPath: memoPath,
    recordedAt: appliedAt,
    rationale:
      "Metadata-only provenance backfill for the dropped revision-0 completion. The current task remains active revision 2 because live child follow-through now governs the canonical branch state.",
  };

  context.droppedRevisionCompletion = provenanceRecord;
  carrier.context = context;
  carrier.trace = {
    ...trace,
    late_worker_completions: [
      ...filteredLate,
      {
        attempt_id: priorAttemptId,
        task_revision: priorTaskRevision,
        current_revision_when_recorded: carrier.revision ?? null,
        result: "done",
        summary: droppedSummary,
        evidence: droppedEvidence,
        recorded_at: appliedAt,
        recorded_by: "app-ops-script",
        metadata_only: true,
        review_memo_path: memoPath,
      },
    ].slice(-5),
    stale_revision_completion_backfilled_at: appliedAt,
    stale_revision_completion_backfill_attempt_id: attemptId,
    stale_revision_completion_source_attempt_id: priorAttemptId,
    stale_revision_completion_source_revision: priorTaskRevision,
    stale_revision_completion_summary: droppedSummary,
    stale_revision_completion_evidence: droppedEvidence,
    stale_revision_completion_preserved_child_states: preservedChildStates,
    stale_revision_completion_review_memo_path: memoPath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
  appendToolJournal(config, {
    kind: "task_revision_completion_provenance_backfilled",
    task_id: carrierTaskId,
    source_task_revision: priorTaskRevision,
    source_attempt_id: priorAttemptId,
    current_task_revision: carrier.revision ?? null,
    current_state: taskState(carrier),
    child_states: preservedChildStates,
    review_memo_path: memoPath,
  });

  return {
    carrier,
    preservedChildStates,
    trace: asRecord(carrier.trace),
    context: asRecord(carrier.context),
  };
});

const afterLateCompletions = Array.isArray(mutated.trace.late_worker_completions)
  ? mutated.trace.late_worker_completions
  : [];

const memo = `# Apply repair — stale active carrier-repair transition provenance backfill — 2026-07-16

- Task: \`${currentRepairTaskId}\`
- Reviewed task: \`${reviewedRepairTaskId}\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`

## Scope

Applied the bounded app-owned metadata repair through an app-local task-tree helper script. This repair **did not** move \`${carrierTaskId}\` out of \`active\`, did **not** change child task state, and did **not** rewrite \`.state/spec-loop/state.json\` or \`.state/feature-compact-loop/state.json\`. It only backfilled durable provenance for the dropped revision-0 worker completion onto the live revision-2 carrier task.

## Baseline before apply

SDK-backed live task-tree read showed:

- \`${carrierTaskId}\` revision before apply: \`${String(before.carrier.revision ?? null)}\`
- \`${carrierTaskId}\` state before apply: \`${taskState(before.carrier)}\`
- live child ids before apply: ${JSON.stringify(before.childIds)}
- live child states before apply: ${JSON.stringify(before.childStates, null, 2)}
- existing \`trace.last_worker_completed_at\`: ${JSON.stringify(before.trace.last_worker_completed_at ?? null)}
- existing \`trace.stale_revision_completion_backfilled_at\`: ${JSON.stringify(before.trace.stale_revision_completion_backfilled_at ?? null)}
- existing \`context.droppedRevisionCompletion\`: ${JSON.stringify(before.context.droppedRevisionCompletion ?? null)}

Journal-backed stale completion provenance already existed only as audit rows for prior attempt \`${priorAttemptId}\` plus memo \`evidence/archive/ops-apply-repair-stale-active-carrier-repair-transition-20260716-state-repair.md\`; the live revision-2 carrier task itself did not yet surface that completion provenance.

## Applied metadata-only repair

Recorded the dropped revision-0 completion on the live carrier task without changing its active branch semantics:

- Added \`context.droppedRevisionCompletion\` with source attempt/revision, dropped summary, evidence refs, current preserved revision, current child states, and this memo path.
- Appended a metadata-only entry to \`trace.late_worker_completions\` for prior attempt \`${priorAttemptId}\`.
- Added explicit trace markers:\n  - \`stale_revision_completion_backfilled_at\`\n  - \`stale_revision_completion_backfill_attempt_id\`\n  - \`stale_revision_completion_source_attempt_id\`\n  - \`stale_revision_completion_source_revision\`\n  - \`stale_revision_completion_summary\`\n  - \`stale_revision_completion_evidence\`\n  - \`stale_revision_completion_preserved_child_states\`\n  - \`stale_revision_completion_review_memo_path\`
- Wrote a journal entry of kind \`task_revision_completion_provenance_backfilled\`.

## Post-apply verification

SDK-backed live task-tree read after apply should show:

- \`${carrierTaskId}\` remains revision \`2\` and state \`active\`
- child states remain ${JSON.stringify(mutated.preservedChildStates, null, 2)}
- \`context.droppedRevisionCompletion.sourceAttemptId\` = \`${priorAttemptId}\`
- \`context.droppedRevisionCompletion.reviewMemoPath\` = \`${memoPath}\`
- \`trace.stale_revision_completion_backfilled_at\` = \`${appliedAt}\`
- \`trace.late_worker_completions\` contains a metadata-only record for revision \`${String(priorTaskRevision)}\`

Read-only loop-state note:

- \`.state/spec-loop/state.json\`: unchanged by this repair
- \`.state/feature-compact-loop/state.json\`: unchanged by this repair

## Acceptance check

- App-owned task-tree repair applied through supported app mechanisms: satisfied.
- The affected branch records the dropped revision-0 completion provenance with exact summary/evidence while preserving current active child work: satisfied via \`${carrierTaskId}\`.context/trace plus this memo.

## Verification snapshot

\`context.droppedRevisionCompletion\`:

\`\`\`json
${JSON.stringify(mutated.context.droppedRevisionCompletion ?? null, null, 2)}
\`\`\`

\`trace.late_worker_completions\` tail:

\`\`\`json
${JSON.stringify(afterLateCompletions.slice(-2), null, 2)}
\`\`\`
`;

writeText(memoAbsolute, `${memo}\n`);
console.log(
  JSON.stringify(
    {
      ok: true,
      carrierTaskId,
      memoPath,
      appliedAt,
      carrierState: taskState(mutated.carrier),
      carrierRevision: mutated.carrier.revision ?? null,
      childStates: mutated.preservedChildStates,
      backfilledAt: mutated.trace.stale_revision_completion_backfilled_at ?? null,
    },
    null,
    2,
  ),
);
