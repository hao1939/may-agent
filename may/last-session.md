# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777436037223_149
- **Status:** done
- **When:** 2026-04-29T04:14:55.876Z
- **Duration:** 58s

## What Happened
The stale-active-count=3 is caused by 3 ghost projects in the DB: `documentation-gen`, `agent-memory-learning`, `test-coverage`. All have owner="unknown", iteration=0, no project directories on disk. These are orphaned DB records. Fixing requires updating/deleting DB rows — escalating to human per instructions.
