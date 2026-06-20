# Finding: Stale Sessions Consuming Resources

**Date**: Heartbeat 2025-01-01
**Severity**: Low (informational)

## Observation

Two sessions have been running for excessive durations:
- **amy** gym session `s_1777626616591_`: 1041 min (17+ hours) - gym scenario likely stuck
- **may** chat session `s_1777485773079_`: 1515 min (25+ hours) - user reply, likely idle

## Impact

These aren't actively consuming compute (no ops observed), but they pollute the active session list and could mask real issues.

## Recommendation

1. Amy's gym session should be investigated - gym runs shouldn't take 17h
2. May's chat session is waiting for user input - normal for chat sessions, no action needed

## Database Health

- `main.db`: 0 bytes (empty)
- `session-tracker.db`: 0 bytes (empty)  
- `magi.db`: 0 bytes (empty)
- `may.db`: 403MB (only populated DB)

The empty DBs suggest session/evaluation tracking may not be persisting data, limiting observability. This warrants investigation in a future session.
