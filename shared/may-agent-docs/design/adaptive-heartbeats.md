# Design: Adaptive Heartbeats

> **⚠️ SUPERSEDED 2026-04-17.** The Phase 1 "fast-exit gate" in this doc is **killed** by Hao's reframe: heartbeats are an exploration budget, not overhead. Do **not** deploy Phase 1 from this document. Milestone 1 is replaced by [idle-heartbeat-playbook.md](./idle-heartbeat-playbook.md). Phases 2-3 (adaptive frequency, arXiv windowing) are retained as Milestones 2-3 but reframed in the [project file](../../../may/workspace/projects/adaptive-heartbeats.md).

**Author:** bob  
**Date:** 2026-04-16  
**Status:** Superseded (Phase 1); Phases 2-3 retained as future milestones  
**Project:** [adaptive-heartbeats](../../may/workspace/projects/adaptive-heartbeats.md)

## Problem

Heartbeats fire on fixed intervals regardless of workload. Data from sessions DB:

| Agent | Total HBs | ≤2 ops (idle) | % idle |
|-------|-----------|---------------|--------|
| may | 3,451 | 2,805 | **81%** |
| evaluator | 2,124 | 1,642 | **77%** |
| tech-lead | 1,726 | 920 | 53% |
| bob | 1,616 | 852 | 53% |
| coach | 1,525 | 797 | 52% |
| optimizer | 1,293 | 598 | 46% |

**~65% of all heartbeats do ≤2 ops** — they wake up, confirm nothing changed, and exit. Each still costs session overhead (context injection, model call, DB writes). Conservative estimate: **7,600 wasted sessions** in the dataset.

Bob's recent heartbeats (last 20): avg 7 ops, range 3-17. Many are just "scan → nothing new → finish."

## Design

### Layer 1: Fast-exit gate (in heartbeat prompt)

Before the current Step 1 (OBSERVE), add a **Step 0: GATE** that checks a single signal file:

```
## Step 0: GATE (1 op max)
Read `.state/signals/<agent>.json`. If `pending_count == 0` AND `last_dispatch_at` is >30min ago AND no `force: true` flag, call finish(status='success', summary='No pending work') immediately.
```

The signal file is written by May's dispatcher whenever it:
- Creates a request for this agent
- Detects a metric alert for this agent
- Receives a Hao message mentioning this agent

**Cost**: 1 read op for idle heartbeats (down from 3-8 today).

### Layer 2: Adaptive frequency (in May's scheduler)

May currently fires heartbeats on fixed cron (e.g., every 30min). Replace with adaptive intervals:

```
baseInterval = 30min
activeInterval = 15min  
idleInterval = 60min

// State per agent
if (agent.consecutiveIdleHeartbeats >= 3) interval = idleInterval
if (agent.hasPendingRequests || agent.hasActiveProject) interval = activeInterval  
if (agent.lastDispatchAge < 10min) interval = baseInterval  // just got work
```

Signals that reset to active:
- New request created for agent
- Hao comes online (any Hao message)
- Metric alert fires for agent's metrics
- Agent's forked session completes (may want follow-up)

### Layer 3: Scout arXiv window (special case)

arXiv posts new papers ~20:00 UTC daily (with some variation). Scout config:

```json
{
  "scout": {
    "activeWindows": [{"start": "19:00", "end": "23:00", "interval": "30min"}],
    "defaultInterval": "120min"
  }
}
```

Outside the active window, Scout only checks for manual requests.

## Implementation Plan

### Phase 1: Signal file + fast-exit gate
1. May writes `.state/signals/<agent>.json` on dispatch events
2. Add Step 0 to each agent's heartbeat.md
3. **Expected impact**: idle heartbeats drop from 3-8 ops to 1 op

### Phase 2: Adaptive intervals
1. Add `consecutiveIdleHeartbeats` counter to May's agent state
2. Replace fixed cron with dynamic scheduling
3. **Expected impact**: ~50% fewer total heartbeat sessions for idle agents

### Phase 3: Scout windowing
1. Add arXiv schedule config
2. Scout heartbeat checks time-of-day before full scan
3. **Expected impact**: Scout heartbeats drop ~75% outside arXiv window

## Estimated Savings

| Change | Sessions saved/day | Ops saved/day |
|--------|-------------------|---------------|
| Fast-exit gate | ~0 (same count, fewer ops) | ~200 ops |
| Adaptive frequency | ~30 sessions | ~150 ops |
| Scout windowing | ~15 sessions | ~75 ops |
| **Total** | **~45 sessions/day** | **~425 ops/day** |

## Risks

1. **Missed work**: If signal file isn't updated, agent sleeps through urgent requests. Mitigation: May always writes signals on request creation; `force: true` override exists.
2. **Stale signals**: Signal file not cleaned up after work completes. Mitigation: agent clears its own signal file on heartbeat completion.
3. **Complexity**: More moving parts in May's scheduler. Mitigation: start with Phase 1 only (pure prompt change, no infra).

## Decision needed

Phase 1 is a pure prompt change — no code, no infra. Can deploy immediately by editing heartbeat.md files. Phases 2-3 require May scheduler changes.

**Recommendation**: Ship Phase 1 now, measure impact for 1 day, then decide on Phase 2-3.
