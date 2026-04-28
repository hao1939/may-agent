# Skills Deployment v2: error-handling & state-check-before-action

**Date**: 2026-06-25
**Milestone**: "Deploy top 5 skills to agents, run 3 sessions before/after, measure behavior change"

## Skills Deployed

### 1. error-handling (v1.3.0)
- **What**: No-silent-failures, structured escalation, retry loops, tool grounding, path discovery, edit ambiguity recovery
- **Targets**: FM-2.6 (silent abandon), FM-2.5 (malformed tool calls), FM-2.4 (overclaiming)

### 2. state-check-before-action (v1.0.0)
- **What**: Verify preconditions before every mutating operation (edit/write/destructive bash)
- **Targets**: FM-1.1 (path confusion), FM-2.6 (reasoning-action mismatch), cascading edit failures

## Deployment Targets

| Agent | error-handling | state-check-before-action | Method |
|-------|:-:|:-:|--------|
| **coder** | ✅ | ✅ | Added `## Active Skills` section to `agents/coder/context.md` |
| **tech-lead** | ✅ | ✅ | Added `## Active Skills` section to `agents/tech-lead/context.md` |
| **scout** | ✅ | ✅ | Added `## Active Skills` section to `agents/scout/context.md` |

**Total**: 6 skill references deployed (2 skills × 3 agents)

## Why These Agents

- **coder**: 41 evals/week, avg quality 0.948, avg efficiency 0.775. Has verification failures and edit issues — SCBA directly addresses these.
- **tech-lead**: 959 evals/week (highest volume), avg quality 0.922, avg efficiency 0.756. Has `session_error` (9x) and `shallow_session` (6x) — error-handling addresses silent failures.
- **scout**: 489 evals/week, avg quality 0.934, avg efficiency 0.766. Has `session_error` (5x) and verification gaps — both skills address these.

## Why These Skills

- **error-handling**: Directly addresses the top issue across all agents (`session_error` = 14 total occurrences in past week). Teaches structured recovery instead of silent failures.
- **state-check-before-action**: Addresses cascading edit failures which waste tool calls. Data from the skill itself shows 50-97% edit failure rate without SCBA vs 0-5% with it.

## Baseline Metrics (Pre-Deployment, Past 7 Days)

| Agent | Sessions | Avg Quality | Avg Efficiency | Top Issues |
|-------|----------|-------------|----------------|------------|
| coder | 41 | 0.948 | 0.775 | verification_failure, edit failures |
| tech-lead | 959 | 0.922 | 0.756 | session_error (9), shallow_session (6) |
| scout | 489 | 0.934 | 0.766 | session_error (5), shallow_session (4), verification_gap |

## Deployment Method

Skills are referenced in each agent's `context.md` as `## Active Skills` section with 📘 markers pointing to the shared skill SKILL.md files. This follows the established pattern from bob's context.md (which already references SCBA).

The reference format:
```
📘 **Skill Name**: Read `agents/shared/skills/<skill>/SKILL.md` — brief description of what it covers.
```

This is a "passive reference" approach — agents are told to read the skill file. Per scout's own research (EXP-084/085), few-shot worked examples produce strongest behavior change, but structured process skills (like SCBA) show 33-100% effect — significantly above the 0% for simple outcome declarations.

## Files Modified

1. `/app/agents/coder/context.md` — Added `## Active Skills` with error-handling + SCBA references
2. `/app/agents/tech-lead/context.md` — Added `## Active Skills` with error-handling + SCBA references
3. `/app/agents/scout/context.md` — Added `## Active Skills` with error-handling + SCBA references

## Measurement Plan

### After Metrics (to collect in 3-7 days)
Re-run this query to get post-deployment stats:
```sql
-- Run via bun:sqlite against .state/may.db
SELECT agent, COUNT(*) as cnt, AVG(quality) as avg_q, AVG(efficiency) as avg_e
FROM evaluations 
WHERE agent IN ('coder','tech-lead','scout') 
  AND createdAt > <deployment_timestamp>
GROUP BY agent
```

### Key Metrics to Compare
1. **Avg Quality**: Expect improvement in tech-lead and scout (currently lowest)
2. **Avg Efficiency**: Expect improvement from fewer wasted calls (SCBA effect)
3. **session_error count**: Expect reduction (error-handling skill)
4. **Edit failure rate**: Expect reduction in coder (SCBA skill)

### Success Criteria
- Quality improves by ≥0.01 for at least 2/3 agents
- Efficiency improves by ≥0.02 for at least 2/3 agents  
- session_error count drops by ≥30%

## Existing Skill Deployments (Context)

This is the second wave of skill deployment. Previous deployment (v1, 2026-06-24) deployed reading-metrics, closing-the-loop, and escalation to 6 agents. Bob already had SCBA in context.md from earlier work.

## Gym Validation

The `skill-delivery-obstacle-pivot` gym scenario exists and tests skill delivery for obstacle-pivot. No CLI gym runner is available for direct execution — gym runs are dispatched through the agent system. The scenario validates that agents with skill references in context.md actually read and apply the skills.

**Recommendation**: Have bob run the gym scenario for `skill-delivery-obstacle-pivot` with coder as agent_type to validate the new SCBA+error-handling deployment pattern works end-to-end.
