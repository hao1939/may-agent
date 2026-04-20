# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776683650820_180
- **Status:** done
- **When:** 2026-04-20T11:18:42.498Z
- **Duration:** 4m31s

## What Happened
Now I have the full picture. The project claims 82.3% coverage but that was achieved by backfilling `workflowRunId` on old sessions — essentially relabeling non-workflow sessions as workflow sessions. The real session-level coverage is 19.9%. Let me produce a concrete assessment.
