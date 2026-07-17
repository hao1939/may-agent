# Repair app-rooted approval-dispatch packet normalization — 2026-07-16

Task: `repair-spec-rp-nodepool-lifecycle-rollback-approval-dispatch-app-packet-path-20260716`
Attempt: `a_repair-spec-rp-nodepool-lifecycle-rollback-approval-dispatch-app-packet-path-20260716_20260716190931`
Mode: Task Worker Mode

## Result

I repaired the `approval-dispatch` workflow so an approval packet that exists only under the app workspace archive (`/app/projects/aks-rp-e2e.app/evidence/archive/...`) now normalizes to the repository packet path `evidence/archive/...` instead of being rejected as outside the archive.

Because Task Worker Mode forbids this session from emitting runtime/project events, I did **not** re-emit `project.approval.requested` from this worker. The remaining bounded step is for planner/app-ops to emit the already-reviewed payload again and then verify the controller-visible `message.created` and `notification_messages` lineage for the same derived approval tuple.

`hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` still remains the single truthful wait unless an operator answer creates a sharper successor.

## Baseline before the repair

Primary-source evidence collected before editing showed the exact failure mode for the already-accepted approval request:

- runtime `events` row `3341652` exists with `event_type = project.approval.requested`, `delivery_status = accepted`, `params.packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`, `params.pathId = path.rp-nodepool-lifecycle.rollback`, and `params.target = human:operator`
- runtime `events` row `3341691` exists with `event_type = workflow.completed`, `source = workflow:approval-dispatch`, and summary:
  - `Approval dispatch ignored: packetPath evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md must resolve inside evidence/archive/.`
- `.state/approval-dispatch-runs.jsonl` line `129` records the same ignored dispatch with:
  - `result = ignored`
  - `reason = packet-outside-evidence-archive`
  - `absolutePacketPath = /app/projects/aks-rp-e2e.app/evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- no controller-visible send lineage exists yet for the rollback packet:
  - `events` query for `message.created` by packet path / approval id / wait id returned `0 rows`
  - `notification_messages` query for the same tuple returned `0 rows`

## Root cause

`workflows/approval-dispatch.ts` already resolved packet files from either workspace, but `packetRepoPath()` only relativized against the domain workspace root (`projectDir`).

So when the packet existed only at:

- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

it produced an absolute `repoPacketPath` instead of `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`, and the existing archive guard correctly rejected that absolute path.

## Repair applied

Updated `/app/projects/aks-rp-e2e.app/workflows/approval-dispatch.ts` so `packetRepoPath()` now:

1. resolves the packet path once;
2. tries both `projectDir` and `appDir` as normalization roots;
3. returns the first safe repo-relative path contained inside one of those roots; and
4. still falls back to the absolute path when neither root contains the file, preserving the existing `evidence/archive/` guard.

This keeps archive validation intact while allowing app-owned archive packets to normalize to the same repo-relative `evidence/archive/...` contract used by the approval lineage.

## Regression test added

Added a new Bun test in `/app/projects/aks-rp-e2e.app/workflows/approval-dispatch.test.ts` that writes an approval packet only under the app workspace archive, passes the **absolute** app-workspace packet path into the trigger, and verifies that `approval-dispatch`:

- emits `message.created`
- preserves `packetAbsolutePath` pointing at the app workspace file
- normalizes `packetPath` to repo-relative `evidence/archive/app-rooted-approval-packet.md`
- derives the expected approval id / wait id from that normalized path
- records `result = message.created` in `.state/approval-dispatch-runs.jsonl`

## Verification

### Baseline test before the change

`cd /app/projects/aks-rp-e2e.app && bun test workflows/approval-dispatch.test.ts`

Result before editing: `2 pass, 0 fail`

### Post-change test after the repair

`cd /app/projects/aks-rp-e2e.app && bun test workflows/approval-dispatch.test.ts`

Result after editing: `3 pass, 0 fail`

The new app-rooted packet test passed, proving the normalization repair works in workflow code.

## Current controller-visible state after the code repair

No event was emitted from this worker session, so the runtime evidence for the rollback packet is intentionally unchanged right now:

- matching `message.created` rows for the rollback packet tuple: `0`
- matching `notification_messages` rows for the rollback packet tuple: `0`

That is expected until an authorized planner/app-ops step re-emits the reviewed approval request.

## Exact approval tuple to verify after authorized re-dispatch

- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

## Exact canonical re-dispatch proposal for planner/app-ops

Planner/app-ops should re-emit the same approval request payload already reviewed in the escalation packet, unchanged:

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

## Exact controller-visible checks after authorized re-dispatch

After planner/app-ops emits the payload above, recheck all of the following:

1. `events` contains a later `project.approval.requested` row for:
   - `params.packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
   - `params.pathId = path.rp-nodepool-lifecycle.rollback`
   - `params.target = human:operator`
2. `events` contains a matching `message.created` row carrying the derived `approvalId` and `waitId`
3. `notification_messages` contains a matching row, or approved equivalent controller-visible notification evidence, carrying the same tuple
4. `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the single truthful wait unless an operator response supersedes it

## Wait truth check

Read-only `task-tree show` still reports `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` as:

- `state = blocked`
- same rollback family holder
- `resume_condition = Resume only when the exact rollback-history escalation returns stronger same-surface evidence or owner/environment confirmation that makes one bounded rerun truthful for spec.rp-nodepool-lifecycle.rollback.`

So this repair changes the dispatch plumbing only. It does **not** replace or relax the existing truthful blocked frontier.
