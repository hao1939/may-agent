# Redispatch rollback approval request and verify lineage — 2026-07-16

Task: `redispatch-rp-nodepool-rollback-approval-request-and-verify-lineage-20260716`
Attempt: `a_redispatch-rp-nodepool-rollback-approval-request-and-verify-lineage-20260716_20260716194351`
Mode: Task Worker Mode

## Result

I verified that the reviewed rollback approval packet still has **no post-repair normal controller re-dispatch** and therefore still has **no post-repair controller-visible `message.created` or `notification_messages` lineage** for the exact rollback approval tuple.

Because Task Worker Mode forbids emitting runtime/project events from this session, I did **not** send the re-dispatch myself. This note records the exact controller-visible facts, confirms that `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the single truthful wait, and provides the exact canonical `project.approval.requested` payload that planner/app-ops should emit unchanged through the repaired approval-dispatch path.

## Exact approval tuple

- `packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `pathId = path.rp-nodepool-lifecycle.rollback`
- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

## Current controller-visible facts

### 1) The only matching `project.approval.requested` rows are still the pre-repair pair

Read-only DB evidence shows exactly these accepted matching rows:

- `events.id = 3341652`
  - `timestamp = 2026-07-16T19:04:44.243Z`
  - `accepted_at = 2026-07-16T19:04:44.952Z`
- `events.id = 3343036`
  - `timestamp = 2026-07-16T19:27:30.354Z`
  - `accepted_at = 2026-07-16T19:27:31.020Z`

The later row `3343036` does carry the exact reviewed packet details:

- `params.packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `params.pathId = path.rp-nodepool-lifecycle.rollback`
- `params.target = human:operator`
- non-empty `params.requestedAction`

### 2) Those rows are **not** post-repair rows

The repair session for
`repair-rp-nodepool-rollback-approval-dispatch-dedupe-contamination-and-reverify-20260716`
ended at:

- `endedAt = 2026-07-16T19:38:55.177Z`

So the latest matching approval-request row (`3343036` at `2026-07-16T19:27:30.354Z`) is **earlier than the repair completion**. That means the repaired workflow has **not yet** been exercised by a later controller-visible normal re-dispatch for this tuple.

### 3) No later controller-visible `message.created` row exists after the latest rollback approval request

Current DB maximum for **any** `events.message.created` row is:

- `max timestamp = 2026-07-16T19:08:16.932Z`
- `max id = 3341965`

That is **earlier** than the latest rollback approval-request row (`3343036` at `2026-07-16T19:27:30.354Z`). Therefore there is currently **no `message.created` row at all after** the latest rollback approval-request event, let alone one carrying the required rollback approval lineage.

### 4) No later controller-visible `notification_messages` row exists after the latest rollback approval request

Current DB maximum for **any** `notification_messages` row is:

- `max sent_at = 2026-07-16T18:00:27.204Z`
- `total notification_messages rows = 4130`

That is also **earlier** than the latest rollback approval-request row (`3343036` at `2026-07-16T19:27:30.354Z`). Therefore there is currently **no notification_messages row at all after** the latest rollback approval-request event, so the required rollback approval notification lineage is absent.

### 5) No operator return has superseded the existing truthful wait

Current DB query for `event_type = 'project.approval.submitted'` returned zero rows.

So there is still **no controller-visible operator answer** that would supersede the existing rollback environment frontier wait.

## Truthful wait remains unchanged

The live task tree still shows:

- `id = hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`
- `state = blocked`
- `owner = aks-explorer`

Its current blocker text remains exact:

> 2026-07-16 blocked-frontier review revalidated that spec.rp-nodepool-lifecycle.rollback still has no truthful unchanged rerun: reviewed run 28696337959 reached create, upgrade, and enumerate, but rollback history remained absent before and after the bounded node-image upgrade. The exact owner/environment follow-up is now tracked by ops/escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716; keep this holder as the single truthful wait until that ask returns stronger rollback-history evidence or same-surface environment support.

Its current resume condition remains exact:

> Resume only when the exact rollback-history escalation returns stronger same-surface evidence or owner/environment confirmation that makes one bounded rerun truthful for spec.rp-nodepool-lifecycle.rollback.

So `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the **single truthful wait** unless a later operator answer creates a sharper successor.

