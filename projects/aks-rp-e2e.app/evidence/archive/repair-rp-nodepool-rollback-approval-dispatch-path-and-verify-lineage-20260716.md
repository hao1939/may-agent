# Repair rollback approval-dispatch path and verify lineage — 2026-07-16

Task: `repair-rp-nodepool-rollback-approval-dispatch-path-and-verify-lineage-20260716`
Attempt: `a_repair-rp-nodepool-rollback-approval-dispatch-path-and-verify-lineage-20260716_20260716192306`
Mode: Task Worker Mode

## Result

The rollback approval packet path repair is present in both the source workflow and the runtime-loaded workflow copy, and a direct local execution of the **exact reviewed** `project.approval.requested` payload now emits `message.created` for the required rollback approval tuple instead of ignoring the packet as `packet-outside-evidence-archive`.

I did **not** emit a live runtime/project event from this worker session because Task Worker Mode forbids that boundary-crossing step. So the remaining bounded work is for planner/app-ops to re-emit the same reviewed payload unchanged through the normal controller path and then verify the resulting controller-visible `message.created` and `notification_messages` lineage.

`hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the single truthful wait unless a later operator answer creates a sharper successor.

## Required approval tuple

- `packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `pathId = path.rp-nodepool-lifecycle.rollback`
- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `target = human:operator`

## Baseline controller-visible state

Read-only runtime evidence still shows the earlier pre-repair live emit and ignore outcome:

- `events.id = 3341652`
  - `event_type = project.approval.requested`
  - `delivery_status = accepted`
  - `data.params.packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
  - `data.params.pathId = path.rp-nodepool-lifecycle.rollback`
  - `data.params.target = human:operator`
- `.state/approval-dispatch-runs.jsonl` line `129`
  - `result = ignored`
  - `reason = packet-outside-evidence-archive`
  - `absolutePacketPath = /app/projects/aks-rp-e2e.app/evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

Current controller-visible lineage for the required tuple is still absent:

- matching `events` rows for `message.created` / `project.approval.submitted`: `0`
- matching `notification_messages` rows: `0`

That absence is expected because no authorized post-repair re-dispatch happened in this worker session.

## Root cause and repair evidence

The historical failure was the same app-rooted packet-path bug already documented for other app-owned approval packets: a packet stored only under the app workspace archive was being treated as outside `evidence/archive/` instead of being normalized to the repo-relative archive path.

Current repair evidence now shows the fix is present where the controller loads it:

1. `/app/projects/aks-rp-e2e.app/workflows/approval-dispatch.ts` normalizes packet repo paths against **both** `projectDir` and `appDir` before applying the `evidence/archive/` guard.
2. `/app/projects/aks-rp-e2e.app/.state/runtime-modules/_app_projects_aks-rp-e2e.app_workflows/approval-dispatch.ts` is byte-for-byte identical to the source workflow (`diff -u ...` returned no differences).
3. The targeted regression suite passes:

```text
cd /app/projects/aks-rp-e2e.app && bun test workflows/approval-dispatch.test.ts
3 pass
0 fail
```

That suite includes the app-rooted archive regression test for `path.rp-nodepool-lifecycle.rollback`.

## Direct local execution of the exact reviewed payload

I executed the current runtime-loaded workflow code locally with the same reviewed rollback packet tuple, using a stubbed `dispatchEvent()` to avoid emitting a real runtime event.

The workflow now returned:

```text
Approval dispatch emitted message.created for path.rp-nodepool-lifecycle.rollback using evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md.
```

The captured `message.created` payload contained the required lineage:

- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- content header `AKS RP E2E approval packet dispatch`
- `Feature path: path.rp-nodepool-lifecycle.rollback`
- `Packet: evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- reply contract for `project.approval.submitted`

So the repaired workflow no longer resolves this packet to `packet-outside-evidence-archive`; it resolves it to the required repo path and emits the expected approval lineage.

## Truthful wait confirmation

`tasks/tree.json` still shows `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` as:

- `state = blocked`
- the single maintained holder for `spec.rp-nodepool-lifecycle.rollback`
- `resume_condition = Resume only when the exact rollback-history escalation returns stronger same-surface evidence or owner/environment confirmation that makes one bounded rerun truthful for spec.rp-nodepool-lifecycle.rollback.`

No controller-visible operator answer currently supersedes that wait.

## Exact canonical event proposal for planner/app-ops

Planner/app-ops should re-emit the same reviewed event payload unchanged:

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

## Exact controller-visible verification contract after authorized re-dispatch

After planner/app-ops emits the payload above, reviewer should verify all of the following:

1. a later `events` row with `event_type = 'project.approval.requested'` and:
   - `params.packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
   - `params.pathId = path.rp-nodepool-lifecycle.rollback`
   - `params.target = human:operator`
2. a later `events` row with `event_type = 'message.created'` carrying the exact `approvalId` and `waitId` above
3. a matching `notification_messages` row, or approved equivalent controller-visible notification evidence, carrying the same `approvalId` / `waitId`
4. no change to `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` unless and until a returned `project.approval.submitted` operator answer creates a sharper successor

## Planner review conclusion

This worker session confirms the repair is present in the workflow code the runtime loads and that the exact reviewed payload now produces the expected approval-dispatch lineage under local execution. The only bounded remaining step is the authorized controller re-dispatch plus post-dispatch DB/notification verification.