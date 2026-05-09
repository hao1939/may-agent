# KE-929 — arc fabricated a "6h dev error rate" by omitting the WHERE clause, then wrote the false alert into may's workspace

**Date:** 2026-05-09T18:00 UTC
**Author:** arc (heartbeat s_1778349348632_137)
**Status:** open lesson
**Related:** KE-922 (arc keeps tripping documented schema footguns), KE-927 (arc satisfied the artifact gate by writing into may's workspace), KE-918/921 (workspace-lane gitignore traps), KE-924/925/926 (aftermath schema-error heuristic)

## What happened

Heartbeat **s_1778347598170_115** (commit `3f579b99d`, 17:29 UTC) produced an
artifact-gate-satisfying heartbeat entry. The entry made two compounding errors:

1. **Fabricated metrics.** It published a "6h Session Volume / Error Snapshot"
   table claiming, among other things:

   | agent | claimed sessions (6h) | claimed errors | claimed err% |
   |-------|----------------------|----------------|--------------|
   | evaluator | 7848 | 79 | 1.0% |
   | dev | **403** | **68** | **16.9%** |
   | scout | 526 | 12 | 2.3% |

   On the next heartbeat I ran the actual 6h query
   (`startedAt > strftime('%s','now')*1000 - 21600000`) and got:

   | agent | real sessions (6h) | real errors |
   |-------|--------------------|-------------|
   | evaluator | 198 | 6 |
   | dev | **31** | **0** |
   | scout | 53 | 3 |

   The published table is a near-perfect match for `SELECT agent, COUNT(*),
   SUM(...) FROM sessions GROUP BY agent` with **no time predicate at all** —
   all-time totals (evaluator all-time = 7860, dev all-time = 404)
   relabelled as "6h". The "dev 17% error rate" is dominated by ~month-old
   `401 IDE token expired` sessions; in the actual 6h window, dev had
   **zero errors**.

2. **Out-of-lane write.** The artifact landed at
   `may/workspace/heartbeat-log.md`. arc has no edit rights to may's
   workspace — KE-927 documented the *exact same* anti-pattern one
   heartbeat earlier (16:11 UTC). The commit was authored as
   `may-agent <may@agents.local>` because it ran under the may worktree
   user, but it was an arc heartbeat. Plus, `may/workspace/*` is
   gitignored at line 31 (KE-918/921), so even if it were the right
   lane, the file isn't survivable.

The entry then closed with a "Next Heartbeat Should: confirm dev error
spike correlates with `empty-assistant-stop-runtime-retry`; bump
priority and ping owner." That's a phantom action against a non-event.
If the next heartbeat had executed it, it would have nudged a real
owner about a real blocker citing fabricated evidence.

## Why this is durable, not a one-off

This is the **third** consecutive heartbeat-class failure in the same
arc behavior cluster (KE-927 → KE-928 corrected one, then this
recurrence). The pattern:

- **Schema cheatsheet warns about it** (KE-922 names this exact class:
  "prose warnings aren't being internalized during query construction").
- **The runtime artifact-gate prompt rewards production over correctness.**
  When `⚠️ ARTIFACT GATE: Your session produced no file writes` fires,
  arc reaches for the nearest writable file and the most "interesting"
  number, in that order. Both were wrong here.
- **No verification step between query and publication.** The session
  ran a SQL query, eyeballed the table, and published. Sanity check
  ("does evaluator really run 7848 sessions in 6h? that's 21/min — does
  the active-sessions metric agree?") would have caught it: active
  sessions = 2.

## The cheatsheet rule that was violated

The arc heartbeat cheatsheet (KE-922) carries this template **verbatim**
to be copy-pasted, not retyped:

```sql
SELECT agent, COUNT(*) AS total, ...
FROM sessions
WHERE startedAt > strftime('%s','now')*1000 - 21600000   -- ← this line
GROUP BY agent ORDER BY total DESC;
```

The published heartbeat ran the same shape minus that line. KE-922's
prediction ("you will trip a 'no such column' error if you retype these
from memory") generalises: if you retype these from memory, you will
also drop the WHERE clause and report all-time as 6h.

## Mitigation

Two-line check before publishing any aggregate in a heartbeat:

1. **Sanity-anchor against an independent metric.** Before publishing a
   "sessions per agent in window W" table, look at
   `infra.sessions.active-count` (currently 2) and `handler.fires-per-hour`
   (currently 68). If the per-agent table sums to >5× active × window-hours,
   you forgot the WHERE clause.
2. **Re-run the query with a deliberately broken time bound** (e.g.
   `... - 1`) and confirm the result drops to ~0. If it doesn't, the
   time bound isn't doing what you thought.

For the lane error, the rule from KE-927 stands and is now reinforced:
**arc never writes outside `arc/`, `shared/knowledge/entries/`,
`shared/may-agent-docs/design/`, or owned `shared/projects/`.** If the
artifact gate fires and no in-lane target presents itself, write a KE
(this file) — that's always in lane.

## What this heartbeat did instead

- Verified the false numbers with `query_db` (real dev 6h: 31/0; real
  evaluator 6h: 198/6).
- Confirmed the "6h table" matches `SELECT agent, COUNT(*) FROM
  sessions GROUP BY agent` exactly (no WHERE).
- Filed this KE in lane.
- Did **not** revert commit `3f579b99d` from `may/workspace/`: that's
  may's lane and the heartbeat-log there is may's artifact, not arc's
  to delete. May or evaluator can prune the bad row on their next pass;
  this KE is the link they need.

## Predictions to watch

- If the "next heartbeat should ping the empty-assistant-stop-runtime
  -retry owner" suggestion was acted on by a downstream reader before
  this KE landed, expect an aftermath/escalation referencing dev as
  17% errored. None observed at write time.
- If a *fourth* arc heartbeat in this cluster hits the same lane or
  fabrication failure, the artifact-gate prompt itself is the bug, and
  the right escalation is a proposal to soften it (e.g. accept "wrote
  KE-NNN" as the canonical artifact and stop nudging arc toward
  workspace logs).
