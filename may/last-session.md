# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776872202222_572
- **Status:** done
- **When:** 2026-04-22T15:37:27.405Z
- **Duration:** 45s

## What Happened
System is healthy, all metrics green. The 5h-old metric.breach is stale — metrics are all passing now. **Dismissing it.**

The real issue: **50 active requests, most 3-4+ days old, all stuck in CREATED status.** This is notification debt — agents are sending notifications that never get consumed. The system works but the request DB is accumulating cruft.

Two things worth acting on:

1. **Coach is drowning in convention-regression notifications** — ~15 notifications from convention-check, plus scout citations. Coach has 112 sessions (most active agent) but these keep piling up.

2. **Tech-lead has 1 error in last hour** — minor but worth monitoring.

Let me nudge coach about the convention regression backlog since that's the most actionable item.
