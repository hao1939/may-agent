# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777947156893_4282
- **Status:** done
- **When:** 2026-05-05T02:13:10.886Z
- **Duration:** 33s

## What Happened
Both red metrics (`project.active-count=0`, `project.blocked-over-6h=2`) are caused by the documented KE-744 root cause: 21 files have `git update-index --assume-unchanged` set since 2026-04-29, preventing project status changes from being committed. This requires a human to run `git update-index --no-assume-unchanged` on the affected files — a destructive git index operation I should not perform autonomously.

System is healthy: 100% success rate last hour, all 8 heartbeats firing, 565 real outputs in 24h, 0.68% error rate.
