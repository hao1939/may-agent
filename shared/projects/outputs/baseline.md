# Baseline Measurements

**Date**: 2026-07-30
**Measured by**: worker session

---

## M1: Project Creation Rate

| Metric | Value |
|--------|-------|
| Total projects | 52 |
| Active in last 7 days | 52 (all recently touched — likely batch operations) |
| Status: done | 42 (81%) |
| Status: active | 2 |
| Status: waiting | 2 |
| Status: blocked | 1 |
| Status: cancelled | 1 |
| Status: closed | 1 |
| Status: other | 3 |

**Iteration counts** (done projects):
- Median: ~6 iterations
- Range: 1–39 iterations
- Projects completing in ≤5 iters: 15 (fast)
- Projects taking >15 iters: 7 (slow — context-learning:23, workflow-first:22, breadcrumb-gap:19, convention-compliance:18, agent-autonomy:16, adaptive-heartbeats:17, prove-the-loop:39)

**Throughput**: 42 of 52 projects completed (81% completion rate). 2 currently active.

---

## M2: Escalation Quality

Measured by scanning all `journal.md` files across 52 projects for blocked/failed mentions.

| Metric | Value |
|--------|-------|
| Total blocked/failed mentions | 191 |
| With reason/context included | 149 (78%) |
| Without adequate context | 42 (22%) |

**Assessment**: 78% of escalations include a reason or context. The 22% gap represents cases where agents report "BLOCKED" or "FAIL" without explaining why — these create investigation overhead for reviewers.

**Notable patterns**:
- Evaluator FAIL scores often include structured feedback (score + reasoning) — good quality
- Worker BLOCKED escalations sometimes lack what was tried — lower quality
- Reviewer CONTINUE decisions usually include actionable next steps

---

## M3: Skill Read Rate

Measured by checking `context.md` files for skill references across all agents.

| Agent | Skill refs in context.md | Has own skills/ dir |
|-------|--------------------------|---------------------|
| amy | 1 | ✅ |
| amy-kimi | 0 | ✅ |
| bob | 1 | ✅ |
| coach | 1 | ✅ |
| coder | 0 | ✅ |
| evaluator | 0 | ✅ |
| may | 0 | ✅ |
| optimizer | 1 | ✅ |
| qa | 0 | ✅ |
| scout | 1 | ✅ |
| tech-lead | 1 | ✅ |

**Summary**: 6 of 11 agents (55%) reference skills in their context. 5 agents (45%) have skills directories but zero references in context — meaning those skills exist but may never be loaded.

**Skill inventory**: 
- Shared skills: ~10 files in `/agents/shared/skills/`
- Agent-specific skills: varies (coder has 5, scout has 9, bob has 11)
- `reading-metrics` skill exists in both shared and gym-scenario copies
- The shared `reading-metrics/skill.md` already includes a "close the loop" step (step 5) with the evolution ladder: skill → guard → handler

---

## Phase 2 Status: Reading-Metrics Skill

The `reading-metrics` skill at `/agents/shared/skills/reading-metrics/skill.md` **already contains** a "close the loop" step (Step 5) with:
- Guard writing guidance
- Handler automation guidance  
- Skill creation guidance
- The evolution ladder concept (skill → guard → handler)

The gym-scenario copy at `/agents/gym/scenarios/metric-reaction/environment/skills/reading-metrics.md` does **not** have this step — it only has 4 steps. This copy should be updated to match.

---

## Key Findings

1. **Project throughput is healthy** — 81% completion rate across 52 projects
2. **Escalation quality needs improvement** — 22% of escalations lack context, costing reviewer time
3. **Skill adoption is partial** — 45% of agents don't reference skills in context, suggesting skills may be written but not consumed
4. **Reading-metrics skill is already updated** — shared version has close-the-loop step; gym copy is stale
