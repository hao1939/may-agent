# Metric Design: skill.usefulness-rate

**Key insight**: "Deployed doesn't mean used, used doesn't mean useful."

## The Problem

Current metrics measure:
- **skill.delivery-rate** (0.81) — are skills deployed to agents? ← deployment
- **skill.usage-rate** (0.89) — do agents exhibit skill behaviors? ← usage
- **skill.verified-rate** (0.90) — do skills pass verification? ← structural validity

None measure whether applying a skill **actually improved outcomes**.

## Proposed Metric

**skill.usefulness-rate** = proportion of skill applications that improved outcomes vs. not applying the skill.

### Definition

```
skill.usefulness-rate = sessions_with_skill_and_good_outcome / sessions_with_skill_applied
```

Where "good outcome" means ALL of:
1. **First-pass success**: finish() status = "success" (not "partial" or "failure")
2. **No rework**: session was not followed by a retry/redo of the same task
3. **No deliverable rejection**: orchestrator/caller did not reject the output

### Measurement Methodology

**Data source**: Session logs in `.state/sessions/`

**Scoring procedure** (per session):
1. Identify which skills were applied (behavioral evidence, same method as skill.usage-rate)
2. Check finish status: success = +1, partial/failure = 0
3. Check if a follow-up session redid the same task (rework indicator): grep for same task description in subsequent sessions
4. Check orchestrator response (if workflow session): did caller accept or reject?

**Rework detection heuristic**:
- Same agent + similar task description (>60% token overlap) within 2 hours = rework
- Orchestrator saying "failed", "try again", "didn't produce" = rejection

### Scoring Matrix

| Skill Applied? | Good Outcome? | Counts as... |
|----------------|---------------|--------------|
| Yes | Yes | Useful (numerator + denominator) |
| Yes | No | Not useful (denominator only) |
| No | Yes | N/A (not scored) |
| No | No | N/A (not scored) |

### Target

- **Initial target**: 0.70 (70% of skill-applied sessions achieve good outcomes)
- **Stretch target**: 0.85
- **Baseline**: TBD (requires first measurement pass)

### Implementation Plan

1. **Manual first**: Score 15 sessions manually using the procedure above
2. **Semi-automate**: Script that extracts finish status + rework detection
3. **Per-skill breakdown**: Track which skills correlate with better outcomes vs. which don't help

### Per-Skill Usefulness (future)

The most valuable cut is per-skill:
```
skill.usefulness-rate[verify-before-finish] = 0.92
skill.usefulness-rate[structured-approach]  = 0.78
skill.usefulness-rate[read-before-edit]     = 0.85
```

Skills with usefulness < 0.50 should be revised or retired. This creates a feedback loop: deploy → measure usage → measure usefulness → revise/retire.

### Regression Detection

Compare usefulness-rate across time windows:
- If a skill's usefulness drops >15pp over 2 weeks → flag for investigation
- New skills start with a 2-week probation period requiring usefulness ≥ 0.60
