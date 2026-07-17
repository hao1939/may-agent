# Verify rollback approval redispatch lineage — 2026-07-16

Task: `verify-rp-nodepool-rollback-approval-redispatch-lineage-20260716`
Attempt: `a_verify-rp-nodepool-rollback-approval-redispatch-lineage-20260716_20260716195251`
Mode: Task Worker Mode

## Result

The planner-reviewed rollback approval re-dispatch **was emitted as `project.approval.requested`**, but the required downstream controller-visible lineage is still missing.

Current facts:

- accepted request row exists at event `3343036` for packet `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- a prior same-packet request row also exists at event `3341652`
- there is **no matching `message.created` event row** for the required approvalId/waitId/path
- there is **no matching `notification_messages` row** for the required approvalId/waitId/path
- there is **no later `project.approval.submitted` operator answer** for the same approvalId/waitId/path
- `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the single truthful wait and should stay unchanged

So this task produced the requested verification evidence, but acceptance is still unmet because the normal approval-dispatch lineage did not materialize after the redispatch.

## DB evidence

### Accepted `project.approval.requested` rows for the exact packet

Read-only DB query showed two accepted rows for the exact packet path:

| event id | timestamp UTC | accepted_by | packetPath | pathId | target | requestedActionLen |
|---|---|---|---|---|---|---:|
| `3341652` | `2026-07-16 19:04:44` | `cron:1` | `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md` | `path.rp-nodepool-lifecycle.rollback` | `human:operator` | `1168` |
| `3343036` | `2026-07-16 19:27:30` | `cron:1` | `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md` | `path.rp-nodepool-lifecycle.rollback` | `human:operator` | `1168` |

This satisfies only the "accepted request row exists" portion of lineage.

### Missing `message.created` evidence

Read-only DB counts:

- matching `events` rows where `event_type='message.created'` and approvalId/waitId/path match this rollback approval lineage: `0`
- all `message.created` rows with `id > 3343036`: `0`

So there is no controller-visible message event after the reviewed redispatch, and no matching historical message row either.

### Missing `notification_messages` evidence

Read-only DB count for `notification_messages` rows whose payload contains this exact approvalId, waitId, or pathId:

- `notificationMessagesMatching = 0`

So there is no controller-visible notification record for the reviewed redispatch lineage.

### Missing operator-answer supersession

Read-only DB count for `project.approval.submitted` rows matching this approvalId, waitId, or pathId:

- `approvalSubmittedMatching = 0`

Therefore no later operator answer supersedes the existing rollback frontier wait.

## Non-DB primary evidence: approval-dispatch ledger

`/app/projects/aks-rp-e2e.app/.state/approval-dispatch-runs.jsonl` currently contains these same-lineage rows:

1. `2026-07-16T19:05:38.391Z` — `result="ignored"`, `reason="packet-outside-evidence-archive"`
2. `2026-07-16T19:25:04.292Z` — `result="local-only-ledger-contamination"`
3. `2026-07-16T19:27:42.358Z` — `result="duplicate-suppressed"`, with duplicate reason `prior approval-dispatch ledger row already emitted message.created for this correlationKey`

That ledger sequence explains the missing lineage:

- a contaminated local-only ledger row exists for the exact correlation key
- the later redispatch was suppressed as a duplicate
- no real controller-visible `message.created` or `notification_messages` record exists to back that suppression

## Wait/frontier status

Current task-tree readback for `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` still shows:

- `state: blocked`
- unchanged goal: preserve the exact pending frontier for `spec.rp-nodepool-lifecycle.rollback`
- blocker condition still states run `28696337959` reached create, upgrade, and enumerate, but rollback history remained absent before and after the bounded node-image upgrade
- blocker text explicitly says the exact owner/environment follow-up is tracked by `ops/escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716`
- resume condition still requires stronger rollback-history evidence or owner/environment confirmation before any bounded rerun becomes truthful

Because `project.approval.submitted` count is still `0`, this wait remains the single truthful frontier and should **not** be widened, replaced, or reopened into an unchanged rerun.

## Diagnosis

The reviewed redispatch reached `project.approval.requested`, but approval-dispatch lineage is still broken for this exact correlation key. The strongest current explanation is:

1. the app recorded a local-only contamination row for this approval lineage
2. duplicate suppression then treated that contamination as if a real `message.created` had already happened
3. the redispatch therefore never produced the required controller-visible message/notification rows

## Exact planner/app-ops follow-up to add

This worker is not authorized to reshape the tree or emit events, so the exact proposal is:

- keep `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` unchanged
- add/dispatch one bounded app repair task to clear or bypass the contaminated duplicate-suppression state for correlation key
  `aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- then re-emit exactly one valid normal-controller approval dispatch for packet
  `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- then rerun this same lineage verification expecting:
  - accepted `project.approval.requested` row
  - matching `message.created` row carrying the exact approvalId and waitId
  - matching `notification_messages` row or equivalent controller-visible notification payload
  - unchanged rollback frontier wait unless a later real `project.approval.submitted` answer appears

## Canonical approval lineage expected on successful repair

- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

## Conclusion

Verified outcome for this attempt:

- accepted redispatch request row: **yes**
- matching `message.created`: **no**
- matching `notification_messages`: **no**
- later operator answer superseding existing wait: **no**
- keep `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`: **yes**
