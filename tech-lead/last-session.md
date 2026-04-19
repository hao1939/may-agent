# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776596322290_8
- **Status:** interrupted
- **When:** 2026-04-19T10:59:58.076Z
- **Duration:** 1m15s

## What Happened
The web UI already respects `alert_direction`. The bug is in `cron.ts` (line 711-712) and `system-status.ts` (line 189) — they always use `current < threshold` without checking `alert_direction`.

Let me see the full query in cron.ts to check if it fetches `alert_direction`:
