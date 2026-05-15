# M1: Improved Inbox Dedup — Implementation

**Status**: Done
**Date**: 2026-04-27

## Change

Enhanced `loadInbox()` in `agents/shared/workflows/heartbeat-data.ts` to better collapse duplicate notifications.

### Before
- Dedup key: `event_type` + first 80 chars of raw summary (normalized whitespace only)
- Problem: `[P1] [P1] requests.db has 0 rows` and `[P1] requests.db has 0 rows — confirmed again` were treated as different items

### After
- Strip redundant priority tag prefixes (`[P1] [P1]` → empty)
- Strip agent names from topic key (same issue reported by different agents collapses)
- Strip time references (`43h`, `12m`) and fractions (`21/27`) that change between reports
- Increased key length from 80→100 chars for better discrimination

### Expected Impact
- Reduces inbox noise by ~40-60% for repeated cross-agent notifications about the same issue
- Example: 8 notifications about "requests.db empty" would collapse into 1-2 items instead of 5-6
