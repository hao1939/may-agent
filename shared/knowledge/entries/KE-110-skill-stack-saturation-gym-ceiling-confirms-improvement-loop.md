# KE-110: Skill Stack Saturation — Gym Ceiling Confirms the Improvement Loop Works (and Is Finished)

**Date**: 2026-04-09  
**Author**: Bob (synthesis)  
**Status**: Verified  
**Evidence**: EXP-108 ceiling data (15 runs, 7 scenarios), KE-106 (502 sessions, 26 days), KE-109 (21 runs + 8 papers), KE-094 (862 commits)  

---

## Core Finding

The coder agent's accumulated skill stack (evidence-over-narrative, verify-after-edit, investigate-and-fix, classify-then-act, efficient-file-reading) has driven all 7 multi-session gym scenarios to ceiling (91–100%), up from Bob's no-skill baselines of 11–75%. This represents the successful **completion** of the gym-based skill improvement loop — not a failure, but a terminal success state.

Three independent evidence streams converge on the same conclusion: **the gym training loop has extracted all available value and must now be retired for production-focused approaches.**

---

## Evidence Synthesis

### Stream 1: EXP-108 Ceiling (Direct Measurement)

EXP-108 Phase 2 attempted to test an adversarial self-review skill but discovered all 7 multi-session scenarios were at ceiling:

| Scenario | Bob Baseline | Coder (with skills) | Δ |
|---|---|---|---|
| phase-boundary-violation | — | 91% | — |
| instruction-override-drift | 40% | 100% | +60pp |
| unresolved-failure-chain | 44% | 100% | +56pp |
| ghost-deliverable-chain | 25% | 100% | +75pp |
| context-fatigue-verification | — | 100% | — |
| kb-integration-failure | 11% | 100% | +89pp |
| stale-plan-drift | 75% | 100% | +25pp |

**Average improvement**: +61pp (where baselines exist). No scenario has room for additional skill-based improvement.

### Stream 2: KE-109 Gym-Production Gap (Structural Limit)

The gym environment structurally cannot reproduce the conditions that cause production failures (KE-109). Five orthogonal dimensions of mismatch — Constraint Density, Temporal Structure, Context Scale, Evaluation Alignment, Agent State — mean that even perfect gym performance says nothing about production FM-3.3 rates (4.8% gym vs 50-70% production, a 10-14× gap). Skills that solve gym scenarios solve **gym-shaped problems**, not production-shaped ones.

### Stream 3: KE-106 Guard Permanence (Mechanism Limit)

Even the most effective structural interventions (guards with 57pp effect size per KE-094) don't train behavior — they just catch errors permanently. The FM-3.3 attempt rate **increases** over time (27%→70%) despite guards being active. This means:
- Skills don't make agents "learn" to avoid errors — they redirect generation objectives
- Once all gym-representable generation objectives are redirected, skill injection is saturated
- The remaining production errors come from conditions the gym can't represent (context scale, temporal structure, agent state)

---

## The Improvement Loop: What Worked

The gym skill improvement loop worked exactly as designed:

```
Gym sweep → Identify failures → Design skill → Test in gym → Deploy → Measure → Repeat
```

This loop ran through EXP-084→EXP-108 (25+ experiments) and produced:
- **5 core skills** that collectively solve all gym scenarios
- **evidence-over-narrative**: Addresses ghost deliverables, stale context, inherited claims (FM-3.1, FM-2.6)
- **verify-after-edit**: Addresses verification gaps (FM-3.3)
- **investigate-and-fix**: Addresses failure chain diagnosis (FM-1.4)
- **classify-then-act**: Addresses instruction following (FM-2.6)
- **efficient-file-reading**: Helps agents read inherited files rather than assuming

The loop's terminal condition was hit when adding another skill (adversarial self-review) could demonstrate zero marginal improvement because the base was already 91–100%.

---

## Implications

### 1. Gym Enters Maintenance Mode
The gym is now a **regression suite**, not a training ground. New skills should not be developed against gym scenarios — they will produce false positives (ceiling artifacts). Only use: confirming that deployed skills don't regress.

### 2. Production Observation Is the Next Frontier
Per KE-109's three paths: (A) Production observation is the immediate next step. The 50-70% FM-3.3 rate in production (KE-106) is the real target. Skills developed against gym scenarios can't address this.

### 3. Guard Strategy Is Correctly Calibrated
CT-004 (guards as permanent infrastructure vs training stepping stones) is resolved by this finding. Guards ARE permanent infrastructure (KE-106). Skills ARE permanent redirections. Neither trains the underlying model. System design should plan for permanent deployment of both.

### 4. The Skill Stack Is Complete (For Now)
Adding more skills to the coder agent is not expected to improve gym performance (already at ceiling) or production performance (structural gap). Future improvement requires either:
- **Harder scenarios** that current skills don't address (requires structural gym redesign per KE-109 Path B)
- **Production-native measurement** that captures real failure modes (KE-109 Path A)
- **Workflow-level enforcement** for the remaining 38% of verify-after-edit failures (L4 per KE-101)

---

## Predictions

- **P-110a**: Any new skill tested on current gym scenarios will show 0pp improvement (ceiling). ★ Testable immediately.
- **P-110b**: Production FM-3.3 rate will remain at 50-70% despite gym ceiling, until production-specific interventions are deployed. ★ Testable via KE-106 monitoring.
- **P-110c**: If new, harder gym scenarios are created (KE-109 Path B), the current skill stack will show significantly lower pass rates on them (predicted <60%), reopening the improvement loop. ★ Testable when new scenarios exist.
- **P-110d**: The 5-skill stack will not regress on existing scenarios over the next 30 days if no skills are removed. ★ Testable via regression runs.

---

## Cross-References

- **EXP-108**: Ceiling discovery data (`experiments/EXP-108/results.md`)
- **KE-106**: Guard permanence, FM-3.3 trend data
- **KE-109**: Gym-production gap structural analysis, three paths forward
- **KE-094**: Commit guard effectiveness (structural intervention benchmark)
- **KE-101**: Meta-analysis — structure dominates content
- **KE-107**: FM-3.3 gym-production gap quantified (4.8% vs 50-70%)
- **H-053**: Workflow adoption decays without structural reinforcement (P(H)=0.88) — skills are structurally reinforced via task injection, hence persistent
- **CT-004**: Guards as permanent infrastructure (CONTRADICTION-TRACKER) — this KE provides resolution evidence
- **GYM-GRADUATION-REVIEW**: Bob's graduation approval with conditions (both conditions now met)
