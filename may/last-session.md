# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777894955161_3604
- **Status:** done
- **When:** 2026-05-04T11:43:00.162Z
- **Duration:** 24s

## What Happened
Red metrics summary:
- **project.active-count=0** and **project.blocked-over-6h=2**: Root cause documented in KE-744 — `git assume-unchanged` on 21 files (including all project.md files) means project state changes never commit. This requires human intervention to run `git update-index --no-assume-unchanged` on affected files. Already escalated per prior KEs.

System is healthy: 100% success rate, all 8 heartbeats covered, 39 fires/hour, 1008 real outputs in 24h. No errors in the last hour.
