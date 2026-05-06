# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1778047958948_5632
- **Status:** done
- **When:** 2026-05-06T06:13:50.876Z
- **Duration:** 1m11s

## What Happened
KE-744 documents the root cause: `git assume-unchanged` on 21 files prevents project status changes from being committed. The fix requires running `git update-index --no-assume-unchanged` on those files — which is a destructive/corrective action that prior KEs say to escalate.

System is healthy: 100% success rate, all heartbeats firing, no errors. The idle session `s_1777485773079_0` (156h) is stale but harmless.

The red metrics (`project.active-count: 0`, `project.blocked-over-6h: 2`) are the same documented issue from KE-744. The fix (removing assume-unchanged flags) has been identified but requires human approval per the escalation rules.
