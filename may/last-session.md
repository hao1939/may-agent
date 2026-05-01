# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777603786961_72
- **Status:** done
- **When:** 2026-05-01T02:51:36.639Z
- **Duration:** 1m49s

## What Happened
The project workspace directories don't exist! That explains the 10x repeated stale alert — the projects are registered in the DB but have no files on disk, so agents can never update milestones. These are likely phantom projects that were seeded into the DB but never actually created.

This needs escalation since fixing it might require DB changes (deleting phantom records).
