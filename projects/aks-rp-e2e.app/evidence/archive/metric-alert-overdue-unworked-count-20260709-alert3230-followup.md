# Metric alert follow-up — `aks-rp-e2e.process.blocked.overdue-unworked-count` (alert 3230)

- Alert id: `3230`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Follow-up task: `ops-refresh-overdue-owner-response-waits-alert-3230-20260709`
- Reviewed at: `2026-07-09T18:00:05Z`
- Scope: overdue blocked owner-response waits under `aks-spec-verification-loop`

## Judgment

This alert is now actively covered, but only because the current app-ops recovery task exists.

Per the worker-mode baseline rule, the contributor set below is computed **as if this audit/recovery task did not exist**.

## Pre-audit contributor set (excluding the current recovery task)

These two blocked waits were the exact overdue/unworked contributors flagged by alert 3230:

1. `wait-spec-network-acns-hubble-contract-owner-response-20260708`
2. `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

Why they qualify in the baseline:

- both are leaf tasks in state `blocked` under `aks-spec-verification-loop`;
- both have `resume_at = 2026-07-09T06:00:00Z` and `fallback_at = 2026-07-09T06:03:47.136Z`, which are already past;
- no other active/review task besides the current recovery task covers them by exact task id or by `ops:blocked-overdue:spec-loop` conflict scope.

So the truthful pre-audit baseline is:

- baseline overdue-unworked count: `2`
- baseline offender task ids:
  - `wait-spec-network-acns-hubble-contract-owner-response-20260708`
  - `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

## Post-action represented set

The same two waits are now represented by one active app-ops recovery task:

- active task: `ops-refresh-overdue-owner-response-waits-alert-3230-20260709`
- task context explicitly lists both blocked task ids
- task conflict scope is `ops:blocked-overdue:spec-loop`

That makes this task a valid covering recovery surface for both waits under the current metric logic.

A fresh live recompute now returns:

```json
{"measuredAt":1783577476234,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Exact owner surfaces and evidence paths

### 1) Network ACNS Hubble contract wait

Blocked wait:
- `wait-spec-network-acns-hubble-contract-owner-response-20260708`

Exact owner surface:
- `human:operator`

Durable evidence path:
- `/app/projects/aks-rp-e2e/evidence/archive/ops-send-network-acns-hubble-contract-owner-packet-20260708.md`

What that packet already asked for:
- one bounded owner/operator outcome for the six-spec Hubble-contract family;
- either keep the mounted `hubble-ui` / `hubble_` expectations as accepted contract and wait for same-surface product recovery,
- or approve contract/source/model narrowing before any rerun,
- or return one exact decline/reroute naming the replacement owner surface.

Send-proof recorded in that evidence file:
- `project.approval.requested` accepted
- approval-dispatch ledger row with `result: message.created`
- `message.created` accepted to `human:operator`

### 2) CCP security-patch reviewed-exception wait

Blocked wait:
- `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

Exact owner surface:
- `human:operator` routing to the responsible CCP source-authority surface

Durable evidence path:
- `/app/projects/aks-rp-e2e/evidence/archive/ops-send-ccp-security-patch-owner-packet-20260708.md`

What that packet already asked for:
- one bounded owner/source-authority decision for
  - `spec.ccp-security-patch.mariner-v2-prod-mtc`
  - `spec.ccp-security-patch.windows2022-prod-mtc`
  - `spec.ccp-security-patch.windows2025-prod-mtc`
- either identify truthful source-authorized carriers / replacement contracts,
- or explicitly confirm the fail-closed reviewed-exception posture,
- or return one exact reroute naming the replacement owner surface.

Send-proof recorded in that evidence file:
- `project.approval.requested` accepted
- approval-dispatch ledger row with `result: message.created`
- `message.created` accepted to `human:operator`

## Fresh response audit as of this follow-up

Current controller-visible state still shows both waits as blocked with no recorded terminal response fields (`result`, `review_summary`, `acceptance_note`, `summary` are all empty on the wait tasks).

A fresh evidence search found the send-proof packets above, plus older analysis packets, but no new returned owner-response artifact for either exact 2026-07-08 handoff.

So the truthful state is:

- send-proof exists for both waits;
- no controller-visible reply is yet recorded for either wait;
- the missing process piece was active app-ops coverage, which is now provided by this task.

## Exact active recovery / escalation posture

This current task is the single truthful active app-ops recovery surface for both waits.

Exact next action for planner/app-ops review:
1. keep `ops-refresh-overdue-owner-response-waits-alert-3230-20260709` as the active coverage task for these two waits;
2. on the next blocked-frontier review, check for one returned outcome matching either packet:
   - `ops-send-network-acns-hubble-contract-owner-packet-20260708.md`
   - `ops-send-ccp-security-patch-owner-packet-20260708.md`
3. if still no reply is recorded, reuse those exact packet paths for a renewed owner/operator chase or one sharper escalation task; do not reopen unchanged reruns.

Recommended next review timing:
- next blocked-frontier app-ops review after `2026-07-09T18:00:05Z`
- if still silent, escalate by the next day-owner review window rather than allowing either wait to return to unworked overdue state.

## Bottom line

Alert 3230 named two real overdue owner-response waits. Baseline, excluding the current audit task, they would still contribute `2` overdue-unworked offenders. With the current task active, both waits are now represented by one exact app-ops recovery surface, and the live metric recompute is back to `0` with no offender ids.
