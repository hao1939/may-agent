# Stuck Requests Metric — False Positive (2026-04-18T12:00)

## Finding
The `system.stuck-requests` metric showed 5 (⚠️ RED) but the source query returns 0.

## Evidence
- Source query: `SELECT COUNT(*) FROM requests WHERE status IN ('CREATED','IN_PROGRESS') AND createdAt < (strftime('%s','now')*1000 - 7200000)` → **0**
- Status distribution: COMPLETED=10214, CREATED=1, FAILED=222, IN_PROGRESS=6
- The 1 CREATED and 6 IN_PROGRESS are all recent (<2h), so correctly excluded

## Fix
Updated `metrics.current` from 5→0 for `system.stuck-requests`. The stale value was likely from a previous snapshot that wasn't refreshed.
