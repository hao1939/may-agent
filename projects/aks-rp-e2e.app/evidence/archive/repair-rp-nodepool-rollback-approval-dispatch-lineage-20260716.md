# Repair rollback approval-dispatch lineage follow-up — 2026-07-16

Task: `repair-rp-nodepool-rollback-approval-dispatch-lineage-20260716`
Attempt: `a_repair-rp-nodepool-rollback-approval-dispatch-lineage-20260716_20260716200116`
Mode: Task Worker Mode

## Result

I verified the current rollback approval tuple is still stuck in the same bounded failure mode:

- the exact packet now has **two accepted `project.approval.requested` rows** (`3341652`, `3343036`)
- the exact tuple still has **zero** matching controller-visible `message.created` rows
- the exact tuple still has **zero** matching `notification_messages` rows
- the exact tuple still has **zero** returned `project.approval.submitted` rows
- `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains unchanged and is still the single truthful wait

Primary-source inspection also showed that the app working tree already contains a bounded workflow/test repair for this contamination shape, but the live controller-visible lineage required by acceptance has still not occurred. The next truthful move is therefore **one fresh normal `project.approval.requested` emission after applying the bounded approval-dispatch repair already present in the app repo working tree**, followed by re-verification of the exact approval/message/notification lineage.

Because Task Worker Mode forbids this session from emitting runtime events directly, I did not send that event myself. This memo records the exact diagnosis, the bounded repair already visible in source, and the exact event proposal planner/app-ops should emit unchanged.

## Exact tuple under repair

- `packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `pathId = path.rp-nodepool-lifecycle.rollback`
- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `correlationKey = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

## Controller-visible DB evidence

### Accepted request rows exist

Read-only `events` query for the exact packet path returned two accepted request rows:

| event id | event_type | accepted_by | packetPath | pathId | target |
|---|---|---|---|---|---|
| `3341652` | `project.approval.requested` | `cron:1` | `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md` | `path.rp-nodepool-lifecycle.rollback` | `human:operator` |
| `3343036` | `project.approval.requested` | `cron:1` | `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md` | `path.rp-nodepool-lifecycle.rollback` | `human:operator` |

This satisfies only the request-row portion of lineage.

### Required downstream lineage is still absent

Read-only queries for the exact `approvalId`, `waitId`, and `packetPath` currently show:

- matching `events` rows where `event_type='message.created'`: **0**
- matching `notification_messages` rows: **0**
- matching `events` rows where `event_type='project.approval.submitted'`: **0**

So the acceptance-required controller-visible message and notification lineage still does not exist.

## Approval-dispatch ledger evidence

Current `.state/approval-dispatch-runs.jsonl` lines for this exact tuple are:

1. `2026-07-16T19:05:38.391Z` — `result="ignored"`, `reason="packet-outside-evidence-archive"`
2. `2026-07-16T19:25:04.292Z` — `result="local-only-ledger-contamination"`
3. `2026-07-16T19:27:42.358Z` — `result="duplicate-suppressed"`

The contamination row explicitly records:

- `packetAbsolutePath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `contaminationReason = Local verification recorded a repo-relative packetAbsolutePath without creating controller-visible message.created or notification_messages rows; do not treat this line as durable duplicate-suppression proof.`

That is the exact local-only contamination signature for this approval lineage.

## Source-level bounded repair already visible in the app repo

The current working tree diff for `workflows/approval-dispatch.ts` and `workflows/approval-dispatch.test.ts` shows a narrowly scoped repair that matches this failure shape:

1. **Packet path normalization repair**
   - app-rooted evidence packets are normalized back to repo-relative `evidence/archive/...` paths before correlation-key derivation
2. **Duplicate-suppression trust repair**
   - duplicate suppression now trusts only prior approval-dispatch ledger rows whose `packetAbsolutePath` is an actual absolute path
   - malformed local-only rows with repo-relative `packetAbsolutePath` no longer count as durable `message.created` proof
3. **Focused regressions added**
   - one test for app-rooted evidence packet normalization
   - one test that seeds the exact rollback-style malformed ledger row and verifies a fresh `message.created` is emitted instead of suppression

### Test verification for the bounded repair

`bun test ./workflows/approval-dispatch.test.ts --timeout 30000` currently passes:

- `emits packet-linked message.created record for an approval packet`
- `normalizes absolute app-workspace evidence/archive packets to repo-relative packet paths`
- `ignores malformed local-only ledger rows when deciding duplicate suppression`
- `suppresses duplicate message.created for the same approval lineage`

This proves the proposed repair remains bounded and preserves valid duplicate protection for unrelated approvals.

## Diagnosis

The live controller-visible lineage is still incomplete for the exact rollback tuple because the app has not yet produced a successful post-repair normal dispatch for this correlation key.

What is proven from primary sources:

1. the exact approval request was emitted at least twice (`3341652`, `3343036`)
2. the exact downstream `message.created` / `notification_messages` lineage never materialized
3. the approval-dispatch ledger still records the exact local-only contamination signature for this tuple
4. the app working tree already contains a bounded code/test repair for this contamination shape
5. no real operator response has superseded the current blocked frontier

What is **not** yet proven:

- a later live controller run using the repaired approval-dispatch logic that emits the exact required `message.created` and `notification_messages` lineage for this tuple

## Truthful wait confirmation

Readback of `.state/tasks/tree.json` for `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` still shows:

- `state = blocked`
- `owner = aks-explorer`
- unchanged goal: preserve the exact pending rollback frontier rather than reopening an unchanged rerun
- blocker condition still says run `28696337959` reached create, upgrade, and enumerate but rollback history remained absent before and after the bounded node-image upgrade
- resume condition still says: `Resume only when the exact rollback-history escalation returns stronger same-surface evidence or owner/environment confirmation that makes one bounded rerun truthful for spec.rp-nodepool-lifecycle.rollback.`

So this task does **not** widen, replace, or reopen that holder.

## Exact canonical event proposal for planner/app-ops

Emit exactly one new normal approval dispatch for the same reviewed packet after applying the bounded approval-dispatch repair already present in the app repo working tree:

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

## Exact post-emit verification expected

After the authorized re-emit, recheck for all of the following exact facts:

1. a matching later `project.approval.requested` row for the same packet/path/target
2. a matching `message.created` row carrying:
   - `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
   - `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
3. a matching `notification_messages` row or equivalent controller-visible notification payload for the same approval lineage
4. no change to `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` unless a later real `project.approval.submitted` answer sharpens it

## Acceptance status from this worker turn

### Completed in this turn

- diagnosed the exact contaminated/local-only approval-dispatch lineage state for the rollback correlation key
- confirmed the rollback hold task remains unchanged
- verified the bounded source-level repair present in the app repo and re-ran the focused approval-dispatch tests successfully
- recorded the exact canonical event proposal and exact lineage to verify after planner/app-ops emits it

### Still pending after this worker turn

- one later live normal controller dispatch that produces the required `message.created` row
- one matching `notification_messages` row or controller-visible equivalent
- post-repair runtime DB proof for the exact approvalId/waitId lineage

So the truthful status here is: **diagnosis and bounded repair proof complete; live controller-visible re-dispatch lineage still pending authorized emission.**
