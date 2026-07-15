# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3685`

- Date: 2026-07-14
- Owner: `app-ops`
- Final operation: `fix_root_cause`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3685`

## Why this is the right operation

This breach was real when sampled, not a stale-only alert. The latest offending snapshot for this alert recorded `value=1` and named one exact blocked task: `ops/wait-project-approval-owner-return-primary-blocker-20260713`.

The owner had already repaired that exact blocked wait in the immediately preceding owner session by restoring the missing blocked-wait observer contract and preserving it through future blocker text edits. After that repair, the persisted metric row returned to `current=0`, the alert auto-resolved, and a fresh live recompute still shows no offenders.

Because the alert came from a real blocked-contract regression on an app-ops-owned wait and the root cause was actually corrected, the correct final operation is `fix_root_cause`.

## Evidence checked

### 1) The alert and snapshot identified one concrete offender

Runtime DB facts checked during this triage:

- `metric_alerts.id=3685` has `created_at=1784046692838` and `resolved_at=1784047005533`
- `metrics.id='aks-rp-e2e.process.blocked.missing-observer-count'` now shows `current=0`, `threshold=0`, `target=0`, `priority='P0'`, `updated_at=1784046997660`
- latest snapshots show:
  - `1784046997660` → `value=0`, offenders `[]`
  - `1784046681854` → `value=1`, offenders `["ops/wait-project-approval-owner-return-primary-blocker-20260713"]`

That proves the breach was concrete and task-specific, then later recovered.

### 2) The offending blocked wait now has the required observer contract in the live runtime tree

Direct inspection of `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` for `ops/wait-project-approval-owner-return-primary-blocker-20260713` now shows:

- `blocker.waiting_for.type = "project.approval.submitted"`
- non-empty `blocker.observed_by`
- non-empty `blocker.observation_method`
- non-empty `blocker.next_check_at`

Those are the exact fields this metric requires.

### 3) A fresh live recompute still returns healthy state

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Returned:

```json
{"measuredAt":1784047101531,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

So the live source of truth remains healthy after the automatic alert recovery.

### 4) The owner session that repaired this breach restored the exact wait contract and added regression coverage

`/app/projects/aks-rp-e2e.app/agents/app-ops/last-session.md` records that session `s_1784046827485_16`:

- restored the exact blocked wait metadata on `ops/wait-project-approval-owner-return-primary-blocker-20260713`
- patched `projects/may-agent/packages/sdk/src/project-task-tree.ts`
- added regression coverage in:
  - `projects/may-agent/packages/sdk/src/project-task-tree.test.ts`
  - `projects/aks-rp-e2e.app/scripts/task-tree.test.ts`

The relevant current source confirms the hardening:

- `sanitizeStructuredBlockerPatch()` in `projects/may-agent/packages/sdk/src/project-task-tree.ts` now drops null `waiting_for` / `observed_by` patch inputs instead of erasing existing structured wait metadata.
- `projects/may-agent/packages/sdk/src/project-task-tree.test.ts` contains a regression test: `structured blocker updates ignore null wait-target patches and preserve the existing structured wait metadata`.
- `projects/aks-rp-e2e.app/scripts/task-tree.test.ts` contains a regression test showing `update-text` preserves `waiting_for` and `observed_by` on approval waits.

## Judgment

Choose **`fix_root_cause`**.

Why not the other operations:

- Not `resolve_stale`: the offending snapshot was real and named a concrete blocked task; the right response was to repair that task and preserve the contract.
- Not `waiting_with_evidence`: the owner did not merely wait; the blocked wait metadata was restored and guarded against recurrence.
- Not `calibrate_metric`: the metric correctly detected a missing observer contract.
- Not `downgrade_priority`: this was a real process-integrity regression on a blocked wait.
- Not `upgrade_or_escalate`: no destructive action or human-only policy decision was needed.
- Not `document_exception`: no exception is being accepted.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle after this judgment. Expected outcome: `aks-rp-e2e.process.blocked.missing-observer-count` stays at `0` and future snapshots continue to report `offenderTaskIds=[]` unless a new blocked wait loses its observer contract.