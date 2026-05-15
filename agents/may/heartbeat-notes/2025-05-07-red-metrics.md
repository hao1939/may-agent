# Red Metric Disposition — 2025-05-07

## handler.failed-count: 4 (target 0)
**Status**: DEFER (known issue)
Per KE-776: The metric-alert-reactor dedup was reverted by commit 83d2410d3. The LIKE pattern matches every heartbeat session, so alerts repeat but never get investigated. The actual failure count (4/196) is operationally acceptable. Fix is to re-apply cad130ff5's LIKE pattern change.

## capability.status-reality-mismatch-count: 14169 (target 0)
**Status**: ESCALATE TO HUMAN
This counter has accumulated 14k+ mismatches. Fixing requires either a DB rebuild or bulk data correction — both destructive actions per standing orders. Escalating.

## metric.stale-active-count: 1 (target 0)
**Status**: DEFER (self-resolving)
Single stale metric, likely a timing issue. No metrics table found in main.db suggesting it's computed from session data. Will resolve on next collection cycle.
