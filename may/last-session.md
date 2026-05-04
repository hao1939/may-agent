# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777918356504_3896
- **Status:** done
- **When:** 2026-05-04T18:14:02.269Z
- **Duration:** 1m25s

## What Happened
The red metrics are well-understood per KE-744. The root cause is `git update-index --assume-unchanged` set on 21 files (including all project.md files) since 2026-04-29, causing project status edits to be silently lost. The fix (`git update-index --no-assume-unchanged`) has been proposed but not executed. System is otherwise healthy: 100% success rate, all agents active, 755 real outputs in 24h.
