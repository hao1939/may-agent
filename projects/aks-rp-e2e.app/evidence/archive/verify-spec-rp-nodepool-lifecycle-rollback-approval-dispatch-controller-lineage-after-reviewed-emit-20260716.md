# Verify rp-nodepool rollback approval-dispatch controller lineage after reviewed emit — 2026-07-16

Task: `verify-spec-rp-nodepool-lifecycle-rollback-approval-dispatch-controller-lineage-after-reviewed-emit-20260716`
Attempt: `a_verify-spec-rp-nodepool-lifecycle-rollback-approval-dispatch-controller-lineage-after-reviewed-emit-20260716_20260716191848`
Mode: Task Worker Mode

## Verdict

The reviewed `project.approval.requested` event **was emitted**, but the expected controller-visible approval-dispatch lineage was **not** created.

Instead, the first approval-dispatch workflow run after that emit ended with an ignore result:

- `events.id = 3341652` — `project.approval.requested`
- `events.id = 3341681` — `workflow.started` for `approval-dispatch`
- `events.id = 3341691` — `workflow.completed` with summary:
  - `Approval dispatch ignored: packetPath evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md must resolve inside evidence/archive/.`
- `.state/approval-dispatch-runs.jsonl` line 129 records:
  - `result = ignored`
  - `reason = packet-outside-evidence-archive`
  - `absolutePacketPath = /app/projects/aks-rp-e2e.app/evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

So the reviewed emit occurred, but the controller did not produce the expected downstream `message.created` / `notification_messages` proof for this approval lineage.

## Post-emission event evidence

Matching emitted event row:

- `events.id = 3341652`
- `event_type = project.approval.requested`
- `timestamp = 1784228684243`
- `status = pending`
- `delivery_status = accepted`
- `data.params.packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `data.params.pathId = path.rp-nodepool-lifecycle.rollback`
- `data.params.target = human:operator`

This satisfies the "reviewed emission happened" part of the investigation, but not the downstream lineage acceptance.

## Missing controller-visible lineage

Read-only DB checks after the emit found:

- matching `events` rows with `event_type = 'message.created'` for this packet / `approvalId` / `waitId`: **0**
- matching `notification_messages` rows for this packet / `approvalId` / `waitId`: **0**
- matching `events` rows with `event_type = 'project.approval.submitted'`: **0**

Exact expected lineage identifiers remain:

- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

Because all three downstream counts are still zero, there is no controller-visible approval dispatch, notification, or operator answer for this packet yet.

## Truthful wait remains unchanged

The live task tree still shows `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` as the exact holder for this branch.

Current task-tree facts from `.state/runtime-modules/_app_projects_aks-rp-e2e.app/tasks/tree.json`:

- `state = blocked`
- `goal = Preserve the exact pending frontier for spec.rp-nodepool-lifecycle.rollback as the maintained environment-blocked rollback lineage rather than reopening an unchanged rerun.`
- blocker condition says the 2026-07-16 blocked-frontier review revalidated that run `28696337959` still had no truthful unchanged rerun because rollback history remained absent before and after the bounded node-image upgrade.
- blocker resume condition says: `Resume only when the exact rollback-history escalation returns stronger same-surface evidence or owner/environment confirmation that makes one bounded rerun truthful for spec.rp-nodepool-lifecycle.rollback.`

I found no `project.approval.submitted` row or other controller-visible operator answer that supersedes this wait, so this hold remains the **single truthful wait**.

## Live-runtime mismatch worth preserving

The current source file `workflows/approval-dispatch.ts` appears intended to allow this app-owned packet path:

- app packet exists at `/app/projects/aks-rp-e2e.app/evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- a direct Node reproduction of the current `packetRepoPath()` logic resolves that absolute path relative to `/app/projects/aks-rp-e2e.app` as:
  - `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

But the live approval-dispatch run still recorded `packet-outside-evidence-archive` for that same absolute app path. Treat that as a runtime/controller mismatch or remaining repair gap; do not assume the reviewed repair has actually restored live dispatch behavior yet.

## Exact planner/app-ops follow-up proposal

Do **not** replace or widen `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`.

Planner/app-ops should add or apply a bounded repair that:

1. verifies why live approval-dispatch still classifies this app-owned packet as outside `evidence/archive/` even though the current source path logic appears to normalize it correctly,
2. restores live approval-dispatch so this packet resolves to repo path `evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`,
3. re-emits the same reviewed `project.approval.requested` payload for this packet unchanged after that repair,
4. then reruns lineage verification for:
   - `project.approval.requested`
   - `message.created`
   - `notification_messages`
   - and any later `project.approval.submitted`

Until that repair + re-emit happens, this task's original acceptance criteria cannot pass because the downstream controller-visible lineage does not exist.

## Bottom line

- reviewed emit exists: **yes**
- matching post-emit `message.created`: **no**
- matching `notification_messages`: **no**
- operator answer / sharper successor wait: **no**
- truthful wait remains: **hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707**
