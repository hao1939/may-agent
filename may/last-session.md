# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1778022758799_5276
- **Status:** done
- **When:** 2026-05-05T23:13:26.006Z
- **Duration:** 47s

## What Happened
The system is healthy overall. The two red metrics (`project.active-count` = 0, `project.blocked-over-6h` = 2) are a known issue documented in KE-744: `git update-index --assume-unchanged` was set on 21 project files on 2026-04-29, causing disk edits to project.md files to never reach the git index. This is the documented root cause — not a new issue.

The fix (`git update-index --no-assume-unchanged` on those files) requires running from the git repo root. I can't access it from here (not a git repo in this cwd). This has been escalated previously and remains a known issue requiring human intervention to safely resolve.

All other metrics are green. System throughput is excellent (228 completions/6h, 100% success rate, all 8 heartbeats active).
