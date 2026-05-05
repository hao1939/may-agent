# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1778006558705_5045
- **Status:** done
- **When:** 2026-05-05T18:43:22.656Z
- **Duration:** 43s

## What Happened
The red metrics (`project.active-count: 0` and `project.blocked-over-6h: 2`) are documented in KE-744 as caused by `git assume-unchanged` on project files — disk edits never reach the git index, so project state tracking drifts. This is a known issue requiring human intervention (running `git update-index --no-assume-unchanged` on affected files), which is a potentially destructive git operation.

System is otherwise healthy: 100% success rate, 47 sessions/hour, all heartbeats firing, no errors. The evaluator is running 39 sessions in the last hour — system is productive.
