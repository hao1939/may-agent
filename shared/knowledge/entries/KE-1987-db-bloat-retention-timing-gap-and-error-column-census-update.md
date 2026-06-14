---
id: KE-1987
title: "DB Bloat Retention Timing Gap + Error Column Census Update"
date: 2026-06-14
author: arc
status: active
tags: [db-size, retention, platform-owner-review, sessions-error, census, KE-1985, KE-1986]
related: [KE-1985, KE-1986]
---

## Context

KE-1986 identified 22 oversized events (987.6 MB) from the
`platform-owner-review` context cascade. May committed a size-based
retention fix (`a1ff9b269`, 21:16:49 UTC) that deletes events >1MB. The
db-retention handler last ran at 20:55:26 UTC — 21 minutes before the
fix was committed. The oversized rows therefore survive until the next
daily retention run.

## Claim 1: Retention Fix Has Not Executed Yet

The oversized events are still in the DB (22 events, 987.6 MB). The
timing gap:

- Newest oversized event written: 20:49:26 UTC
- Retention handler last ran: 20:55:26 UTC (without size-based code)
- Size-based retention code committed: 21:16:49 UTC
- Current time: ~21:30 UTC

The fix will execute on the next `db-retention` cron fire (daily
interval, `intervalMs: 86400000`). Expected: ~20:55 UTC tomorrow
(Jun 15). Until then, DB remains at 4.2 GB.

**Implication**: The `infra.persist.db-size-mb` metric will remain in
breach (4227 MB vs 2000 MB threshold) for up to 24 hours.

## Claim 2: KE-1985 F1 Strengthened — Error Column Census Updated

KE-1985 documented 1/389 error sessions with non-NULL `sessions.error`.
Updated census (21:30 UTC):

| Window | Error sessions | Non-NULL error | Rate |
|--------|---------------|----------------|------|
| KE-1985 (initial) | 389 | 1 | 0.26% |
| Current 7d | 668 | 3 | 0.45% |

All 3 non-NULL error sessions:
- Agent: may
- Error text: "Agent ended with an empty assistant turn"
- Source: `workflow:platform-owner-review`
- opCount: 0 (zero-op errors from context cascade)

This strengthens KE-1985's observation: the write-path race is
consistently won in the `platform-owner-review` context cascade scenario,
likely because the oversized context causes rapid session failure before
the db-writer's NULL-overwrite path fires. Updated `sessions.md`
accordingly.

## Claim 3: Resume-Failed Structural Pattern Continues

KE-1951 (F2 falsified) documented structural resume_failed growth. Current
24h check:

- 693 resume_failed events (24h)
- 100% `session_not_found` category
- 100% target sessions exist and are already `done` or `interrupted`
- 469 from `project_planner`, 220 from `task`, 4 from `problem`

The pattern is unchanged: the system attempts to resume already-completed
sessions. This is wasted handler load (12.5% of handler starts, per
KE-1951). The dedup_key fix from KE-1837 remains unimplemented.

## Falsifiers

- F1: If the next retention run (expected ~20:55 UTC Jun 15) deletes the
  22 oversized events and VACUUMs, DB size should drop by ~1 GB. If it
  does NOT, the size-based retention code has a bug.
- F2: If new oversized events are created before the retention run (the
  platform-owner-review workflow keeps running), the DB may grow further
  before the cleanup catches up.

## Action Taken

- Updated `sessions.md` error column census (3/668 → 0.45%)
- This KE documents the timing gap for the next heartbeat to verify
  retention execution
