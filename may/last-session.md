# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1778061340599_104
- **Status:** done
- **When:** 2026-05-06T09:56:16.191Z
- **Duration:** 35s

## What Happened
These KEs are clear. The red metrics are structural/known issues:

1. **handler.heartbeat-coverage (4, target 8)**: KE-750 explains — heartbeats for bob/optimizer/tech-lead/coach were disabled. Only ~4-5 remain active. The metric target is stale.
2. **project.active-count (0, target 3)**: KE-749 explains — agents shifted to notification-based work instead of projects. The metric measures an abandoned substrate.
3. **project.blocked-over-6h (2, target 0)**: Same root cause as above — blocked projects are legacy artifacts from the old substrate.

All three are documented as structural/substrate issues, not bugs to fix. The prior KEs explicitly say the metrics are measuring the wrong thing. This requires human decision on whether to update targets or change the work model.
