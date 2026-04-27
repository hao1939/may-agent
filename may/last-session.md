# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** cron_1777281226705_0
- **Status:** done
- **When:** 2026-04-27T09:14:41.898Z
- **Duration:** 55s

## What Happened
The handler health metric is stale — it queries a `requests` table for handler artifacts that are no longer being created in the current architecture. Same for "Request throughput" and "Stuck requests" — all measuring a deprecated request-tracking system.

These 3 metrics should be cleaned up. Let me notify tech-lead to address this.
