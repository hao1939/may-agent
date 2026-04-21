# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** cron_1776757211743_256
- **Status:** done
- **When:** 2026-04-21T07:41:23.891Z
- **Duration:** 1m11s

## What Happened
Good data. `call` sessions have high workflow coverage (mostly 100% since they're dispatched by workflows). `job` sessions (heartbeats, crons) are lower — that's expected since heartbeats themselves aren't workflows but should dispatch work via workflows.

System is healthy. No anomalies, no errors, reasonable ops. Workflow adoption looks solid for `call` sessions. The `job` sessions with partial wf coverage is expected (heartbeats + crons that dispatch workflow work).

No actionable dispatch ne
