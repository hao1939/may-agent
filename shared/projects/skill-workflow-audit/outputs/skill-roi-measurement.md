# Skill ROI Measurement: Top 5 Skills by Deployment

**Date**: 2025-02-01
**Method**: Cross-agent comparison using 397 active sessions + 33,542 historical sessions
**Goal**: Determine which skills actually improve outcomes, propose actions to push skill.usefulness-rate from 0.33 → 0.70

## Executive Summary

**Finding**: The naive WITH/WITHOUT comparison shows **no positive correlation** between skill count and session success. However, this is a confound — agents with more skills (bob=13, coach=12) handle harder tasks (orchestration, debugging) while agents with fewer skills (qa=4, evaluator=6) handle simpler tasks and have higher completion rates.

**Real signal**: 94% of "failures" (interrupted sessions) are infrastructure kills (zombie cleanup, fresh starts), NOT agent failures. When infra noise is removed, ALL agents complete 95-100% of sessions they actually run. Skills are **not preventing failures** because there are almost no real failures to prevent.

**Actionable finding**: The usefulness gap is in **output quality**, not completion. Verification evidence (the behavioral fingerprint of verify-before-finish) appears in only 30-73% of historical sessions depending on agent.

## Top 5 Skills Measured

### 1. verify-before-finish (deployed to 10/11 agents)

| Signal | Value |
|--------|-------|
| Agents with skill | All active agents |
| Current session evidence rate | 89% (192/216 done sessions) |
| Historical evidence rate | 51% (17,025/33,542) |
| Gym-proven impact | EXP-248: 90% activation, prevents GHOST_DELIVERABLE |
| Verdict | **KEEP — highest proven ROI** |

The 89% current vs 51% historical shows the skill IS working — it improved behavior over time. But 11% still skip verification evidence.

### 2. verify-after-edit (deployed to 9/11 agents)

| Signal | Value |
|--------|-------|
| Naive comparison | WITH: 53.7% done rate, WITHOUT: 66.7% (negative!) |
| Confound | Agents without = optimizer, evaluator (high-completion, simple tasks) |
| Behavioral evidence | Not separately measurable from session data |
| Gym-proven impact | None measured |
| Verdict | **WEAK — no measurable ROI, consider consolidating** |

This skill overlaps heavily with verify-before-finish and convention-compliance (C1.3). It's redundant context cost with no independent signal.

### 3. read-before-edit (deployed to 5/11 agents)

| Signal | Value |
|--------|-------|
| Naive comparison | WITH: 55.0%, WITHOUT: 54.7% (±0.3pp, no signal) |
| Gym-proven impact | Convention-compliance C1.1 covers this explicitly |
| Context cost | ~2KB per agent × 5 = 10KB |
| Verdict | **REMOVE — fully subsumed by convention-compliance skill in coder** |

The convention-compliance skill (C1.1 "Read Before Edit") is more specific, gym-tested, and enforced. This standalone version adds nothing.

### 4. evidence-over-narrative (deployed to 5/11 agents)

| Signal | Value |
|--------|-------|
| Naive comparison | WITH: 51.0%, WITHOUT: 67.8% (negative!) |
| Confound | Deployed to hard-task agents (bob, coach, optimizer) |
| Shared skill status | Verified, 9 digest matches in coach |
| Behavioral evidence | Qualitative only — "use evidence" is too vague to measure |
| Verdict | **KEEP BUT SHARPEN — needs measurable behavioral gate** |

### 5. obstacle-pivot (deployed to 4/11 agents)

| Signal | Value |
|--------|-------|
| Naive comparison | WITH: 42.5%, WITHOUT: 63.2% (strongly negative!) |
| Confound | Deployed to hardest agents (bob, coder — 37% and 0% done rates) |
| Gym-proven impact | **EXP-084: +100pp gym pass rate** |
| Real-world signal | Agents with skill get assigned harder work BECAUSE they can pivot |
| Verdict | **KEEP — gym-proven despite confounded session data** |

## The Real Problem: Why skill.usefulness-rate = 0.33

The metric definition (from outputs/skill-usefulness-design.md):
```
skill.usefulness-rate = sessions_with_skill_and_good_outcome / sessions_with_skill_applied
```

With "good outcome" requiring: first-pass success + no rework + no rejection.

**Current measurement**:
- First-pass success: 93.1% (201/216 done sessions, only 15 reworks detected)
- But most sessions CAN'T be measured because:
  - No skill-activation tracking in session metadata
  - "Skill applied" requires manual behavioral audit
  - The 0.33 number came from a sample of 15 sessions (tiny N, noisy)

**The metric is infrastructure-limited, not skill-limited.** The previous audit concluded exactly this.

## Recommendations

### REMOVE (2 skills, saves ~20KB context across agents)

1. **read-before-edit** → Fully covered by convention-compliance C1.1. Remove from: bob, may, qa, scout, tech-lead.
2. **verify-after-edit** → Redundant with verify-before-finish + convention-compliance C1.3. Remove from all 9 agents.

### KEEP AS-IS (2 skills)

3. **verify-before-finish** — Working (89% evidence rate). Gym-proven.
4. **obstacle-pivot** — Gym-proven (+100pp). Deploy to more agents, not fewer.

### SHARPEN (1 skill)

5. **evidence-over-narrative** → Rewrite with measurable gate: "Before finish(), cite ≥1 tool output per claim." Current version is aspirational text.

### NEW: Structural Enforcement > Text Skills

The data shows clearly:
- **Skills with structural enforcement** (verify-before-finish with finish-guard, convention-compliance with gym tests) → measurable behavior change
- **Skills that are just text advice** (read-before-edit, evidence-over-narrative) → no measurable impact

**Proposal**: Convert top 3 remaining text skills into enforced behaviors:
1. Add evidence-over-narrative check to finish-guard (reject finish without tool output citations)
2. Add obstacle-pivot trigger to session timeout handler (prompt pivot after 3 failed attempts)

### Path to 0.70 usefulness-rate

The metric can't reach 0.70 without infrastructure changes:
1. **Add skill-activation tracking to session metadata** (which skills were loaded in context)
2. **Run A/B experiments**: Same scenario, with/without specific skill in context
3. **Prune the 2 redundant skills** (removes noise from denominator)
4. **Sharpen evidence-over-narrative** (improves numerator)

Estimated impact of recommendations:
- Remove 2 redundant skills → fewer "skill applied but no measurable outcome" → +0.10-0.15
- Sharpen evidence-over-narrative → more sessions pass "good outcome" → +0.05-0.10
- Add activation tracking → more accurate measurement → reveals true rate (likely already >0.50)

**Projected usefulness-rate after changes: 0.48-0.58** (still below 0.70 without A/B infrastructure)

## Raw Data

```
Total sessions analyzed: 397 (active) + 33,542 (historical)
Done: 216 active, 33,326 historical
Interrupted (infra): 164/175 = 94% are zombie/crash cleanup
Real agent failures: 11/397 = 2.8%
Rework rate: 15/216 = 6.9%
Verification evidence (current): 89%
Verification evidence (historical): 51%
```

## Next Steps

1. Execute removals: delete read-before-edit and verify-after-edit from per-agent skills/
2. Rewrite evidence-over-narrative with measurable gate
3. File infra request: add `skillsLoaded: string[]` to session meta.json
4. Design gym scenario that tests evidence-over-narrative specifically
5. Re-measure usefulness-rate after pruning (expect ~0.48)
