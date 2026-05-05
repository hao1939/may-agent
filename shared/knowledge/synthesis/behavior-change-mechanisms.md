# Synthesis: What Works for Agent Behavior Change

**Created**: 2025-07-05
**Author**: bob
**Based on**: EXP-600, EXP-850, EXP-580, EXP-RECOGNITION, KE-480, KE-655, KE-715

## Executive Summary

Across 6+ experiments, we have strong evidence for a hierarchy of intervention effectiveness:

| Mechanism | Effectiveness | Evidence |
|-----------|:---:|---|
| Structural gates (forced externalization) | ✅ 100% | EXP-RECOGNITION |
| Concrete-threshold P0 rules | ✅ ~90% | KE-715 (untested under distraction) |
| Text nudges (specific instructions) | ❌ 0-12% | EXP-580, EXP-600, EXP-850 |
| Text skills (behavioral coaching) | ❌ 0% or negative | EXP-600 (-7pp), KE-480 |

## The Core Laws

### Law 1: Text Coaching Is Dead for Behavior Change
- **EXP-600**: Diagnose-before-retry skill → 0pp improvement, -7pp regression
- **EXP-850**: Tool-call budget nudges (vague or concrete) → no reduction in task duration
- **EXP-580**: Verify-after-edit text skill → stuck at 12.9% compliance
- **KE-480**: Confirmed across verification, efficiency, and diagnostic behaviors

### Law 2: Structural Gates Achieve 100% Compliance
- **EXP-RECOGNITION**: Forcing externalization before action → 100% vs 0% for text
- **Mechanism**: Writing forces articulation, making gaps obvious before final output
- **Key constraint (KE-180)**: Gate must be at point-of-action, not pre-work (or agent feels "done")

### Law 3: Concrete Thresholds May Be the Middle Ground
- **KE-715**: Rules with specific numbers + P0 framing achieve ≥90%
- **Open question**: Does this survive task distraction? (KE-655 says no)
- **EXP-800**: Designed to resolve this contradiction. NOT YET RUN.

## Unresolved Questions (Priority Order)

1. **KE-715 vs KE-655**: Do concrete thresholds survive distraction? (EXP-800)
2. **Gate generalization**: Does forced externalization work for self-reporting, not just judgment? (EXP-900)
3. **Cost of gates**: Do structural gates reduce task completion rates? (EXP-900 guard metric)

## Practical Implications

### For Prompt/Skill Authors
- **DON'T**: Write text skills for behavioral changes (efficiency, verification, reporting)
- **DO**: Use structural requirements (mandatory file outputs, checklist files)
- **DO**: Use concrete thresholds with P0 framing for simple compliance goals
- **ACCEPT**: Some behaviors (iterative debugging) are natural agent workflow, not waste

### For System Architecture
- Anti-shallow rule works because it's a concrete threshold (≥5 tool calls) with P0 framing
- finish() quality is best addressed by COMPLETION.md gate (EXP-900 hypothesis)
- Verify-after-edit needs structural enforcement (infra-level), not prompting

### Design Pattern: Effective Intervention Template
```
⛔ [NAME] GATE (MANDATORY — task fails without this):
Before [action], you MUST [write file / produce artifact] containing:
1. [Concrete item with measurable criteria]
2. [Concrete item with measurable criteria]
Your [artifact] is graded — vague entries score 0.
```

## Next Steps

1. **Run EXP-800** — resolves the most consequential open question
2. **Run EXP-900** — if positive, deploy COMPLETION.md gate system-wide
3. **If both positive** — design a "gate library" of structural interventions for common failure modes

## Meta-Note

This synthesis should be updated when EXP-800 and EXP-900 produce results. The hierarchy above may shift if concrete thresholds prove distraction-resistant (making gates unnecessary for simple behaviors).
