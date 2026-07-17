# Verify rollback approval-dispatch lineage after repaired re-dispatch — 2026-07-16

Task: `verify-rp-nodepool-rollback-approval-dispatch-lineage-after-repair-redispach-20260716`
Attempt: `a_verify-rp-nodepool-rollback-approval-dispatch-lineage-after-repair-redispach-20260716_20260716192731`
Mode: Task Worker Mode

## Verdict

The later reviewed re-dispatch **did happen** at the `project.approval.requested` layer, but the required controller-visible approval lineage is still **not complete**.

What exists now:

- later `project.approval.requested` row: **yes** (`events.id = 3343036`)
- later `message.created` row with the required `approvalId` / `waitId`: **no**
- matching `notification_messages` row: **no**
- later `project.approval.submitted` operator answer: **no**
- truthful blocked wait remains unchanged: **yes** — keep `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`

So this task produced the requested verification evidence and diagnosis, but the literal acceptance criteria are still unmet because the controller-visible `message.created` and notification rows do not exist.

## Required lineage tuple

- `packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `pathId = path.rp-nodepool-lifecycle.rollback`
- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `target = human:operator`

## Later project.approval.requested DB evidence

Read-only DB evidence now shows two approval-request rows for this exact packet family:

1. pre-repair reviewed emit:
   - `events.id = 3341652`
   - `event_type = project.approval.requested`
   - `delivery_status = accepted`
2. later post-repair re-dispatch:
   - `events.id = 3343036`
   - `event_type = project.approval.requested`
   - `timestamp = 1784230050354`
   - `delivery_status = accepted`
   - `data.params.packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
   - `data.params.pathId = path.rp-nodepool-lifecycle.rollback`
   - `data.params.target = human:operator`

That satisfies the later `project.approval.requested` part of the contract.

## Missing controller-visible message.created and notification evidence

The required controller-visible follow-through is still absent in the runtime DB:

- matching `events` rows for `event_type = 'message.created'` with this exact `approvalId` / `waitId` / `packetPath`: **0**
- matching `notification_messages` rows carrying this exact `approvalId` / `waitId` / `packetPath`: **0**
- matching `events` rows for `event_type = 'project.approval.submitted'`: **0**

So there is still no controller-visible approval message row, no controller-visible notification row, and no returned operator answer for this exact approval lineage.

## What the controller did record

Although the DB lacks the required `message.created` and `notification_messages` rows, the controller did leave internal execution evidence for the later re-dispatch:

- `events.id = 3343045`
  - `event_type = workflow.started`
  - workflow = `approval-dispatch`
  - trigger event payload contains this exact packet path and `path.rp-nodepool-lifecycle.rollback`
- `events.id = 3343058`
  - `event_type = workflow.completed`
  - summary = `Approval dispatch suppressed duplicate message.created for path.rp-nodepool-lifecycle.rollback using evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md.`
- `events.id = 3343059`
  - `event_type = handler.workflow_dispatched`
  - same duplicate-suppressed summary

The local approval-dispatch ledger `.state/approval-dispatch-runs.jsonl` now shows three relevant rows for this packet:

- line `129`
  - `result = ignored`
  - `reason = packet-outside-evidence-archive`
- line `130`
  - `result = message.created`
  - carries the exact required `approvalId` / `waitId` / `correlationKey`
- line `131`
  - `result = duplicate-suppressed`
  - `duplicateReason = prior approval-dispatch ledger row already emitted message.created for this correlationKey`

That proves the workflow's own dedupe ledger believes a prior `message.created` already happened for this correlation key, even though the runtime DB still shows no such `events` row and no such `notification_messages` row.

## Root-cause diagnosis

The most likely cause is the earlier local verification execution from `repair-rp-nodepool-rollback-approval-dispatch-path-and-verify-lineage-20260716`.

That repair memo explicitly says the worker executed the current runtime-loaded approval-dispatch workflow locally with a **stubbed** `dispatchEvent()` to avoid emitting a real runtime event, while still exercising the exact reviewed rollback packet tuple.

Current `workflows/approval-dispatch.ts` behavior explains the mismatch:

1. the workflow calls `ctx.dispatchEvent("message.created", ...)`
2. regardless of whether that dispatch is a stubbed local call or a live runtime call, the workflow then appends a `.state/approval-dispatch-runs.jsonl` row with:
   - `result = message.created`
   - `approvalId`
   - `waitId`
   - `correlationKey`
3. future live runs check only that ledger via `hasPriorDispatchForCorrelation(...)`
4. if a prior ledger row exists, the live workflow exits early as `duplicate-suppressed`

So the likely sequence is:

- local non-runtime verification appended ledger line `130` as `message.created`
- no real runtime `events.message.created` row or `notification_messages` row was created by that local stubbed execution
- the later authorized controller re-dispatch then saw the ledger hit and produced line `131` as `duplicate-suppressed`
- therefore the real runtime never emitted the controller-visible `message.created` / notification rows that this task is supposed to verify

## Comparison with a known-good approval dispatch

A nearby successful approval-dispatch packet proves the expected controller-visible pattern really is:

- one `project.approval.requested` row
- one later `message.created` row in `events`
- one matching `notification_messages` row

Example from `evidence/archive/ops-dispatch-shared-ado-467665-queue-family-approval-proof-20260715-packet.md`:

- `events.id = 3273998` — `project.approval.requested`
- `events.id = 3274012` — `message.created`
  - includes the exact `approvalId`, `waitId`, and `packetPath`
- `notification_messages.telegram_msg_id = 45314`
  - includes matching approval lineage in `data.approval`

The rollback packet does **not** currently have that same controller-visible evidence pattern.

## Truthful wait confirmation

`hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the single truthful wait.

Current task-tree evidence still shows that holder as:

- `state = blocked`
- exact holder for `spec.rp-nodepool-lifecycle.rollback`
- blocked on the same rollback-history environment frontier
- resume only when the exact rollback-history escalation returns stronger same-surface evidence or owner/environment confirmation that makes one bounded rerun truthful

I found no `project.approval.submitted` row or other controller-visible operator answer that supersedes this wait.

## Exact planner/app-ops follow-up proposal

Do **not** replace or widen `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`.

Planner/app-ops should add one bounded follow-up repair that:

1. treats `.state/approval-dispatch-runs.jsonl` line `130` for this exact correlation key as contaminated by local verification rather than as proof of a controller-visible dispatch,
2. repairs or bypasses approval-dispatch duplicate suppression for this exact rollback approval tuple without broadening scope,
3. re-emits the same reviewed `project.approval.requested` payload unchanged through the normal controller path,
4. then re-verifies all of:
   - later `events.project.approval.requested`
   - later `events.message.created`
   - matching `notification_messages`
   - any later `events.project.approval.submitted`

## Bottom line

- later re-dispatch event emitted: **yes**
- required `events.message.created` row: **no**
- required `notification_messages` row: **no**
- operator answer sharper than current wait: **no**
- truthful wait remains: **hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707**

This verification task therefore finishes as an evidence-backed partial: the later approval request exists, but controller-visible approval lineage is still blocked by duplicate-suppression state that appears to have been seeded by local non-runtime verification rather than by a real prior dispatch.
