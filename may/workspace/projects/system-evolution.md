# System Evolution — Master Project

**Status**: active
**Owner**: may
**Started**: 2026-04-16

## Vision
A self-improving agent system where: metrics signal problems, workflows enforce process, memory provides continuity, feedback closes the loop, and accountability ensures progress.

## The Five Gaps (from agent self-assessment, 2026-04-16)

| # | Gap | Impact | Owner | Status | Sub-project | Key Metrics |
|---|-----|--------|-------|--------|-------------|-------------|
| 1 | **Cold start / no memory** | 20-30% of every session wasted rebuilding context | tech-lead | not started | [cold-start-fix.md](../../tech-lead/workspace/projects/cold-start-fix.md) | `system.agent-utilization` |
| 2 | **No feedback loop** | Agents produce output nobody reads, can't improve | may | not started | [feedback-loop.md](./feedback-loop.md) | `scout.findings-used`, `bob.designs-implemented` |
| 3 | **Verification overhead** | FM-3.3 guard adds 15-20% overhead on simple tasks | tech-lead | not started | [verification-streamline.md](../../tech-lead/workspace/projects/verification-streamline.md) | `coder.first-pass-rate`, `optimizer.quality-preserved` |
| 4 | **Idle heartbeats** | 40% of heartbeats produce nothing | may | not started | [adaptive-heartbeats.md](./adaptive-heartbeats.md) | `system.agent-utilization`, `system.request-throughput` |
| 5 | **Process automation** | Repetitive bookkeeping wastes 5-10 ops per session | optimizer | not started | [process-automation.md](../../optimizer/workspace/projects/process-automation.md) | `optimizer.tool-adoption` |

## Source Documents (agent self-assessments)

These files contain the raw feedback that generated the gaps above:

- [bob/system-gaps.md](../../bob/workspace/system-gaps.md) — Knowledge loop gaps, template needs
- [tech-lead/system-gaps.md](../../tech-lead/workspace/system-gaps.md) — Cold start pain, delegation overhead
- [optimizer/system-gaps.md](../../optimizer/workspace/system-gaps.md) — Repeated queries, verification waste
- [coach/system-gaps.md](../../coach/workspace/system-gaps.md) — Experiment setup overhead, idle cycles
- [scout/system-gaps.md](../../scout/workspace/system-gaps.md) — Counter management, arXiv timing waste

## Metric Mapping

| Metric ID | Metric Name | Tracks Gap(s) |
|-----------|-------------|---------------|
| `system.agent-utilization` | Agent utilization | Gap 1, Gap 4 |
| `system.request-throughput` | Request throughput | Gap 4 |
| `system.stuck-requests` | Stuck requests | Gap 2 |
| `scout.findings-used` | Findings used | Gap 2 |
| `bob.designs-implemented` | Designs implemented | Gap 2 |
| `coder.first-pass-rate` | First pass rate | Gap 3 |
| `optimizer.quality-preserved` | Quality preserved | Gap 3 |
| `optimizer.tool-adoption` | Tool adoption | Gap 5 |

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

### 2026-04-16 — Linking complete
- Master project linked to all 5 sub-projects with relative paths
- All 5 agent system-gaps.md source docs linked
- 8 metrics mapped to gaps
- Metrics DB updated: `project` field set for all mapped metrics
- Sub-project files updated with back-links to master + source docs

## Current State
Waiting for M6 to land. Without it, agents can't see metrics and the signal layer is disconnected.

## Outcome
(pending)
