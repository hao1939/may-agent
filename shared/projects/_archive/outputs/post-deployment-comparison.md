# Post-Deployment Comparison — Agent System Literacy

**Generated**: 2026-06-25
**Purpose**: Compare post-deployment metrics to Phase 1 baseline

---

## Skills Deployed (Phase 2)

3 literacy skills deployed to 4 agents:
- **Skills**: `reading-metrics.md`, `escalation.md`, `closing-the-loop.md`
- **Target agents**: amy, amy-kimi, coach, tech-lead

---

## Metric Comparison

### 1. Skill Read Rate

| Metric | Baseline | Post-Deployment | Change |
|--------|----------|-----------------|--------|
| Projects referencing `skills/` | 4/51 (8%) | 4/51 (8%) | No change yet |
| Coach skill reads (recent 3 sessions) | 0 | 0 | No change |
| Tech-lead skill reads (recent 3 sessions) | 0 | 0 | No change |
| Amy/Amy-kimi sessions | 0 checkpoints | 0 checkpoints | No data (agents inactive) |

**Assessment**: No improvement detected yet. Coach and tech-lead have had recent sessions (359 and 124 total checkpoints respectively) but their most recent sessions still show 0 `skills/` references. Amy and amy-kimi have no checkpoint data at all — they may be inactive or don't use the checkpoint system.

### 2. Escalation Quality

| Metric | Baseline | Post-Deployment | Change |
|--------|----------|-----------------|--------|
| Structured escalations (reason + context) | Near-zero | Near-zero | No change |

**Assessment**: The `escalation.md` skill was deployed but no new structured escalations have been observed. This is expected — escalation quality only improves when agents encounter blocking situations.

### 3. Project Creation Rate

| Metric | Baseline | Post-Deployment | Change |
|--------|----------|-----------------|--------|
| Active projects | 2 | Stable | N/A (not a target metric) |

---

## Key Findings

1. **Too early to measure**: Skills were deployed very recently. Coach and tech-lead have had sessions but skill adoption requires agents to encounter relevant situations (metrics reading, escalation, closing loops).

2. **Amy and amy-kimi are inactive**: Zero checkpoint data means these agents either don't run or don't use the checkpoint system. Deploying skills to them may have no immediate effect.

3. **Skill reads remain at 0**: Even active agents (coach: 359 sessions, tech-lead: 124 sessions) show no `skills/` file references in their recent checkpoints. This suggests a deeper issue — agents may not be configured to read their `skills/` directory during sessions.

4. **Bob is the only skill reader**: The only checkpoint referencing `skills/` was bob's (session s_1777228571840_870), who was working on skill development for the gym. Bob reads skills because he creates them — not because of deployment.

---

## Recommendations for Phase 3

1. **Investigate skill loading mechanism**: Are agents prompted to read their `skills/` directory? If not, deploying files there won't help. The skill-reading behavior may need to be added to agent system prompts or heartbeat workflows.

2. **Focus on active agents**: Coach and tech-lead are the most active. Amy/amy-kimi show no activity. Prioritize interventions for agents that actually run.

3. **Measure over longer window**: Allow 1-2 weeks of agent activity before drawing conclusions. Current measurement window is too short.

4. **Consider environmental triggers**: Rather than passive skill files, consider adding skill references to agent workflows (e.g., heartbeat reads `skills/reading-metrics.md` before checking dashboards).
