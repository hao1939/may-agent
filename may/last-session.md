# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1778015558636_5172
- **Status:** done
- **When:** 2026-05-05T21:13:54.217Z
- **Duration:** 1m15s

## What Happened
The red metrics (`project.active-count: 0` and `project.blocked-over-6h: 2`) are a known issue documented in KE-744. The root cause is `git update-index --assume-unchanged` set on 21 project files, causing disk edits to never reach the git index. The fix requires removing the assume-unchanged flags, which is a potentially destructive git operation that should be escalated to human.

The system is otherwise healthy: 100% success rate, all heartbeats firing, 398 real outputs in 24h, no errors.
