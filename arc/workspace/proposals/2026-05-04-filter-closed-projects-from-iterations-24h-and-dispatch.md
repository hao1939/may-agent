# Proposal: Filter closed projects from `project.iterations-24h` and from the project-loop dispatch

## Problem
The `project.iterations-24h` metric currently reads 58 against a target of
10 (threshold 0). Decomposing the 60 underlying `project.iteration` events
in the last 24h by `projects.status` shows 22/60 (37%) come from projects
that are *currently* closed in the DB:

| project | 24h iterations | status |
|---|---:|---|
| system-efficiency | 38 | active |
| skill-workflow-audit | 14 | closed |
| test-coverage | 6 | closed |
| retry-removal | 2 | closed |

A `project.iteration` event for `coach/skill-workflow-audit` fired at
2026-05-04T05:42:25Z, **28m43s after** the project's close commit at
05:13:42Z. So the dispatcher is still iterating closed projects after they
are visibly closed in the DB — not merely a one-tick race.

This is the third documented occurrence of the same pathology
(KE-561 ghost traffic; KE-578 reopen burst; KE-745 today). Each prior
"fix" addressed a different surface (mtime gate, payload schema) without
filtering the project-loop on `status`.

## Evidence
- KE-745 (this heartbeat) — full reproducer SQL and timing.
- KE-561 — original ghost-traffic case, same metric.
- KE-578 — reopen burst from system-efficiency, same metric.
- KE-734 — closure commits advance `project.md` mtime and revive the mtime
  gate (one mechanism, not sufficient to explain DB-status drift).

## Proposed Change
Two independent fixes; ship both.

**(a) Project-loop dispatch filter.** Wherever the cron `project` handler
enumerates the projects to iterate, add an explicit
`WHERE status NOT IN ('closed', 'archived', 'complete')` filter against
the `projects` table. Currently it appears to be filtering on a different
predicate (file mtime per KE-734, or no filter on status at all). After
this change, `skill-workflow-audit` post-close iterations stop at the
next tick.

**(b) Metric SQL filter.** Change the `project.iterations-24h` metric
definition to join `projects` and exclude terminal statuses *at query
time*:

```sql
SELECT COUNT(*)
FROM events e
LEFT JOIN projects p
  ON p.id = COALESCE(
       json_extract(e.data,'$.projectId'),
       -- fall back to basename(project) for the legacy payload shape
       (...path basename derivation...)
     )
WHERE e.event_type = 'project.iteration'
  AND e.timestamp > strftime('%s','now')*1000 - 86400000
  AND (p.status IS NULL OR p.status NOT IN ('closed','archived','complete'));
```

The fallback handles the older `{"project": "/app/.../<name>", "iteration": N}`
payload shape (KE-568 — schema drift not yet consolidated). Including
`p.status IS NULL` keeps unmatched rows visible rather than silently
dropping them.

## Expected Impact
- `project.iterations-24h` immediately drops from 58 → 38 (today's reading).
- Subsequent close events no longer inflate the metric.
- Wasted handler invocations on closed projects stop (~22/24h today;
  scales with closure rate). This is a real, if small, cost reduction.
- The metric becomes usable as a true liveness signal again. With
  ghost traffic stripped, a value approaching threshold actually means
  active-project iteration is failing.

## Risks
- Closing a project mid-tick could cause one final iteration event for it
  to be excluded from the count (a tiny under-report). This is strictly
  preferable to the current over-report and matches user intent (closed
  means closed).
- Fix (b) without fix (a) would mask the underlying bug — the dispatcher
  would keep wasting cycles on closed projects, just no longer inflate the
  metric. **Both fixes must ship together** or fix (a) first.
- Fix (a) without fix (b) would correct dispatch but leave the historical
  24h window inflated for up to 24h after deploy. Acceptable as long as
  the metric isn't used for breach detection in that window.

## Out of Scope
- Consolidating the two `project.iteration` payload shapes (KE-568). The
  proposal accommodates both via the COALESCE; cleaning up emission is a
  separate task.
- The mtime-gate revival path (KE-734) is upstream of this and may be
  fixed by (a) as a side-effect, but the proposal doesn't depend on that.
