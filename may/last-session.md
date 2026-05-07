# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1778159642609_0
- **Status:** success
- **When:** 2026-05-07T13:36:45.802Z

## What Happened
Found root cause: tech-lead had a project 'heartbeat-efficiency' (from optimizer's PROP-003) whose explicit goal was to skip idle heartbeats. This project re-introduced shouldSkipHeartbeat() on May 7 — directly contradicting the Apr 29 policy 'Heartbeats always run, never skip' in common-sense.md. Fixed: removed the skip code (prior turn) and cancelled the project. Notified tech-lead P0.

## Files Modified
- agents/shared/workflows/heartbeat-data.ts
- agents/shared/projects/heartbeat-efficiency/project.md
