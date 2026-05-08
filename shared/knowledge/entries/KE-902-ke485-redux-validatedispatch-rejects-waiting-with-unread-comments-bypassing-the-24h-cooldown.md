# KE-902: KE-485 redux — validateDispatch rejects `waiting` with unread comments, and master-worker escalates instead of skipping (5 escalations from one project in <4h)

<!-- metrics: project.iterations-24h, escalation-rate -->

**Date:** 2026-05-08 ~09:35Z
**Author:** arc (heartbeat session)
**Confidence:** High — code paths traced end-to-end, escalation cluster reproducible against current DB.
**Connects:** KE-485 (closed-with-unread-comments same shape, fixed for `closed` only), KE-484 (skill-workflow-audit mystery), KE-449/450 (out-of-lane edits — fix proposal not landed here).

## Observation

5 `escalation.created` events in the last 4h, all from `may`, all with the same reason:

```
Dispatch validation failed:
Project status is 'waiting' — not dispatchable
Project stopped: Auto-waiting: 3 consecutive iterations with no clear orchestrator decision. Project may be complete.
```

Cluster: 05:46Z, 06:32Z, 07:15Z, 07:46Z, 09:28Z (every 30–90 min).

The offending project is `shared/projects/v2-spec-coverage-buildout/project.md`:

```yaml
status: waiting
iteration: 3
stop_reason: Auto-waiting: 3 consecutive iterations with no clear orchestrator decision. Project may be complete.
```

It also has a `## Comments` section with one unread comment from dev (2026-05-07).

## The disagreement, in two files (same shape as KE-485)

`agents/shared/lib/project-health.ts:229-247` says: if status is
`waiting` or `blocked` **and** there are unread comments
(discussion.md after `---read @` marker, or `## Comments` section),
return `launch-workflow` with reason `${status} with unread comments`.

`agents/shared/workflows/dispatch-validator.ts:72-78` then
unconditionally rejects:

```ts
const nonDispatchable = ["closed", "paused", "cancelled", "blocked", "waiting"];
if (nonDispatchable.includes(status)) {
  result.valid = false;
  result.errors.push(`Project status is '${status}' — not dispatchable`);
}
```

`agents/shared/workflows/master-worker.ts:515-518` calls
`validateDispatch` and on failure invokes `ctx.escalate(...)` — i.e.
emits `escalation.created` to the human inbox.

KE-485 fixed exactly this for `status=closed` (master-worker has
special handling for `closed` with unread discussion.md at
master-worker.ts:543+). The fix never propagated to `waiting`/`blocked`,
even though project-health treats both branches symmetrically.

## Why the 24h cooldown doesn't catch it

`project-health.ts:18` defines `ESCALATION_COOLDOWN_MS = 24h` and
`:254` enforces it — but **only on the project-health
`escalate` path** (the time-based one at `:260,263`). When
project-health emits `launch-workflow` and master-worker
ends up calling `ctx.escalate` from the validator failure, no
`healthState.lastEscalation` field is updated. The cooldown is bypassed
entirely. Result: 5 escalations from one project inside the supposed
1/day budget.

## Two-line fingerprint (reproducible against current DB)

```sql
-- current escalation cluster
SELECT datetime(timestamp/1000,'unixepoch') t, substr(data,1,200)
FROM events
WHERE event_type='escalation.created'
  AND data LIKE '%not dispatchable%'
  AND data LIKE '%waiting%'
  AND timestamp > strftime('%s','now')*1000 - 86400000
ORDER BY timestamp DESC;
```

Returns 5 rows as of 2026-05-08 09:35Z, all `may` agent, all
v2-spec-coverage-buildout shape.

## Why this matters

1. **Cooldown bypass is the load-bearing claim of project-health's
   escalation budget.** If validateDispatch can re-escalate a project
   every cron tick (~30min), the "max 1 human escalation per project per
   day" guarantee is broken.
2. **The escalation reason is misleading to the human.** "not
   dispatchable" reads as "I tried to dispatch this but couldn't" — the
   actual situation is "project-health *told* me to dispatch this and
   the validator overrode it." The human can't act on the surface
   message; they have to know to read the comment thread.
3. **It will keep firing until project status changes.** Each cron
   iteration: project-health sees waiting+comment → launch-workflow →
   validator rejects → escalate. No state advances. Pure busy loop with
   user-visible noise.

## Recommended fix (proposal, not landed)

Either:

(a) **Validator-side:** teach `validateDispatch` to accept
`waiting`/`blocked` when an unread-comments check passes. This mirrors
the `closed` exemption that KE-485 documented as living in
master-worker.ts:543+.

(b) **Caller-side:** in master-worker.ts:516, when the validator
rejects with the `waiting`+stop-reason combo, check for unread
comments before escalating. If unread, treat as a comment-driven
re-launch (same as the `closed` branch already does).

(c) **Cheapest band-aid:** in master-worker.ts before calling
`ctx.escalate`, update `healthState.projects[relPath].lastEscalation =
now` so the 24h cooldown actually applies to validator-failure
escalations too. This doesn't fix the root cause but stops the burst.

(a) is cleanest because the validator is the authoritative gate; the
project-health "can launch" check should not be telling the workflow
something the workflow then refuses. (c) is a P2 safety net regardless
of which root fix is chosen.

## Lane note

Per arc heartbeat priority-0 lane check: the relevant code lives in
`shared/workflows/` and `shared/lib/` — both **out of arc's lane**.
Fix not applied. This KE is the durable record; a proposal will follow
in `agents/arc/workspace/proposals/` for the queue.

## Falsifiers

- F1: If by 2026-05-09 09:30Z the same `not dispatchable / waiting /
  Auto-waiting` escalation is still firing at >1/6h cadence,
  confirms (a) the busy loop is steady-state, (b) cooldown bypass is
  real, not a one-off.
- F2: If the v2-spec-coverage-buildout project flips to `active` (e.g.
  human reads the comment) and the cluster stops, confirms the
  comment-thread is the trigger — fix path (a)/(b) is correct.
- F3: If a *different* project enters waiting+comment state and
  immediately starts emitting the same cluster, confirms this is
  generic to the validator branch, not specific to v2-spec-coverage.
