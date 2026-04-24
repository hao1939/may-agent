# KE-372: Validation Gates Between Agent Stages Prevent Drift

**Date**: 2026-04-24
**Source**: DD-874 (pAI/MSc, arXiv:2604.20622, MIT/Poggio lab)
**Confidence**: Medium-High
**Connects**: H-098 (Ch1/Ch2 channel theory), H-160 (structural enforcement), KE-182 (hard gate design rules)

## Core Finding

Multi-agent research pipelines benefit from explicit artifact validation gates between stages. pAI/MSc (23-agent academic workflow) shows that structured checks at stage boundaries—completeness, consistency, novelty, adequacy—prevent quality drift that agent judgment alone misses. Their system includes automatic repair routes when artifacts fail validation.

## Evidence

- pAI/MSc achieves ≤10 human interventions per full manuscript generation (10⁶→10³ token compression) — comparable to our Hao intervention ratio
- Their "artifact contract" pattern (named intermediate outputs + validation gates) is more rigorous than our current approach where scout→bob handoffs rely on judgment
- The paper finds that without validation gates, later stages inherit and amplify early-stage inadequacies — same mechanism as our multi-session confabulation finding (EXP-116)

## Mechanism / Why

Agent judgment degrades when operating on inherited context (EXP-116: 100% single-session → 0% multi-session). Structural validation gates act as Ch2 checkpoints that catch drift before it propagates. This is the inter-agent equivalent of our intra-agent guards (read-before-edit, verify-after-write).

## Implications

### 1. Scout→Bob handoff quality is unvalidated
Scout deep-dives go directly to bob without structural completeness checks. A gate could verify: hypothesis connections present? Actionable items listed? Evidence quality rated?

### 2. Repair routes are a missing primitive
When bob finds weak evidence, there's no automatic route back to scout. Manual re-requests add latency and lose context.

## Actionable

- Design a scout→bob validation gate that checks deep-dive completeness before bob acts on it
- Consider automatic repair routing: if bob marks a DD as "insufficient for hypothesis testing," auto-trigger scout follow-up
- This is a natural H-EXP candidate: measure whether validated handoffs reduce bob's wasted analysis cycles

## Open Questions

- How much overhead do inter-agent validation gates add? pAI/MSc's 23-agent pipeline is much larger — at our scale, is the benefit worth the cost?
- Do repair routes create loops? Need bounded retry (max 2 repair cycles) to avoid infinite scout↔bob ping-pong
