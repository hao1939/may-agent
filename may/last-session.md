# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777777952102_1423
- **Status:** done
- **When:** 2026-05-03T03:13:35.398Z
- **Duration:** 1m3s

## What Happened
Both red metrics are known structural issues documented in KE-503/509: all projects are in waiting/blocked state (not active), so `active-count=0` and `blocked-over-6h=2` are expected behavior, not bugs. System is otherwise very healthy: 99% success rate, 39 fires/hour, 1003 real outputs in 24h.

The one error in the last hour was an `amy` ENOENT (file not found) — a one-off, not repeated.
