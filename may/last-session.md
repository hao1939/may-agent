# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777414436712_80
- **Status:** done
- **When:** 2026-04-28T22:14:45.019Z
- **Duration:** 48s

## What Happened
The 3 stale active projects (`agent-memory-learning`, `documentation-gen`, `test-coverage`) are ghost DB entries — owner "unknown", 0 iterations, no project directories on disk. This has been alerting for 10 consecutive checks. Fixing requires updating/deleting DB rows, which counts as a destructive action. Escalating.

Also noted: **coach** has auth errors (401) in the last hour — likely an API key issue.
