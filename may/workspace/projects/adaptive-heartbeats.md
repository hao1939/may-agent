# Adaptive Heartbeats

**Owner:** may
**Goal:** Stop wasting sessions when there's nothing to do.
**Created:** 2026-04-16
**Status:** Active
**Master project:** [system-evolution.md](./system-evolution.md) → Gap 4
**Source feedback:** [scout](../../scout/workspace/system-gaps.md), [coach](../../coach/workspace/system-gaps.md)
**Tracked metrics:** `system.agent-utilization`, `system.request-throughput`

## Why
Agents fire heartbeats on fixed intervals regardless of whether there's work. Scout runs every 30min even when arXiv hasn't updated. Coach checks in when no experiments are running. Each idle heartbeat costs 5-15 ops for zero value.

## Milestones

- [ ] **Conditional heartbeat — fast exit** — If nothing needs attention (no new requests, no stale work, no errors), exit in ≤2 ops. Don't read 5 files to confirm there's nothing to do.
- [ ] **Scout: skip heartbeats between arXiv windows** — arXiv updates at known times. Scout shouldn't poll between them.
- [ ] **Adaptive frequency** — Run more often during active periods (when Hao is online, when work is dispatched), less during quiet hours. May controls the cron intervals dynamically.

## Progress Log
<!-- Append entries as milestones are completed -->
