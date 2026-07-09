# Metric alert follow-up — `aks-rp-e2e.process.blocked.overdue-unworked-count` (alert 3234)

- Alert id: `3234`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Follow-up task: `ops-refresh-overdue-owner-response-waits-alert-3234-20260709`
- Reviewed at: `2026-07-09T18:00:05Z`
- Scope: overdue blocked owner-response waits under `aks-spec-verification-loop`

## Judgment

This alert is now actively covered, but only because the current app-ops recovery task exists.

Per the worker-mode baseline rule, the contributor set below is computed **as if this audit/recovery task did not exist**.

## Pre-audit contributor set (excluding the current recovery task)

These two blocked waits were the exact overdue/unworked contributors flagged by alert 3234:

1. `wait-spec-network-acns-hubble-contract-owner-response-20260708`
2. `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

Why they qualify in the baseline:

- both are leaf tasks in state `blocked` under `aks-spec-verification-loop`;
- both still preserve the original spec-loop blocked-overdue family shape and remain valid external waits;
- both have `resume_at = 2026-07-09T06:00:00Z` and `fallback_at = 2026-07-09T06:03:47.136Z`, which are already past;
- neither blocked wait has terminal response fields populated (`result`, `review_summary`, `acceptance_note`, `summary` are all still empty on the wait tasks);
- if the current recovery task is excluded, no other active/review task covers them by exact task id or by the shared conflict scope `ops:blocked-overdue:spec-loop`.

So the truthful pre-audit baseline is:

- baseline overdue-unworked count: `2`
- baseline offender task ids:
  - `wait-spec-network-acns-hubble-contract-owner-response-20260708`
  - `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

## Exact blocked waits preserved by this recovery surface

### 1) Network ACNS Hubble contract wait

Blocked wait:
- `wait-spec-network-acns-hubble-contract-owner-response-20260708`

Conflict scope on the blocked wait remains:
- `spec-loop-followup:error:network-acns`

Blocked-wait contract preserved in tree state:
- owner: `human`
- category: `external-wait`
- resume condition: one exact `human:operator` outcome for the six-spec Hubble-contract family
- fallback action: create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence

Durable send-proof evidence path already linked by the wait:
- `/app/projects/aks-rp-e2e/evidence/archive/ops-send-network-acns-hubble-contract-owner-packet-20260708.md`

What that packet already asked for:
- one bounded owner/operator outcome for the six-spec Hubble-contract family;
- either keep the mounted `hubble-ui` / `hubble_` expectations as accepted contract and wait for same-surface product recovery,
- or approve contract/source/model narrowing before any rerun,
- or return one exact decline/reroute naming the replacement owner surface.

Recorded send-proof in that evidence file:
- accepted `project.approval.requested`
- approval-dispatch ledger row with `result: message.created`
- accepted `message.created` routed to `human:operator`

### 2) CCP security-patch reviewed-exception wait

Blocked wait:
- `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

Conflict scope on the blocked wait remains:
- `spec-loop-followup:pending:ccp-security-patch`

Blocked-wait contract preserved in tree state:
- owner: `human`
- category: `external-wait`
- resume condition: one exact owner/source-authority outcome for MarinerV2, Windows2022, and Windows2025
- fallback action: create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence

Durable send-proof evidence path already linked by the wait:
- `/app/projects/aks-rp-e2e/evidence/archive/ops-send-ccp-security-patch-owner-packet-20260708.md`

What that packet already asked for:
- one bounded owner/source-authority decision for
  - `spec.ccp-security-patch.mariner-v2-prod-mtc`
  - `spec.ccp-security-patch.windows2022-prod-mtc`
  - `spec.ccp-security-patch.windows2025-prod-mtc`
- either identify truthful source-authorized carriers / replacement contracts,
- or explicitly confirm the fail-closed reviewed-exception posture,
- or return one exact reroute naming the replacement owner surface.

Recorded send-proof in that evidence file:
- accepted `project.approval.requested`
- approval-dispatch ledger row with `result: message.created`
- accepted `message.created` routed to `human:operator`

## Post-action represented set

The same two waits are now represented by one active app-ops recovery task:

- active task: `ops-refresh-overdue-owner-response-waits-alert-3234-20260709`
- task state: `active`
- task owner: `app-ops`
- task conflict scope: `ops:blocked-overdue:spec-loop`
- task context explicitly lists both blocked task ids:
  - `wait-spec-network-acns-hubble-contract-owner-response-20260708`
  - `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

That makes this task the single truthful app-ops recovery surface for both waits while the owner-response gap remains unresolved.

## Fresh response audit at review time

Current controller-visible state still shows both waits as blocked with no recorded returned owner response. The waits continue to point at the existing 2026-07-08 send-proof packets above, and no newer terminal owner artifact is linked from either blocked leaf.

So the truthful state is:

- send-proof exists for both waits;
- no controller-visible reply is yet recorded for either exact 2026-07-08 handoff;
- the missing process piece was active app-ops coverage, which is now restored by this task.

## Metric validation

### Baseline breach evidence from triage

The earlier root-cause triage for alert 3234 recorded a pre-repair recompute of:

```json
{"measuredAt":1783578657504,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"offenderTaskIds\":[\"wait-spec-network-acns-hubble-contract-owner-response-20260708\",\"wait-ccp-security-patch-reviewed-exception-owner-response-20260708\"]}"}
```

That matches the self-excluded baseline contributor set above.

### Fresh recompute while this recovery surface is active

A local recompute during this session returned:

```json
{"measuredAt":1783578779708,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

This satisfies the acceptance requirement that the active recovery surface drives `aks-rp-e2e.process.blocked.overdue-unworked-count` back to `0` while the task remains active.

### Runtime metric row lag note

The persisted `metrics` table row still shows `current = 2` for this metric, so the database copy is a lagging snapshot until the next `metrics-snapshot` refresh. The live local sampler above is the correct verification of current tree-state coverage.

## Exact next action for planner/app-ops review

1. Keep `ops-refresh-overdue-owner-response-waits-alert-3234-20260709` as the single active coverage task for these two waits.
2. On the next blocked-frontier review, check for one returned outcome matching either packet:
   - `ops-send-network-acns-hubble-contract-owner-packet-20260708.md`
   - `ops-send-ccp-security-patch-owner-packet-20260708.md`
3. If still no reply is recorded, sharpen the external chase/escalation successor from these exact packets rather than reopening unchanged reruns.
4. Do not roll up this recovery surface until either:
   - fresh owner-response evidence lands,
   - a sharper external chase/escalation successor is active,
   - or the waits themselves are replaced by a more exact truthful holder.

## Bottom line

Alert 3234 named two real overdue owner-response waits. Baseline, excluding the current audit task, they still contribute `2` overdue-unworked offenders. With `ops-refresh-overdue-owner-response-waits-alert-3234-20260709` active and carrying `ops:blocked-overdue:spec-loop`, both waits are now represented by one exact app-ops recovery surface, and a fresh live recompute is back to `0` with no offender ids.