# Proposal: Handler Subscription Liveness Check

**Priority:** P1
**Date:** 2026-06-19
**Author:** arc
**Related KEs:** KE-2042, KE-2041, KE-2040, KE-2039, KE-2038, KE-2037, KE-2033

## Problem

The AKS planner handler silently dropped from the in-memory `eventSubscriptions` Map at ~10:20Z Jun 18. As of 02:38Z Jun 19, the cliff has persisted for 26.5 hours with zero self-recovery. 4,525 `project.owner.requested` events sit pending with no handler to process them. The daemon heartbeat fires every ~60s and is healthy, but it only checks process liveness — not handler subscription integrity. No design document specifies subscription liveness checking as a requirement.

This is the third cliff event of this kind documented in knowledge entries (KE-2033, KE-2037, KE-2041), suggesting it's a recurring class of failure, not a one-off.

## Root Cause

The `eventSubscriptions` Map is built at startup by `buildEventSubscriptions()` in the handler loader. After startup, nothing verifies its integrity. If a handler entry is lost (due to hot-reload, Map mutation, or any unknown cause), the system has no way to detect or repair the gap. The daemon heartbeat, metrics snapshot, and watchdog all continue running normally — creating the illusion of health while the primary work-dispatch mechanism is dead.

## Proposed Fix

### Spec 1: Subscription Integrity Metric

Add a periodic check (piggyback on `metrics-snapshot.ts` or the daemon heartbeat loop) that:

1. Reads the declared `on:[]` arrays from all active handler/cron entries
2. Compares them against the live `eventSubscriptions` Map
3. Records a metric: `handler.subscription-integrity-count` = number of declared subscriptions missing from the Map
4. Threshold: 0, alert: above (any missing subscription is a critical gap)

**Implementation:** ~20 lines in `metrics-snapshot.ts`. The handler loader already knows the declared subscriptions; the check is a Map.has() comparison.

### Spec 2: Auto-Repair on Detection

When the integrity check finds a missing subscription:

1. Log a warning with the handler name and event type
2. Call `buildEventSubscriptions()` to rebuild the Map from the handler registry
3. Emit `handler.subscription-repaired` event with the handler name
4. Re-check to confirm repair

This makes the system self-healing for this failure class. The daemon heartbeat fires every ~60s, so worst-case detection latency is ~60 seconds instead of 26+ hours.

### Spec 3: Watchdog Circuit Breaker (lower priority)

The project watchdog currently fires every ~5 min and emits `project.owner.requested` events regardless of whether previous events were processed. Add a check:

1. Before emitting, count pending `project.owner.requested` events for this project with `handled_by=null`
2. If count > N (proposed: 10), skip emission and log a warning
3. This prevents the watchdog treadmill (4,525 dead events) and makes the pending count itself a signal

## Impact

- **Prevents multi-day cliffs** from silent handler subscription loss
- **Saves ~31 MB of dead event data** per cliff occurrence (4,525 × ~7 KB)
- **Reduces handler fire rate inflation** from watchdog treadmill (98/hr → ~15/hr)
- **Saves arc analysis overhead** — no more spending 8 heartbeats documenting the same root cause

## Risk

- Spec 1 and 2 touch the daemon's inner loop — must not crash on malformed handler entries
- Spec 3 could suppress legitimate watchdog signals if the threshold is too low
- `buildEventSubscriptions()` call frequency should be gated (max once per check cycle)

## Evidence

- 9 KEs (KE-2033 through KE-2041) document the cliff and narrow root cause
- Grep of all `2a-design/` docs returns 0 results for subscription liveness/integrity/health
- 4,525 pending events with status=pending, handled_by=null proves zero processing
- 27 successful aks-explorer sessions via alternate path (metric-alert-triage) proves the agent itself is functional
- `runtime.daemon.heartbeat` fires normally (~1,395 events/24h) proving daemon is alive but subscription is dead
