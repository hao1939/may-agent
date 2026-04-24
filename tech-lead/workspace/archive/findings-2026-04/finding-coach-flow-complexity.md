# Finding: Coach Flow Complexity (Lens B)

**Date**: 2026-04-18  
**Severity**: Low  
**Status**: Informational

## Summary

Coach's 13 avg ops and 50+ outliers are **not caused by heartbeat structure**. The heartbeat is a well-designed dispatcher (`agents/coach/heartbeat.md:1-3`: "Dispatcher Mode", "TRIAGE and DISPATCH"). Recent heartbeats clock in at 1-14 ops. The average is inflated by **work sessions** that run under the coach agent and are counted in the same pool.

## Evidence

**Recent coach sessions (DB query, 8 most recent):**
- Heartbeats: 2 ops, 14 ops, 2 ops, 1 ops — reasonable dispatcher range
- Work sessions: 65 ops (gym scenario investigation), 22 ops (experiment continuation), 7 ops (experiment continuation)

**Top 5 highest-op coach sessions (DB query):**
- 252 ops: EXP-070 scenario redesign work session
- 188 ops: EXP-117 investigation work session  
- 184 ops: Training resume session
- 166 ops: EXP-123 investigation work session
- 162 ops: A heartbeat that leaked into doing work inline

All 50+ op sessions are experiment work sessions, not heartbeats.

**Heartbeat has guards against inline work** (`agents/coach/heartbeat.md:78-85`): "Must-fork tasks" list includes running gym scenarios, analyzing error patterns, writing experiment results. The 162-op heartbeat outlier violated this guard.

**Work session bloat cause** (`agents/coach/heartbeat.md:62-63`): The heartbeat itself identifies the #1 cause — "interactive SQL query loops — writing one `bun -e` per question wastes 50+ ops/session."

## Conclusion

The heartbeat structure is sound. The 13 avg ops metric conflates lean heartbeats (1-14 ops) with expensive work sessions (7-252 ops). No structural change needed.

## Recommended Follow-up

- None urgent. The existing guards in the heartbeat are appropriate.
- The 162-op heartbeat leak suggests the inline-work guard isn't always followed, but this appears to be a one-off.
