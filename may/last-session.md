# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777930956702_4064
- **Status:** done
- **When:** 2026-05-04T21:43:51.349Z
- **Duration:** 1m14s

## What Happened
The `assume-unchanged` bit has been cleared (no files show lowercase flags now). The red metrics are explained: there are genuinely 0 active projects (all are `waiting` or archived) and 2 projects are blocked >6h (which is the `waiting` state of hao-alignment and likely one other).

This is the documented "DB drift / no active projects" situation from KE-743/KE-744. The root cause (assume-unchanged) was already fixed. The current state is simply that no projects have `active` status — they're all waiting or done. This isn't a bug; it's a lack of active work being assigned.

The system is healthy: 100% success rate, all heartbeats firing, 687 real outputs in 24h, 18 project iterations. The "0 active projects" metric just means we need new work to be created or existing waiting projects to be unblocked.
