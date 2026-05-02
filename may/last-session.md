# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777741951593_738
- **Status:** done
- **When:** 2026-05-02T17:13:02.560Z
- **Duration:** 30s

## What Happened
This is a known issue. The `project.active-count` metric reads 0 because projects have been closed and no new ones created — it's a target mismatch issue documented in KE-452 (targets never raised/adjusted) and KE-471 (projects legitimately closed). The target of 3 is stale. This requires a human decision to either lower the target or create new projects.
