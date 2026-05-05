# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777983155632_4764
- **Status:** done
- **When:** 2026-05-05T12:13:39.854Z
- **Duration:** 1m4s

## What Happened
The red metrics (`project.active-count=0`, `project.blocked-over-6h=2`) have a documented root cause in KE-744: 21 files have `git update-index --assume-unchanged` set since 2026-04-29, silently dropping project status edits. The fix (`git update-index --no-assume-unchanged` on those paths) requires human authorization per the escalation policy.

System is otherwise healthy: 100% success rate, all 8 heartbeats covered, 394 real outputs in 24h, 0 errors.
