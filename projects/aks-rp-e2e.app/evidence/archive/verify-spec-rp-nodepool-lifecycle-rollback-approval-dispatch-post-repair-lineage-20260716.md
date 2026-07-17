# Verify rollback approval-dispatch post-repair lineage — 2026-07-16

Task: `verify-spec-rp-nodepool-lifecycle-rollback-approval-dispatch-post-repair-lineage-20260716`
Attempt: `a_verify-spec-rp-nodepool-lifecycle-rollback-approval-dispatch-post-repair-lineage-20260716_20260716191457`
Reviewed repair task: `repair-spec-rp-nodepool-lifecycle-rollback-approval-dispatch-app-packet-path-20260716`
Mode: Task Worker Mode

## Result

The app-rooted packet-path repair is present and its targeted workflow test still passes, but there is **still no post-repair authorized re-dispatch** for the rollback-history approval packet and therefore no controller-visible `message.created` or `notification_messages` lineage for the derived approval tuple yet.

Because Task Worker Mode forbids this session from emitting runtime/project events, I did **not** re-emit `project.approval.requested`. The correct worker output for this session is the exact current-state evidence plus the exact canonical event proposal planner/app-ops should emit unchanged.

`hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the single truthful wait unless a later operator answer creates a sharper successor.

## Packet and derived approval lineage

- packet path: `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- path id: `path.rp-nodepool-lifecycle.rollback`
- target: `human:operator`
- approvalId: `aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- waitId: `wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- dedupKey: `aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

## Primary-source repair baseline and current post-repair state

### Pre-repair failed dispatch lineage still visible

Read-only runtime DB evidence still shows the original pre-repair approval request and the ignored dispatch outcome:

- `events.id = 3341652`
  - `event_type = project.approval.requested`
  - `params.packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
  - `params.pathId = path.rp-nodepool-lifecycle.rollback`
  - `params.target = human:operator`
- `events.id = 3341691`
  - `event_type = workflow.completed`
  - `source = workflow:approval-dispatch`
  - summary = `Approval dispatch ignored: packetPath evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md must resolve inside evidence/archive/.`
- `.state/approval-dispatch-runs.jsonl` still contains only the matching ignored ledger row:
  - line `129`
  - `result = ignored`
  - `reason = packet-outside-evidence-archive`

Those rows prove the packet was accepted before the repair but failed at approval-dispatch normalization before any human-facing message was created.

### Repair still present and locally verified

The current `approval-dispatch` workflow now normalizes app-rooted archive packets through both the domain root and app root before applying the `evidence/archive/` guard, and the targeted regression suite still passes:

```text
cd /app/projects/aks-rp-e2e.app && bun test workflows/approval-dispatch.test.ts
3 pass
0 fail
```

That includes the app-rooted packet normalization test for `path.rp-nodepool-lifecycle.rollback`.

### Post-repair controller-visible lineage check

Using the ignored-dispatch completion timestamp from `events.id = 3341691` (`timestamp = 1784228738396`) as the post-repair cutoff, the current runtime still has **no authorized re-dispatch evidence** for this exact packet/tuple:

- `events` query for `event_type in ('project.approval.requested', 'message.created', 'project.approval.submitted')` after `1784228738396` with this packet path / approvalId / waitId returned `0 rows`
- `notification_messages` query after `1784228738396` with this packet path / approvalId / waitId returned `0 rows`

So the repair exists, but the reviewed approval request has not yet been re-emitted through the live controller-visible approval lane.

## Truthful wait confirmation

App-owned spec-loop state still records the rollback branch as the same environment blocker:

- spec key: `spec.rp-nodepool-lifecycle.rollback`
- `taskId = hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`
- `review.classification = environment_blocker`
- `successorDisposition = reviewed-environment-blocker-no-unchanged-rerun`
- `resumeCondition = Resume only after a reviewed environment materially changes this rollback surface by producing rollback history after the bounded node-image upgrade or by supplying a pool with preexisting rollback history. Do not queue another unchanged rerun of spec.rp-nodepool-lifecycle.rollback until then.`

No operator answer has superseded that wait, so it remains the single truthful blocked frontier.

## Exact canonical event proposal for planner/app-ops

Planner/app-ops should emit the already-reviewed approval request payload below **unchanged**:

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

## Exact controller-visible verification contract after planner emission

After the authorized re-dispatch, planner/reviewer should verify all of the following for the same packet path and derived approval tuple:

1. a later `events` row with `event_type = 'project.approval.requested'` and:
   - `params.packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
   - `params.pathId = path.rp-nodepool-lifecycle.rollback`
   - `params.target = human:operator`
2. a later `events` row with `event_type = 'message.created'` carrying:
   - `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
   - `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
   - the human-facing content header `AKS RP E2E approval packet dispatch`
   - `Feature path: path.rp-nodepool-lifecycle.rollback`
   - `Packet: evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
3. a matching `notification_messages` row, or approved equivalent controller-visible notification evidence, carrying the same `approvalId` / `waitId`
4. no change to the truthful frontier unless and until a returned `project.approval.submitted` operator answer creates a sharper successor than `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`

## Planner review conclusion

This task verifies the post-repair state truthfully: the dispatch code repair is landed and tested, but the exact reviewed approval request still needs one authorized planner/app-ops re-emission before any `message.created` or `notification_messages` lineage can exist. Until then, `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the single truthful wait.
