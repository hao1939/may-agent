# Repair rollback approval-dispatch dedupe contamination and reverify — 2026-07-16

Task: `repair-rp-nodepool-rollback-approval-dispatch-dedupe-contamination-and-reverify-20260716`
Attempt: `a_repair-rp-nodepool-rollback-approval-dispatch-dedupe-contamination-and-reverify-20260716_20260716193249`
Mode: Task Worker Mode

## Result

I repaired the **exact rollback approval-dispatch duplicate-suppression contamination** in two bounded places:

1. **Workflow guard repair** in `workflows/approval-dispatch.ts`
   - relative packet paths now resolve against the declared app/project workspaces before falling back to process cwd
   - duplicate suppression now trusts only prior approval-dispatch ledger rows whose `packetAbsolutePath` is a real absolute path
2. **Exact contaminated ledger-row repair** in `.state/approval-dispatch-runs.jsonl`
   - the rollback tuple's local-only line was reclassified from `result="message.created"` to `result="local-only-ledger-contamination"`
   - an explicit contamination reason now records why that line must not suppress a real controller dispatch

That leaves the rollback tuple ready for a normal controller re-emit without widening duplicate suppression globally.

Because Task Worker Mode forbids emitting the follow-up runtime event from this session, I did **not** create the required later controller-visible `message.created` or `notification_messages` rows myself. Those remain the single bounded next step for planner/app-ops.

## Exact contaminated tuple repaired

- `packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `pathId = path.rp-nodepool-lifecycle.rollback`
- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `correlationKey = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

## Baseline and repair evidence

### 1) Pre-repair controller-visible state was incomplete

Runtime DB still shows only the two accepted `project.approval.requested` rows for this packet:

- `events.id = 3341652`
- `events.id = 3343036`

No matching controller-visible follow-through exists yet for the exact tuple:

- matching `events.message.created`: **0**
- matching `notification_messages`: **0**
- matching `events.project.approval.submitted`: **0**

### 2) The contaminated local ledger row was exact and bounded

The exact rollback correlation key had a malformed ledger row at former line 130 with:

- `result = message.created`
- `packetAbsolutePath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

That row was not controller-visible proof because its `packetAbsolutePath` was repo-relative rather than absolute and no matching DB `message.created` / `notification_messages` row existed.

### 3) Post-repair ledger state is clean for duplicate suppression

After the exact ledger edit:

- repo-local scan now reports `malformedMessageCreatedRows = 0`
- the prior malformed rollback row no longer counts as a `message.created` dedupe proof
- the only surviving rollback tuple ledger row still marked as controller history is line 131:
  - `result = duplicate-suppressed`
  - `packetAbsolutePath = /app/projects/aks-rp-e2e.app/evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

### 4) Unit verification proves the bounded repair

`bun test ./workflows/approval-dispatch.test.ts --timeout 30000` now passes all four targeted approval-dispatch tests, including the new regression that seeds the same malformed rollback-style ledger row and verifies the workflow emits a fresh `message.created` instead of suppressing it.

## Scope control: why this does not widen valid duplicate suppression

The repair is intentionally narrow:

- the workflow still suppresses duplicates when a prior trusted approval-dispatch ledger row exists
- the existing duplicate-suppression unit test still passes unchanged
- the new trust rule rejects only malformed local-only ledger rows whose `packetAbsolutePath` is not absolute
- current real ledger inventory after repair shows **zero** malformed `message.created` rows, so the rollback tuple was the only live contaminated case observed

## Truthful blocked wait confirmation

`hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the single truthful wait.

Current task-tree state still shows:

- `state = blocked`
- `owner = aks-explorer`
- unchanged resume condition: resume only when the exact rollback-history escalation returns stronger same-surface evidence or owner/environment confirmation that makes one bounded rerun truthful
- no returned `project.approval.submitted` operator answer yet exists to supersede it

## Exact planner/app-ops next step

Emit **one** normal controller re-dispatch of the already reviewed packet, unchanged:

```json
{
  "type": "project.approval.requested",
  "target": {
    "project": "aks-rp-e2e"
  },
  "data": {
    "project": "aks-rp-e2e",
    "reason": "manual-approval-packet-dispatch-request",
    "params": {
      "packetPath": "evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md",
      "pathId": "path.rp-nodepool-lifecycle.rollback",
      "target": "human:operator"
    }
  }
}
```

Then verify the first later controller-visible lineage for this same tuple includes:

1. later `events.project.approval.requested`
2. later `events.message.created` carrying the exact `approvalId` and `waitId`
3. matching `notification_messages` evidence for the same tuple (or documented controller-visible equivalent)
4. any later `events.project.approval.submitted`

## Acceptance status at handoff

### Satisfied now

- bounded repair evidence exists for the exact contaminated rollback approval-dispatch correlation key
- the repair is scoped only to the exact malformed local-only duplicate proof and the workflow trust rule for malformed ledger rows
- `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the single truthful wait unless a later operator answer supersedes it

### Still pending after this worker turn

- later controller-visible `events.message.created` row for the exact approval tuple
- matching `notification_messages` row or equivalent controller-visible notification evidence
- later controller-visible re-dispatch proof after planner/app-ops emits the unchanged packet through the normal path

This is therefore a bounded repair plus re-emit-ready handoff, not a controller-visible dispatch completion.