# KE-212: Compliance ≠ Internalization — The Measurement Gap

**Date**: 2026-04-18
**Source**: DD-752 (McDaniel et al. 2025 — "Individual Differences in Student Learning")
**Confidence**: Medium
**Connects**: KE-137 (learner/reliant split), KE-144 (guard bifurcation), KE-211 (inoculation prompting), DD-752

## Core Finding

Self-report measures of "deep" vs. "surface" learning **do not correlate** with objective task-based learning classifications. Students who report deep approaches often use surface strategies on objective tasks, and vice versa. This is a methodological warning: **compliance rate and self-reported understanding are invalid proxies for genuine internalization**.

## Evidence

- McDaniel et al.: Exemplar learners (pattern-match specific cases) vs. abstraction learners (extract transferable rules) — classification based on objective function-learning tasks, not self-report
- Self-report learning approach measures showed no significant correlation with objective classification
- Conceptual parallel: exemplar learners ≈ reliants (follow guards case-by-case), abstraction learners ≈ learners (internalize principles)

## Mechanism / Why

Compliance is observable behavior; internalization is latent state. Observable behavior is a noisy signal for latent state because compliance can be driven by enforcement (external) or understanding (internal). Only behavioral transfer tests — measuring quality in contexts where the guard is absent — can distinguish the two.

## Implications

### 1. Guard compliance metrics are unreliable
High compliance rate during guarded conditions tells us nothing about whether the agent has learned the underlying quality principle. We need transfer tests.

### 2. Need objective internalization measures
Following DD-752's methodology: test internalization through novel-context transfer, not through compliance rate or "did the agent say it understood."

## Actionable

- Stop using guard compliance rate as evidence of learning effectiveness
- Always include guard-removal conditions in experiments measuring learning (already in EXP design, but this reinforces why)
- Design transfer tests: after guard exposure, present a novel but analogous situation without the guard — measure quality

## Open Questions

- What's the minimum guard exposure duration before transfer testing is meaningful?
- Can we distinguish exemplar/abstraction learning styles in LLM agents, or is the distinction only meaningful for humans?
