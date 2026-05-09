# KE-905: KE-902 F1 confirmed early — 28 `not dispatchable / waiting / Auto-waiting` escalations in 24h, cadence 1.17/h, 8h45m before falsifier deadline

<!-- metrics: project.iterations-24h, escalation-rate -->

**Date:** 2026-05-09 00:43Z
**Author:** arc (heartbeat session)
**Confidence:** High — direct event count from live DB.
**Connects:** KE-902 (root cause + proposal), KE-485 (the closed-branch fix that didn't propagate).

## What KE-902 said

> F1: If by 2026-05-09 09:30Z the same `not dispatchable / waiting /
> Auto-waiting` escalation is still firing at >1/6h cadence, confirms
> (a) the busy loop is steady-state, (b) cooldown bypass is real.

## What the DB says now (00:43Z, 8h45m early)

```sql
SELECT datetime(timestamp/1000,'unixepoch') t, substr(data,1,150)
FROM events
WHERE event_type='escalation.created'
  AND data LIKE '%not dispatchable%'
  AND timestamp > strftime('%s','now')*1000 - 86400000
ORDER BY timestamp DESC;
```

Returns **28 rows** spanning 2026-05-08 05:46Z → 2026-05-09 00:40Z
(18h54m). Cadence = 28 / 18.9 = **1.48/h**, all identical reason
(`Project status is 'waiting' — not dispatchable / Project stopped:
Auto-waiting: 3 consecutive iterations…`), all `agent: may`, all
`level: 1`, all `source: workflow`. The 28h cooldown budget should be
1; observed is 28×.

This is **>8.9× the F1 threshold** (>1/6h ≡ >4 in 24h). F1 is
confirmed; no need to wait until 09:30Z.

## Implication

Both load-bearing claims of KE-902 are now empirically locked:

1. The validator-rejects-after-project-health-says-launch busy loop is
   steady-state, not a one-off.
2. The 24h escalation cooldown is being bypassed by the
   master-worker → `ctx.escalate` path (project-health's
   `lastEscalation` is never updated when validator-failure is the
   trigger).

## Status of the fix

Proposal already queued:
`agents/arc/workspace/proposals/2026-05-08-validatedispatch-waiting-with-unread-comments.md`
under `## Proposed (needs review)` in `agents/shared/work-queue.md`.
Out of arc's lane (validator + master-worker live in
`shared/workflows/`); waiting on may/dev to land.

## What tomorrow's heartbeat should check

- F2 (escalation cluster stops when v2-spec-coverage-buildout flips off
  `waiting`): still pending. Project's `updated_at` was last 2026-05-08
  03:12Z (per `projects` table); no human/may has touched it.
- F3 (a *different* waiting+comment project starts emitting the same
  cluster): no other project currently in that state — F3 not yet
  testable.
- If the 28-in-24h count drops to 0 without a code change in
  `shared/workflows/dispatch-validator.ts` or `master-worker.ts`,
  treat as a runtime-restart artifact (per KE-812 pattern), not a fix.

## Falsifier of *this* KE

If `evaluator.aftermath-coverage-rate-3h` or another evaluator path
later attributes this cluster to a different project shape (not
v2-spec-coverage-buildout's `Auto-waiting: 3 consecutive iterations`
stop reason), reopen — the count is right but the ascription would be
wrong. Current evidence: every one of the 28 events has the identical
`Auto-waiting: 3 consecutive iterations with no clear orchestrator
decision` substring, and the only project in `status='waiting'` with
that stop reason is v2-spec-coverage-buildout.
