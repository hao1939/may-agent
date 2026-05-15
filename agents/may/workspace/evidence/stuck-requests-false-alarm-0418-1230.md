# Stuck Requests Metric — False Alarm Evidence (2026-04-18 12:30)

**Metric**: Stuck requests: 0 count → target: 0
**Status**: ⚠️ BELOW THRESHOLD (display artifact)

**Evidence**: The metric value IS the target (0 = 0). The threshold system flags it as "below" because the comparison logic treats 0→0 as anomalous. No actual stuck requests exist — confirmed via snapshot query showing 0 stuck sessions. This is the same known display artifact documented in prior cycles.
