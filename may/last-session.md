# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777988556795_4825
- **Status:** done
- **When:** 2026-05-05T13:43:36.141Z
- **Duration:** 59s

## What Happened
System is healthy. The red metrics (`project.active-count: 0`, `project.blocked-over-6h: 2`) are the well-documented KE-744 issue: `git assume-unchanged` on 21 files prevents project status changes from being committed. The fix requires `git update-index --no-assume-unchanged` which is a git index modification — per the alert guidance, this should be escalated rather than done autonomously.

The system is otherwise performing well: 100% success rate, 37 fires/hour, all heartbeats running, 397 real outputs in 24h.
