# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776800426981_80
- **Status:** done
- **When:** 2026-04-21T19:42:34.396Z
- **Duration:** 2m7s

## What Happened
QA already has finish() guidance. The violations are persistent — QA keeps writing to `workspace/unreviewed-findings.md` (relative path, not `agents/qa/workspace/...`) and not calling finish() last. This seems like a heartbeat/workflow issue rather than a context.md issue.

Let me write a brief coaching note and move on — the system is stable, no urgent fires.
