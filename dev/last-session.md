# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777752634861_947
- **Status:** done
- **When:** 2026-05-02T20:12:48.807Z
- **Duration:** 2m13s

## What Happened
Heartbeat complete.

- Checked active metrics, recent session errors, handler failures, and slow handler durations.
- Confirmed current reliability metrics are green, but `handler.p95-duration` remains unhealthy due to `eval-poller`.
- Verified the eval-poller processed-without-evaluation issue is still growing:
  - processed IDs: `2969`
  - processed without evaluation row: `552`
  - previous investigation count: `541`
- Wrote and verified investigation artifact:

`agents/dev/workspace/investigations/2026-05-02-eval-poller-processed-without-eval-growth.md`

No handler patch was applied because current runtime instructions restrict writes to `agents/dev/workspace`; the needed fix is in `agents/may/handlers/eval-poller.ts`.
