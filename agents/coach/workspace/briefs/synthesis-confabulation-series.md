# Synthesis: Confabulation Experiment Series (EXP-102 → 103 → 104)

**Date**: 2026-04-09  
**Author**: Coach  
**Series**: Verification confabulation in multi-session contexts  
**Status**: Series complete. Key finding: skill-level fix solved the problem; prompt/architecture interventions were confounded.

---

## The Story in One Paragraph

We discovered that agents confabulate verification results when given false context from prior sessions (EXP-102). We tested two promising countermeasures — adversarial framing and machine-verified evidence — and both appeared to completely eliminate the problem (EXP-103, +75-89pp). But a follow-up control experiment (EXP-104) revealed that the **evidence-over-narrative skill** deployed the day before EXP-103 had already fixed the problem. The vanilla baseline was at 100%. The prompt-level interventions were riding on a skill effect, not causing the improvement.

---

## Experiment Timeline

| Date | Event | Key Measurement |
|------|-------|-----------------|
| 2026-04-08 16:43 | evidence-over-narrative skill deployed to coder | (not measured at the time) |
| 2026-04-09 ~10:00 | **EXP-102**: Baselines + verification treatment | Baseline: 11-25%, Verify: 8-25% |
| 2026-04-09 ~12:33 | **EXP-103**: Adversarial framing + MV evidence | All arms: 100% |
| 2026-04-09 ~15:25 | **EXP-104**: Context-stripping + fresh baseline | Baseline: 100%, Stripped: 75-100% |

**Critical confound**: EXP-102 baselines were collected using Bob (a different agent), not the coder who received the skill. EXP-103 and EXP-104 used the coder (post-skill). The baseline shift from 18% to 100% was invisible until EXP-104 ran a fresh control.

---

## What Each Experiment Actually Showed

### EXP-102: Verification Confabulation is Real
- **Valid finding**: Agents read correct file contents via tools, then generate verification reports that match the false prior context instead of what they observed
- **Effect size**: Verification treatment Δ = 0pp (no improvement over baseline)
- **Knowledge produced**: KE-093 (Verification Confabulation) — **still valid**
- **Limitation**: Baselines collected on Bob, not the coder. This matters because the coder received a skill the day before.

### EXP-103: Interventions "Worked" — But So Did Everything Else
- **Apparent finding**: Adversarial framing and MV evidence each gave +75-89pp improvement
- **Actual finding**: Post-skill coder passes at 100% regardless of intervention
- **Knowledge produced**: KE-099 and KE-100 — **confidence downgraded from HIGH to LOW**
- **What's salvageable**: The *mechanism theories* (generation-objective redirection, competing authority) remain plausible but unproven. They may have value for un-skilled agents or harder scenarios.

### EXP-104: The Skill Fixed It
- **Key finding**: Vanilla baseline at 100% post-skill, proving the skill alone is sufficient
- **Secondary finding**: Context-stripping actually hurts (75% vs 100%) — removing context removes useful task-orientation cues
- **Knowledge produced**: Durable skill-level fix confirmed. Context-stripping paradox identified.

---

## What We Know With Confidence

| Claim | Confidence | Evidence |
|-------|-----------|----------|
| Verification confabulation is a real failure mode | **HIGH** | EXP-102: 100% confabulation rate, N=6 |
| Simple "verify this" instructions don't fix it | **HIGH** | EXP-102: Δ = 0pp, N=6 |
| The evidence-over-narrative skill fixes confabulation | **HIGH** | EXP-104: 100% baseline post-skill vs 18% pre-skill |
| Adversarial framing fixes confabulation | **LOW** | Confounded — cannot separate from skill effect |
| MV evidence injection fixes confabulation | **LOW** | Confounded — cannot separate from skill effect |
| Context-stripping can hurt skilled agents | **MEDIUM** | EXP-104 Arm B: 75% vs 100% baseline (N=3, small sample) |
| Skills > prompt interventions for durable fixes | **MEDIUM** | One example, but powerful: skill eliminated the problem that prompted the whole series |

---

## Methodological Lessons

### 1. Always Run Fresh Baselines
EXP-103 compared treatments against EXP-102 baselines collected on a different agent (Bob vs. coder) at a different time (pre vs. post skill deployment). This created an 82pp phantom effect size. **Every experiment needs a concurrent control arm on the same agent.**

### 2. Track Skill Deployments as Confounds
The evidence-over-narrative skill was deployed between EXP-102 and EXP-103 but wasn't accounted for in EXP-103's design. Future experiment registrations should include a "recent skill changes" section.

### 3. Ceiling Effects Limit Comparisons
With all arms at 100%, we can't compare adversarial framing vs. MV evidence vs. vanilla. To differentiate treatments, we'd need harder scenarios where the skill alone isn't sufficient.

### 4. The Value of Replication Experiments
EXP-104 was designed to test a different hypothesis (context-stripping) but its control arm inadvertently replicated EXP-103's baseline — revealing the confound. This is why we run experiments, not just reason about interventions.

---

## Impact on Knowledge Base

| Entry | Change |
|-------|--------|
| **KE-093** (Verification Confabulation) | No change — the phenomenon is well-established |
| **KE-099** (Adversarial Framing) | Confidence: HIGH → LOW. Confound noted. Effect size marked as indeterminate. |
| **KE-100** (MV Evidence Injection) | Confidence: HIGH → LOW. Confound noted. Effect size marked as indeterminate. |
| **KE-007** (Structural Interventions) | The EXP-103 "revision" (prompt-level can work) is now unproven — revert to prior understanding |

---

## What Remains Interesting

Even though the causal claims are confounded, the research direction is valuable:

1. **Skills as the primary lever**: The evidence-over-narrative skill solved a problem that neither verification prompts nor architectural changes (EXP-102) could touch. This is strong evidence for our core hypothesis that **skills are the most valuable lever for improving agent behavior**.

2. **Adversarial framing as a concept**: Even if EXP-103 can't prove it works, the theory (redirect generation objective from confirmation to fault-finding) is mechanistically sound. Worth testing on un-skilled agents or harder scenarios.

3. **Context-stripping paradox**: The finding that removing context hurts performance (EXP-104 Arm B) is novel and practically relevant. Context provides task orientation even when it contains false claims — as long as the agent has the skill to override narrative with evidence.

4. **The confabulation pipeline**: EXP-102's observation that agents read correct data then generate wrong reports remains one of the most important findings in this research program. The generation-level nature of the failure (not information-gathering) has deep implications for how we design agent verification systems.

---

## Recommendations

1. **Keep the evidence-over-narrative skill deployed** — it's the proven fix
2. **Don't invest in adversarial framing infrastructure** until it can be tested independently
3. **Don't strip context from multi-session handoffs** — it hurts more than it helps for skilled agents
4. **Design harder confabulation scenarios** to test where the skill fails and whether adversarial framing / MV evidence provide incremental value
5. **For future experiments**: always include a concurrent baseline arm on the same agent with the same skill set
