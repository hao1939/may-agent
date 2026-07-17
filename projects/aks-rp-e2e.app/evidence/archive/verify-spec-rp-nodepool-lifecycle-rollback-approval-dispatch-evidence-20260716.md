# Verify rollback approval-dispatch evidence — 2026-07-16

Task: `verify-spec-rp-nodepool-lifecycle-rollback-approval-dispatch-evidence-20260716`
Attempt: `a_verify-spec-rp-nodepool-lifecycle-rollback-approval-dispatch-evidence-20260716_20260716190445`
Mode: Task Worker Mode

## Verdict

The accepted `project.approval.requested` event **was emitted** for the rollback packet, but the approval-dispatch workflow **did not create** the expected `message.created` or `notification_messages` lineage.

Instead, controller-visible evidence shows the dispatch workflow ignored the packet before notification emission because the packet resolved to the app workspace (`/app/projects/aks-rp-e2e.app/evidence/archive/...`) and the workflow currently validates `repoPacketPath` only relative to the domain workspace (`/app/projects/aks-rp-e2e`).

So this task can verify the send attempt and the exact failure mode, but it cannot truthfully claim matching message/notification rows exist yet.

## Controller-visible evidence

### 1) Accepted `project.approval.requested` row exists

Runtime DB row:

- `events.id = 3341652`
- `event_type = project.approval.requested`
- `source = agent:aks-explorer`
- `owner = agent:app-ops`
- `status = pending`
- `delivery_status = accepted`
- `params.packetPath = evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `params.pathId = path.rp-nodepool-lifecycle.rollback`
- `params.target = human:operator`

This satisfies the event-emitted portion of the acceptance contract.

### 2) Derived approval lineage for the packet

From the packet and the approval-dispatch contract, the intended lineage remains:

- `approvalId = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `waitId = wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
- `correlationKey = aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`

### 3) No matching `message.created` evidence exists

Read-only DB checks after event `3341652` found:

- `0` rows in `events` with `event_type = message.created` in the approval-dispatch window for this packet
- no `message.created` row carrying the rollback packet path, approval id, or wait id

### 4) No matching `notification_messages` evidence exists

Read-only DB checks after event `3341652` found:

- `0` rows in `notification_messages` in the approval-dispatch window for this packet
- no notification row carrying the rollback packet path, approval id, or wait id

### 5) Controller-visible failure evidence explains the missing lineage

Runtime DB row:

- `events.id = 3341691`
- `event_type = workflow.completed`
- `source = workflow:approval-dispatch`
- `owner = agent:aks-explorer`
- `summary = "Approval dispatch ignored: packetPath evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md must resolve inside evidence/archive/."`

This is the controller-visible reason no `message.created` or notification row followed the accepted approval request.

## Primary-source diagnosis

`workflows/approval-dispatch.ts` shows the failure mechanism:

1. `packetAbsolutePath()` accepts packets from either the domain workspace or the app workspace.
2. For this packet, the existing file is:
   - `/app/projects/aks-rp-e2e.app/evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md`
3. `packetRepoPath()` then relativizes only against `projectDir` (the domain workspace `/app/projects/aks-rp-e2e`).
4. Because the packet lives under the app workspace instead of the domain workspace, `repoPacketPath` becomes an absolute path rather than `evidence/archive/...`.
5. The guard at `workflows/approval-dispatch.ts:223` rejects the dispatch unless `repoPacketPath.startsWith("evidence/archive/")`.

So the event lane accepted the request, but the workflow's path-normalization rule treats this app-owned evidence packet as outside the allowed archive root and exits before `ctx.dispatchEvent("message.created", ...)`.

## Hold/wait truth check

`bun run task-tree show hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` still shows the exact live blocked holder and preserves:

- state: `blocked`
- same rollback lineage / same spec family
- resume condition: resume only when the rollback-history escalation returns stronger same-surface evidence or owner/environment confirmation that makes one bounded rerun truthful
- next/fallback watch window already advanced into 2026-07-17 / 2026-07-18

No operator answer was emitted here, so **`hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the single truthful wait**.

## Planner/app-ops follow-up proposal

This verification task should be treated as **partial**, not blocked:

- the emitted approval request is verified,
- the missing `message.created` / `notification_messages` lineage is explained by controller-visible workflow evidence,
- and the next bounded action is now exact.

### Exact follow-up the planner should add

Create one bounded app-ops repair/retry successor that:

1. fixes approval-dispatch path normalization so packets rooted under `/app/projects/aks-rp-e2e.app/evidence/archive/` are normalized to `evidence/archive/...` instead of being rejected as outside the archive, or otherwise truthfully aligns the packet location with the workflow contract;
2. re-emits the same `project.approval.requested` payload for `path.rp-nodepool-lifecycle.rollback`; and
3. re-verifies the resulting `message.created` and `notification_messages` lineage for the derived `approvalId` / `waitId` above.

### Exact recheck conditions after the repair/re-dispatch

Accept only when all of the following become true:

- an `events` row still exists for `project.approval.requested` with the same packet/path/target values;
- a matching `message.created` row exists for the derived `approvalId` and `waitId`;
- a matching `notification_messages` row (or approved controller-visible equivalent notification evidence) exists for the same lineage; and
- `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` remains the single truthful wait unless a returned operator answer creates a sharper successor.
