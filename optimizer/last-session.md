# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776965805773_1372
- **Status:** done
- **When:** 2026-04-23T17:37:49.079Z
- **Duration:** 1m3s

## What Happened
Two major waste patterns are crystal clear from the request queue:

**Finding 1: Coach EXP-188 retry storm** — 12+ duplicate self-fork requests for "EXP-188: Run trials", all CREATED/unresolved. Ages range 5125m to 5636m. Coach keeps re-dispatching the same experiment without completing or canceling prior attempts.

**Finding 2: Evaluator coverage alert flood** — 12+ unacted "Coverage regressed" alerts from metrics-snapshot, all CREATED. Coverage dropped 84→44 with zero response. Each heartbeat generates a new alert that's never resolved.

Let me write these up and notify.
