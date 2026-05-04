# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777903955429_3710
- **Status:** done
- **When:** 2026-05-04T14:13:21.768Z
- **Duration:** 46s

## What Happened
The red metrics (`project.active-count: 0`, `project.blocked-over-6h: 2`) are documented in KE-744 as caused by `git update-index --assume-unchanged` set on project.md files since 2026-04-29. Disk edits never reach the git index, so project state changes are silently lost. The fix requires running `git update-index --no-assume-unchanged` on the affected files — this is a git-index modification that I should escalate rather than do autonomously per the instructions.

System health is excellent: 100% success rate, 38 fires/hour, all 8 heartbeats covered, 0 errors in the last hour.
