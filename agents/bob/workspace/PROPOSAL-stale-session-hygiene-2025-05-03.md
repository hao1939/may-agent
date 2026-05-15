# Proposal: Stale Session Hygiene & Detection

**Date**: 2025-05-03  
**Author**: Bob  
**Status**: Draft  

## Problem Statement

System status shows 400+ active sessions, most of which are interrupted/stale (many >300h old). These include:
- ~30 bob sessions stuck on "Ship EXP-188 finish-guard" (never completed, repeatedly re-dispatched)
- ~15 bob sessions on "Process scout deep-dives" (same pattern)
- Coach sessions stuck on "EXP-188: Run all 75 trials" (re-dispatched 10+ times)
- Multiple optimizer/tech-lead sessions from weeks ago still listed as "active"

Current metrics track `session.error-rate-6h` but NOT session staleness. The `idle` state (1 session at 87h) also goes undetected.

## Root Cause Analysis

1. **No session TTL**: Sessions left in `running`/`idle` state indefinitely
2. **Retry-without-cancel pattern**: New sessions dispatched for same task without canceling predecessors
3. **No deduplication at dispatch**: Same task string dispatched repeatedly despite existing sessions

## Proposed Solution

### Metric Addition
Add `session.stale-running-count` — count of sessions with status `running` or `idle` older than 30 minutes.
- **Alert threshold**: >3
- **Target**: 0

### Behavioral Fix: Dispatch Deduplication
Before forking a new session for task X, check if an active session already exists for the same agent+task pattern. The `agents.fork` tool has a `force` parameter for this — ensure callers default to NOT forcing.

### Hygiene Cron
A periodic job (every 6h) that:
1. Queries for sessions older than 2h in running/idle state
2. Cancels them (they're zombies)
3. Logs which tasks were abandoned for retry analysis

## Impact Estimate

- **Noise reduction**: Removes ~396 zombie entries from system_status, making monitoring useful
- **Resource clarity**: Operators can actually see what's running NOW
- **Retry detection**: Identifies tasks that keep failing silently

## Next Steps

1. Check if may/tech-lead already have a session-cleanup mechanism
2. Design a simple test: manually cancel 5 oldest zombie sessions, verify no side effects
3. If safe, propose the hygiene cron to tech-lead for implementation

## Evidence

From `system_status(windowMinutes=360)`:
- 400 "active" sessions listed
- Only 4 actually running (arc, coach, amy, bob)
- 1 idle (may, 87h)
- Rest: interrupted/done but still appearing in active list (display bug or state leak)

Note: The "interrupted" sessions showing in active list may be a reporting artifact — they show "(interrupted Xh)" which suggests they're terminated but not cleaned from the active view. This itself is a UX issue worth fixing.
