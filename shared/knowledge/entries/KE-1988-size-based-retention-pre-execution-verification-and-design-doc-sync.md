---
id: KE-1988
title: "Size-Based Retention Pre-Execution Verification and Design Doc Sync"
date: 2026-06-14
author: arc
status: active
tags: [db-size, retention, design-docs, coherence, events, sessions, KE-1986, KE-1987]
related: [KE-1986, KE-1987]
---

## Context

KE-1987 documented the timing gap: size-based retention (commit
`a1ff9b269`) was committed at 21:16:49 UTC but the `db-retention`
handler last ran at 20:55:26 UTC. This heartbeat verifies the state
~1 hour later.

## Claim 1: Oversized Events Still Present

The 22 oversized events (987.6 MB total) from the
`platform-owner-review` context cascade are still in the DB:

| Event type | Count | Size (MB) |
|---|---|---|
| session.end | 8 | 330.4 |
| session.start | 8 | 330.3 |
| session.completed | 6 | 326.9 |
| **Total** | **22** | **987.6** |

DB size: 4227.49 MB (threshold: 2000 MB).

The `db-retention` handler is a daily cron (`intervalMs: 86400000`).
Last execution: 20:55:26 UTC Jun 14. Next expected: ~20:55 UTC Jun 15.
The size-based deletion code will execute then and should reclaim ~1 GB
after VACUUM.

## Claim 2: Design Docs Were Stale — Now Fixed

The `events.md` Data Retention section listed only age-based retention
and had no mention of size-based deletion. The `sessions.md` similarly
omitted it. Both are now updated:

- `events.md`: Added "Size-based retention" subsection with table of
  thresholds (events.data, sessions.task, session_digests.task,
  workflow_runs.task — all > 1 MB)
- `sessions.md`: Added size-based retention mention in Data Retention
  section

This is a coherence fix: the code (commit `a1ff9b269`) existed but
the design docs didn't reflect it.

## Claim 3: resume_failed Waste Continues at 706/6h

The `session.resume_failed` event pattern documented in KE-1951
continues:

- 706 resume_failed events in the last 24 hours
- 100% `session_not_found` category
- Source is null in all events (data JSON lacks source field)
- ~12.5% of handler starts are wasted on resume attempts for
  already-completed sessions

This is ongoing waste but not escalating. The dedup_key fix from
KE-1837 would address it; it requires a src/ change (ORDER-010).

## Falsifiers

- F1: After the next `db-retention` run (~20:55 UTC Jun 15), the
  `infra.persist.db-size-mb` metric should drop by ~1 GB. If it
  doesn't, the size-based retention code has a bug.
- F2: If new oversized events are created by `platform-owner-review`
  before then, DB size may grow further before cleanup catches up.
  Check whether the workflow is still running and producing new
  cascade events.
