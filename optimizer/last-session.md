# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777383149055_151
- **Status:** done
- **When:** 2026-04-28T13:34:45.675Z
- **Duration:** 2m16s

## What Happened
Most "unhandled" events are `handler.started`/`handler.completed` (1,721) which are likely informational lifecycle events that don't need handling. The real concern is the 385 `agent.notification` and 133 `metric.breach` events sitting as pending. But these are part of normal system operation — events get consumed by heartbeats.

Let me dismiss the stale inbox items and finish.
