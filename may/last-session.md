# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777945356229_4258
- **Status:** done
- **When:** 2026-05-05T01:43:14.046Z
- **Duration:** 37s

## What Happened
The red metrics (`project.active-count: 0` and `project.blocked-over-6h: 2`) are documented in KE-744 as caused by `git assume-unchanged` on project files — commits silently drop project state changes. This is a known issue requiring destructive remediation (removing the assume-unchanged flags and recommitting). Per the instructions: **escalate, do not fix autonomously**.

System health is good: 98% success rate, all cron jobs healthy, 37 fires/hour, 577 real outputs in 24h. One tech-lead auth error (GitHub token issue) — transient.
