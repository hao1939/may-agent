# Verify RP nodepool rollback approval controller-visible lineage after dispatch — 2026-07-16

Task: `verify-rp-nodepool-rollback-approval-controller-visible-lineage-after-dispatch-20260716`
Attempt: `a_verify-rp-nodepool-rollback-approval-controller-visible-lineage-after-dispatch-20260716_20260716202327`
Mode: Task Worker Mode

## Result

Verified from controller-visible state that the rollback approval packet is now dispatched and visible on all required surfaces:

- a later matching `project.approval.requested` row exists for the rollback packet/path/target
- a matching `message.created` row exists with the required `approvalId` and `waitId`
- a matching `notification_messages` row exists for the same approval lineage
- the spec-loop still points `spec.rp-nodepool-lifecycle.rollback` at `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`
- no matching `project.approval.submitted` operator answer exists yet, so the hold remains the truthful frontier and is not widened/replaced/reopened

## Hold remains unchanged

App-owned spec-loop state still shows the exact same blocked frontier for `spec.rp-nodepool-lifecycle.rollback`:

- `taskId = hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`
- `status = pending`
- `successorDisposition = reviewed-environment-blocker-no-unchanged-rerun`
- `resumeCondition = Resume only after a reviewed environment materially changes this rollback surface by producing rollback history after the bounded node-image upgrade or by supplying a pool with preexisting rollback history. Do not queue another unchanged rerun of spec.rp-nodepool-lifecycle.rollback until then.`

That means the approval dispatch did **not** widen, replace, or reopen the existing hold.

## Post-emit approval-request evidence

Matching rollback packet:

- `packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `pathId = path.rp-nodepool-lifecycle.rollback`
- `target = human:operator`

Latest matching `project.approval.requested` row:

- `events.id = 3346456`
- `timestamp = 2026-07-16 20:23:25 UTC`
- `owner = agent:app-ops`
- `source = agent:aks-explorer`
- `project = aks-rp-e2e`
- `reason = manual-approval-packet-dispatch-request`
- `requestedAction` is non-empty and matches the bounded rollback-history ask recorded in the packet

Count note:

- there are `3` matching `project.approval.requested` rows total for this exact packet/path/target (`3341652`, `3343036`, `3346456`)
- the latest row `3346456` is the later post-review dispatch evidence required by this task

## Post-emit message.created evidence

Matching approval lineage:

- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

Matching `message.created` row:

- `events.id = 3346538`
- `timestamp = 2026-07-16 20:24:48 UTC`
- `packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `pathId = path.rp-nodepool-lifecycle.rollback`

The stored message content includes all required controller-visible fields:

- `AKS RP E2E approval packet dispatch`
- `Approval id: aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `Wait id: wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `Feature path: path.rp-nodepool-lifecycle.rollback`
- `Packet: evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `That reply should emit project.approval.submitted carrying the approval id or wait id above.`

## Post-emit notification_messages evidence

Matching controller-visible notification row:

- `telegram_msg_id = 45370`
- `sent_at = 2026-07-16 20:24:55 UTC`
- `event_type = message.created`
- `dedupKey = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- embedded `approval.approvalId` matches the exact `approvalId`
- embedded `approval.waitId` matches the exact `waitId`
- embedded `approval.packetPath` matches the rollback packet path
- embedded `approval.pathId = path.rp-nodepool-lifecycle.rollback`

This satisfies the required controller-visible notification proof for the same approval lineage.

## No operator answer yet

I checked for a matching later `project.approval.submitted` row using the exact `approvalId`, exact `waitId`, and `pathId = path.rp-nodepool-lifecycle.rollback`.

Result:

- `0` matching `project.approval.submitted` rows

So the approval packet is dispatched, but there is not yet a returned operator decision that could supersede the existing hold.

## Lineage note on earlier attempts

The local approval-dispatch ledger shows earlier non-final lines for this same packet before the successful controller-visible dispatch:

- `ignored` because the packet was treated as outside the expected evidence-archive path
- `local-only-ledger-contamination` because a repo-relative packet path was recorded without controller-visible `message.created` / `notification_messages` proof
- `duplicate-suppressed` based on prior ledger state
- final successful `message.created` at `2026-07-16T20:24:48.886Z`

Those earlier ledger entries do **not** replace the required controller-visible proof. The durable controller-visible lineage is the combination of:

1. `project.approval.requested` event `3346456`
2. `message.created` event `3346538`
3. `notification_messages` row `45370`

## Reviewer/planner conclusion

No further event emission is needed from this worker session. The required post-dispatch lineage is now visible, and the truthful frontier remains `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` until a real later `project.approval.submitted` answer lands for this approval lineage.
