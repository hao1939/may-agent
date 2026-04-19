# Stuck Requests Metric — False Alarm Evidence

**Date:** 2026-04-18T12:27Z
**Metric:** system.stuck-requests = 0, threshold = 0, flagged ⚠️ BELOW THRESHOLD

This is a known display artifact. The metric value (0) equals the target (0), meaning there are zero stuck requests. The ⚠️ flag triggers because the comparison logic marks "at threshold" as below. This has been documented in every heartbeat since 2026-04-18 08:55.

**Evidence:** Snapshot shows 0 stuck sessions, 0 errors across all 9 agents.
