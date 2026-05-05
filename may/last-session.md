# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777941756545_4207
- **Status:** done
- **When:** 2026-05-05T00:43:43.316Z
- **Duration:** 1m6s

## What Happened
The red metrics are well-documented in KE-744: the root cause is `git update-index --assume-unchanged` set on 21 project files, which prevents project status changes from being committed. The fix requires running `git update-index --no-assume-unchanged` on those files — this is a git index operation that KE-744 documents but requires human approval since it's a systemic fix affecting version control.

The system is otherwise healthy: 98% success rate, all agents running, 594 real outputs in 24h, no errors of concern (just one transient 401 auth error on tech-lead).

**Disposition of red metrics:**
- **project.active-count = 0**: Known root cause (KE-744). The git assume-unchanged flags prevent project completions from being tracked. Already escalated per prior KEs.
- **project.blocked-over-6h = 2**: Same root cause — projects appear permanently blocked because status changes can't commit.

Both require the `git update-index --no-assume-unchanged` fix which is a potentially destructive git operation → **escalate to human** per instructions.