## Acceptance status against this task

### Satisfied now

- truthful wait confirmation is satisfied
- exact reviewed `project.approval.requested` payload details are known and preserved
- the task still uses the existing bounded approval-dispatch repair lineage rather than widening the rollback frontier

### Not yet satisfied

- no **post-repair** accepted `project.approval.requested` row exists yet
- no later `message.created` row exists for the rollback approval tuple
- no later `notification_messages` row exists for the rollback approval tuple

## Exact canonical event proposal for planner/app-ops

The next authorized step is to emit **one** normal controller re-dispatch through the repaired approval-dispatch path using the same bounded payload shape already reviewed for this packet:

```json
{
  "type": "project.approval.requested",
  "owner": "agent:app-ops",
  "target": {
    "project": "aks-rp-e2e"
  },
  "data": {
    "project": "aks-rp-e2e",
    "reason": "manual-approval-packet-dispatch-request",
    "params": {
      "packetPath": "evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md",
      "pathId": "path.rp-nodepool-lifecycle.rollback",
      "requestedAction": "Route this exact rollback-history environment ask through the human:operator lane for spec.rp-nodepool-lifecycle.rollback. Preserve reviewed run 28696337959, blocker no-rollback-versions-after-upgrade, staging subscription 26fe00f8-9173-4872-9134-bb1d2e00343a, region westus2, and the exercised VirtualMachines / Standard_D2s_v4 pool surface where create -> upgrade -> enumerate succeeded but rollback history was empty before and after the bounded node-image upgrade. Return exactly one of: (1) one current staging cluster/pool tuple plus authoritative same-surface proof that upgradeProfiles/default will expose non-empty rollback history after the bounded node-image upgrade for this rollback contract; (2) one current staging cluster/pool tuple plus authoritative proof that the pool already has preexisting rollback history on that same surface; or (3) the exact decline, redirect, or no-support answer stating that no truthful staging VM/SKU surface currently exposes that rollback history and naming the controlling owner/surface if different. Do not treat this as approval for another unchanged rerun on the previously reviewed westus2 Standard_D2s_v4 carrier.",
      "reason": "Reviewed run 28696337959 already proved the repaired rollback carrier reaches create, upgrade, and enumerate on staging westus2, but rollback history stayed empty before and after the bounded node-image upgrade. No controller-visible owner/environment answer currently identifies a truthful staging VM/SKU surface that would expose rollback history after upgrade or already contains preexisting rollback history.",
      "summary": "Use evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md unchanged. Preserve spec.rp-nodepool-lifecycle.rollback, reviewed run 28696337959, blocker no-rollback-versions-after-upgrade, subscription 26fe00f8-9173-4872-9134-bb1d2e00343a, westus2, and the previously exercised VirtualMachines/Standard_D2s_v4 surface. Reply only with a sharper same-surface rollback-history target/proof, a pool with preexisting rollback history, or an exact no-support/redirect answer.",
      "target": "human:operator"
    }
  }
}
```

## Exact verification to run after planner emission

After planner/app-ops emits that event through the normal path, the next verification should confirm all of the following for the same tuple:

1. a **later** accepted `events.project.approval.requested` row for this same packet after `2026-07-16T19:38:55.177Z`
2. a later `events.message.created` row created after that re-dispatch
3. a later `notification_messages` row created after that re-dispatch
4. any later `events.project.approval.submitted` returned owner decision

Until those later controller-visible rows exist, this branch remains at the same truthful wait and should **not** be treated as a completed approval-dispatch lineage repair.

## Worker conclusion

This task is **not blocked by missing authorization**; it is a bounded evidence/proposal handoff.

But it is also **not complete on controller-visible lineage** because the repaired workflow still has not been exercised by a later authorized re-dispatch. The remaining bounded work is: emit the reviewed `project.approval.requested` event once through the normal controller path, then re-verify the resulting `message.created` and `notification_messages` lineage for the exact rollback approval tuple.
