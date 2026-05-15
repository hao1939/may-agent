# Stuck Requests Metric — False Alarm Evidence (2026-04-18T13:36Z)

**Metric value:** 1 (⚠️ below threshold)
**DB reality:** 0 stuck requests found

Query: `SELECT requestId,toAgent,task,status,createdAt FROM requests WHERE status IN('pending','in-progress') AND createdAt<? ORDER BY createdAt ASC LIMIT 5` with threshold = now - 2h → returned 0 rows.

**Conclusion:** The metric snapshot at 13:20 captured a transient request that has since been resolved. No action needed.
