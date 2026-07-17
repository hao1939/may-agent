# Emit rollback approval dispatch and verify lineage — 2026-07-16

Task: `emit-rp-nodepool-rollback-approval-dispatch-and-verify-lineage-20260716`
Attempt: `a_emit-rp-nodepool-rollback-approval-dispatch-and-verify-lineage-20260716_20260716201006`
Mode: Task Worker Mode

## Result

I verified the exact rollback approval lineage is still missing the required controller-visible send proof for packet `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`.

What is true right now:

- `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains unchanged as the single truthful wait.
- Two accepted `project.approval.requested` rows exist for the rollback packet, both with non-empty `requestedAction`.
- There is still **no matching approval-lineage `message.created` event** for the required rollback `approvalId` / `waitId`.
- There is still **no matching `notification_messages` row** for the required rollback `approvalId` / `waitId`.
- There is still **no `project.approval.submitted` operator answer** to supersede the existing rollback wait.
- The bounded workflow repair remains visible and its focused tests still pass, so valid duplicate protection is still intentionally exercised for unrelated approvals.

Because Task Worker Mode forbids this session from emitting project/runtime events, I did **not** send another approval request myself. The correct worker output is therefore the verified gap plus the exact canonical `project.approval.requested` event that planner/app-ops should emit unchanged.

## Exact rollback lineage under review

- `packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `pathId = path.rp-nodepool-lifecycle.rollback`
- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `correlationKey = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

## Controller-visible DB evidence

### 1) Accepted request rows exist for the rollback packet

Current read-only `events` inventory for approval requests with packet paths shows these rollback rows:

| event id | timestamp UTC | packetPath | pathId | target | requestedActionLen |
|---|---|---|---|---|---:|
| `3343036` | `2026-07-16 19:27:30` | `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md` | `path.rp-nodepool-lifecycle.rollback` | `human:operator` | `1168` |
| `3341652` | `2026-07-16 19:04:44` | `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md` | `path.rp-nodepool-lifecycle.rollback` | `human:operator` | `1168` |

These satisfy only the request-row part of lineage.

### 2) Matching approval-lineage `message.created` still does not exist

Current read-only `events` inventory for approval-bearing `message.created` rows returns **5 total rows** across the whole app. The entire set is:

- `3274012` — `ado-pipeline-467665-selective-queue-starvation-family-approval-proof-20260715`
- `3201956` — `ops-disabled-alert-alias-runtime-owner-escalation-20260709f`
- `3196139` — `path.aad-rbac.managed-v2-lifecycle`
- `3177604` — `focus-terminal-frontier-finality-reconciliation-20260714`
- `3166578` — `focus-no-live-draft-family-reconcile-schedulerctrl-windows-20260714`

None of those 5 rows carries this rollback packet path, rollback path id, rollback approval id, or rollback wait id.

So the exact rollback approval lineage still has **zero matching approval-bearing `message.created` rows**.

### 3) Matching `notification_messages` still does not exist

Current read-only `notification_messages` inventory for approval-bearing rows returns **36 total rows**. I inspected both the newest 20 and the remaining 16 approval-bearing rows. None carries:

- the rollback `approvalId`
- the rollback `waitId`
- packet `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `pathId = path.rp-nodepool-lifecycle.rollback`

So the exact rollback approval lineage still has **zero matching approval-bearing `notification_messages` rows**.

### 4) No operator return supersedes the wait

Current read-only `events` count for `event_type='project.approval.submitted'` is `0`.

So no operator answer currently supersedes the existing rollback environment-frontier holder.

## Truthful wait confirmation

Current runtime task-tree state for `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` still shows:

- `state = blocked`
- `owner = aks-explorer`
- unchanged goal to preserve the exact pending rollback frontier instead of reopening an unchanged rerun
- blocker condition still says reviewed run `28696337959` reached create, upgrade, and enumerate but rollback history remained absent before and after the bounded node-image upgrade
- resume condition still says: `Resume only when the exact rollback-history escalation returns stronger same-surface evidence or owner/environment confirmation that makes one bounded rerun truthful for spec.rp-nodepool-lifecycle.rollback.`

So this task does **not** widen, replace, or reopen that wait.

## Bounded repair / duplicate-protection evidence

The workflow repair remains narrowly scoped and still verified by focused tests.

### Source-level repair present

`workflows/approval-dispatch.ts` and `workflows/approval-dispatch.test.ts` still contain the bounded repair points already identified for this lineage:

- app-workspace `evidence/archive/...` packet paths normalize back to repo-relative packet paths before approval correlation
- duplicate suppression trusts only approval-dispatch ledger rows whose `packetAbsolutePath` is an actual absolute path
- a malformed local-only ledger row with repo-relative `packetAbsolutePath` is ignored instead of suppressing a real dispatch
- valid duplicate suppression for a real prior message-created lineage still remains covered by the existing duplicate test

### Focused verification still passes

`bun test ./workflows/approval-dispatch.test.ts --timeout 30000` currently passes all four tests:

- `emits packet-linked message.created record for an approval packet`
- `normalizes absolute app-workspace evidence/archive packets to repo-relative packet paths`
- `ignores malformed local-only ledger rows when deciding duplicate suppression`
- `suppresses duplicate message.created for the same approval lineage`

That is the current evidence that the repair stays bounded and does not globally disable valid duplicate protection.

## Exact canonical event proposal for planner/app-ops

Emit exactly one normal approval request through the repaired approval-dispatch path:

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

## Exact post-emit verification required

After planner/app-ops emits that event, the follow-up verification must confirm all of the following for this exact rollback tuple:

1. a **later** accepted `project.approval.requested` row for the same packet/path/target
2. a matching approval-lineage `message.created` row carrying the exact rollback `approvalId` and `waitId`
3. a matching approval-lineage `notification_messages` row for the same rollback `approvalId` and `waitId`
4. no change to `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` unless a later real `project.approval.submitted` answer sharpens it

## Worker conclusion

This worker turn completed the bounded investigation and exact proposal.

It did **not** complete the controller-visible lineage acceptance, because the required rollback approval `message.created` and `notification_messages` rows still do not exist and this worker is not authorized to emit the replacement event itself.
