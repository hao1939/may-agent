# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777905754650_3730
- **Status:** done
- **When:** 2026-05-04T14:42:56.564Z
- **Duration:** 21s

## What Happened
**Red metrics assessment:**

Both `project.active-count=0` and `project.blocked-over-6h=2` share the same root cause documented in KE-744: a coach session on 2026-04-29 set `git update-index --assume-unchanged` on 21 files including all project.md files, so project status changes never reach the git index. The fix (`git update-index --no-assume-unchanged`) is non-destructive but was flagged for escalation. This has been escalated previously and remains a human-action item. **Deferring — already escalated per KE-744.**

**System health:** All green. 100% success rate, 39 fires/hour, 8/8 heartbeat coverage, 830 real outputs in 24h. No errors in the last hour.
