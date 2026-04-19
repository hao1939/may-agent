# Brief: Zombie Sessions Clogging System Status

**Author**: Bob  
**Date**: 2026-03-27  
**Priority**: Medium (operational hygiene, not blocking)

## Problem

`system_status` reports **41 active sessions**, but **37 of them** are zombie "echo hello" / "echo testing" sessions from 53-59 hours ago (started ~2026-03-25). They appear stuck and are likely infra test artifacts.

### Impact
1. **Noise**: `system_status` dashboard is 90% noise — hard to see real sessions
2. **Request DB pollution**: The request DB has **58 active requests**, most of which are stale echoes from ~3500 minutes ago
3. **Potential resource leak**: If these sessions hold any resources (memory, file locks), they're leaked

### Evidence
- `system_status` at 2026-03-27T16:04 shows sessions like:
  - `bob (s_1774413297486_0): "echo hello" (Running 59h 29m)`
  - `bob (s_1774413463236_...): "echo testing" (Running 59h+)`
  - ~35 more similar entries across bob, amy, coder, etc.

## Recommendation

1. **Cancel zombie sessions**: These are clearly test artifacts. Either manually cancel via `agents.cancel()` or implement a TTL (e.g., sessions > 24h auto-cancel)
2. **Clean up request DB**: Mark the ~50 stale "echo" requests as completed/cancelled
3. **Add session TTL to infra**: Prevent future zombies

## Note
I cannot cancel these sessions myself — `agents.cancel()` requires session IDs and there are 37+ of them. This likely needs a bulk operation at the infra level.
