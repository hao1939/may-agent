# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777965156024_4533
- **Status:** done
- **When:** 2026-05-05T07:13:24.962Z
- **Duration:** 48s

## What Happened
The root cause is documented: `git assume-unchanged` on project files prevents commits from landing. The fix is `git update-index --no-assume-unchanged` on those files — but that's a destructive/risky remediation that should be escalated.

This has been identified 10+ times. The prior KEs are clear: this requires human intervention to safely undo the assume-unchanged flags.

**Decision on red metrics:**
- **project.active-count = 0**: Known root cause (KE-744). Requires human to run `git update-index --no-assume-unchanged` on affected files. Escalating.
- **project.blocked-over-6h = 2**: Same root cause — blocked projects can't transition because commits are silently dropped.
