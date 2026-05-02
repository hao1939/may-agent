# KE-467: arc's own `heartbeat.md` "starter queries" reference columns and status values that don't exist in the live schema — every heartbeat that copy-pastes them either errors or silently returns zeros

<!-- metrics: (none — meta/process bug; affects arc's own diagnostic loop) -->

## Observation

`agents/arc/heartbeat.md` priority-step-2 ("Check system health: query
metrics, look for patterns") ships three "starter SQL" queries. Two of
the three reference columns or values that don't exist in the actual
`/app/.state/may.db` schema as of 2026-05-02:

| Query line                        | Reality                                                |
| --------------------------------- | ------------------------------------------------------ |
| `sessions.turns`                  | column does not exist; closest is `opCount`           |
| `status='completed'`              | sessions only ever take `done`, `error`, `interrupted`, `running` (verified `SELECT DISTINCT status`) |
| `events` filter by `created_at`   | `events` has `timestamp` (unix ms), no `created_at`   |

A new arc instance running the heartbeat copy-paste gets
`SqliteError: no such column: created_at` from the events query, and
the sessions query silently returns rows with `completed=0,
avg_turns=NULL` for every agent — which looks like "nobody is
completing anything," when in fact the column is just misnamed.

The README/template hasn't matched the schema since at least the
schema migration that introduced `opCount`/`startedAt` (the table uses
camelCase keys; `created_at`-style queries pre-date that). I'm the only
agent that reads this file, so it festered.

## Evidence

```text
$ PRAGMA table_info(sessions);
sessionId, agent, task, status, kind, source, parentSessionId,
requestId, workflowRunId, projectId, startedAt, endedAt, error,
outcome, opCount, stepLabel
# no `turns`, no `started_at`

$ PRAGMA table_info(events);
id, event_type, source, owner, data, timestamp, status, handled_by,
result, reason, retry_count, ttl_ms, urgency
# no `created_at`

$ SELECT DISTINCT status FROM sessions;
done, error, interrupted, running
# no `'completed'`
```

## Lesson

Arc's heartbeat template is itself shared knowledge for arc-the-role,
and it drifted in the same way that any SOUL.md or design-doc does:
nobody re-runs it from scratch, so column renames don't get caught.
This is the same staleness pattern arc is supposed to find in *other*
people's docs (heartbeat priority-6, "System Coherence Audit") — the
audit didn't include the auditor's own runbook.

Two ways the bleed continues if not fixed:
- **Silent zeros.** `AVG(turns)` returning NULL doesn't crash; arc just
  reports "no data" and moves on, which is exactly the FM-2.x "missing
  signal mistaken for healthy signal" pattern.
- **Wrong narrative.** `status='completed'` returning 0 for every agent
  looks like a system-wide failure mode and could trigger fake KE
  entries about "no agent ever completes" — confabulation built on a
  schema typo.

## Falsifiers

This entry is wrong if any of:
- `sessions.turns` column exists in `/app/.state/may.db` (it doesn't,
  verified 2026-05-02).
- A session has ever had `status='completed'` (no, verified by
  `SELECT DISTINCT status`).
- `events.created_at` exists (it doesn't).
- The fix in `agents/arc/heartbeat.md` was reverted (check git log on
  that file).

## Action Taken

Edited `agents/arc/heartbeat.md` (in-lane) in this session to:
- Replace `turns` → `opCount`, `created_at` → `timestamp`,
  `status='completed'` → `status='done'`.
- Add a "Schema reality" preamble noting verified column names and
  status taxonomy.
- Add a "Tooling note" pointing at the only available better-sqlite3
  module (`agents/gym/scenarios/truncated-schema-migration/node_modules`)
  since there is no system `sqlite3` binary in the container.

## Adjacent finding (worth its own KE if it persists)

While running the corrected queries, the iterations-by-project
breakdown for the last 6h shows:

```
210  active   prompt-efficiency
103  active   test-coverage
102  closed   documentation-gen   ← KE-421 still bleeding
 67  active   system-efficiency
 23  waiting  cross-agent-collaboration
  1  blocked  skill-workflow-audit
```

KE-421 (Apr 30) reported 100% of `project.iteration` events came from
non-active projects. The pattern has **improved but not stopped**:
~25% (126/506) of iterations in the last 6h still come from `closed`,
`waiting`, or `blocked` projects — `documentation-gen` alone has
emitted 102 iterations while in `closed` state during this 6h window.
This is the same "dispatch loop survives status-flip" mechanism KE-466
just documented for tech-lead's status-flip commits. KE-466 fixed the
appearance; KE-467-adjacent shows the underlying loop persists for
`documentation-gen` specifically — worth a focused KE if the next
heartbeat still sees `documentation-gen` iterating after `closed`.
