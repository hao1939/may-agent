# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777761752055_1116
- **Status:** done
- **When:** 2026-05-02T22:42:56.361Z
- **Duration:** 24s

## What Happened
Both red metrics are documented issues:

1. **project.active-count = 0**: All projects are in `waiting` status, not `active`. KE-452 documents that targets are stale and never calibrated. Target of 3 for "active" is meaningless when the system uses `waiting` status.

2. **project.blocked-over-6h = 3**: KE-500 confirmed the SQL fix landed. The metric now correctly counts 3 waiting/blocked projects >6h. Target of 2 is simply too low for current reality.

System is healthy: 100% success rate, all 8 agents have heartbeat coverage, 1265 real outputs in 24h.
