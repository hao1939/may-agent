# KE-396: Our evaluator likely suffers from the Agreement Trap

**Date**: 2026-04-25
**Source**: DD#883 (arXiv:2604.20972), H-080
**Confidence**: Medium-High
**Connects**: KE-021, DD#877, H-080

## Core Finding

Our evaluator compares agent outputs to single expected outcomes — a textbook "Agreement Trap." Research shows 33-46.6pp gaps between agreement-based and policy-grounded metrics, with ~80% of "false negatives" being valid alternative approaches.

## Evidence

- DD#883: 79.8-80.6% of agreement-metric false negatives were actually policy-grounded valid decisions
- Our system parallel: SOUL.md + skills = governance rules; expected gym outcomes = gold labels
- EXP-131/KE-134 already showed evaluation is sensitive to irrelevant context — evaluator noise is real

## Mechanism / Why

When multiple valid approaches exist (high ambiguity index), comparing to one "correct" path systematically penalizes creative/alternative solutions. This is especially acute for judgment scenarios where problem framing matters more than specific output format.

## Implications

### 1. Evaluator false-negative rate may be 30-50% on judgment scenarios
Agents scored as failing may have followed valid alternative reasoning paths derivable from their instructions.

### 2. Skill effectiveness measurements are noisy
If the evaluator penalizes valid alternatives, A/B skill comparisons (like EXP-222) have a higher floor of noise.

## Actionable

- Design EXP-223: audit 20 recent gym "failures" for defensibility — are they actually valid alternative approaches?
- Consider adding Ambiguity Index tags to gym scenarios (high-AI scenarios get relaxed eval)
- Long-term: implement defensibility-based evaluation using SOUL.md as rule hierarchy

## Open Questions

- What fraction of our gym scenarios have high ambiguity (multiple valid approaches)?
- Can we approximate PDS from agent tool-call traces without a separate audit model?
