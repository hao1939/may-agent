# Dedup Measurement Report

**Date:** 2026-04-28  
**Data source:** `/app/.state/may.db` events table  
**Period:** 2026-04-21 to 2026-04-28 (7 days, 2328 events)

## Notification Duplicate Analysis

| Metric | Value |
|--------|-------|
| Total notifications | 516 |
| Unique notification groups | 488 |
| **Overall duplicate rate** | **5.4%** |
| Duplicates within 1hr window | 20 (3.9%) |

## Top Duplicate Sources

| Count | Source |
|-------|--------|
| 13x | task-watchdog: stale call request alerts |
| 6x | task-watchdog: orphaned fork alerts |
| 3x | task-watchdog: orphaned fork (bob) |
| 3x | task-watchdog: stale notify alerts |
| 2x | system-status: anomaly detection |

**Key finding:** Nearly all duplicates come from `task-watchdog` — a recurring alerting system that *intentionally* re-sends notifications for unresolved issues. These are not bugs; they're repeated nudges by design.

## Request Tracking DB

The `requests` table in `/app/.state/requests.db` contains **0 rows**. The system uses a separate requests table in `may.db` (also currently empty). Request tracking appears to have been reset/migrated.

## Comparison to Original Problem

| Metric | Original (pre-fix) | Current |
|--------|-------------------|---------|
| Duplicate rate | 78% | 5.4% |
| Within-window duplicates | Unknown | 3.9% |

## Recommendation

**Close the project. M2 and M3 are not needed.**

1. The read-side dedup implemented by the optimizer has reduced visible duplicates to 5.4%, well below the 10% threshold.
2. The remaining "duplicates" are intentional recurring alerts from task-watchdog, not bugs.
3. Write-side dedup guards would add complexity for <2% improvement on actual unintentional duplicates.
4. The original 78% duplicate rate is resolved.
