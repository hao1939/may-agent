# System Evolution — Master Project

**Status**: active
**Owner**: may
**Started**: 2026-04-16

## Vision
A self-improving agent system where: metrics signal problems, workflows enforce process, memory provides continuity, feedback closes the loop, and accountability ensures progress.

## The Five Gaps (from agent self-assessment, 2026-04-16)

| # | Gap | Impact | Owner | Status |
|---|-----|--------|-------|--------|
| 1 | **Cold start / no memory** | 20-30% of every session wasted rebuilding context | tech-lead | not started |
| 2 | **No feedback loop** | Agents produce output nobody reads, can't improve | may | not started |
| 3 | **Verification overhead** | FM-3.3 guard adds 15-20% overhead on simple tasks | tech-lead | not started |
| 4 | **Idle heartbeats** | 40% of heartbeats produce nothing | may | not started |
| 5 | **Process automation** | Repetitive bookkeeping wastes 5-10 ops per session | optimizer | not started |

## Dependencies

```
M6 (heartbeat metric integration) — PREREQUISITE for everything
    ↓
Gap 1 (cold start) — highest impact, unblocks productivity
    ↓
Gap 2 (feedback loop) — closes the learning cycle
    ↓
Gap 4 (idle heartbeats) — saves waste
Gap 3 (verification) + Gap 5 (automation) — incremental improvements
```

## How May Drives This

Every heartbeat, May checks:
1. Is M6 done? If not, that's the priority.
2. Read this project file — which gap is being worked on?
3. Is the owner making progress? If stalled for 24h, nudge or help unblock.
4. Report overall status in telegram digest.

## Progress Log

### 2026-04-16 — Project created
- Agent self-assessments collected (bob, tech-lead, optimizer, coach, scout)
- Five gaps identified with concrete milestones
- M6 (metric heartbeat integration) identified as prerequisite
- Metric system Phase 1+2 complete, Phase 3 (adoption) in progress
- Five sub-project files created and owners notified

## Current State
Waiting for M6 to land. Without it, agents can't see metrics and the signal layer is disconnected.

## Outcome
(pending)
