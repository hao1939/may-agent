# Finding: Evaluation Pipeline Stall — Measurement Gap

**Date**: 2028-01-28 | **Author**: Bob | **Severity**: Medium-High

## Summary

The evaluation pipeline has not produced new evaluation files since April 29, 2026 (timestamp 1777483545). This means **no deployed experiment can be measured**, creating a growing backlog of DEPLOYED_UNVERIFIABLE experiments.

## Evidence

- Latest evaluation file: `s_1777483248275_448.json` (modified Apr 29 17:25)
- Total evaluation files in `.state/evaluations/`: 20 files
- Experiments awaiting measurement: EXP-276, EXP-281, EXP-295, EXP-297, EXP-298
- All measurement windows have passed with zero post-deployment data

## Impact

1. **5 experiments stuck in DEPLOYED_UNVERIFIABLE state** — interventions are in code but we can't confirm they work
2. **Evidence-based loop broken** — we deploy interventions but never learn if they helped
3. **Hypothesis tracker stale** — P(H) values can't be updated without new measurement data
4. **Ghost completion rate unknown** — EXP-297's session-state-disambiguation can't be validated

## Root Cause Hypotheses

1. **Evaluator agent not running** — no heartbeat/schedule triggering evaluations
2. **Evaluation output location changed** — evals may be written elsewhere (DB? different path?)
3. **No new sessions to evaluate** — system may be inactive (unlikely given active sessions)

## Recommendation

1. **Batch-close EXP-276, 281, 295, 297 as DEPLOYED_UNVERIFIABLE** — the interventions are code-verified and structurally sound. We lack measurement but the design rationale is solid.
2. **Investigate evaluator agent status** — is it configured? Running? Producing output elsewhere?
3. **Accept structural verification as evidence** — for experiments where the intervention is in code (verified by grep/read), treat code-presence as weak positive evidence (not equivalent to behavioral measurement, but better than nothing).

## Meta-Pattern

This is an instance of **observability decay** — systems lose their measurement capabilities over time unless actively maintained. The irony: we have extensive experimental methodology but the measurement infrastructure quietly stopped working. This validates H-053 (workflow adoption decays without structural reinforcement) applied to our own evaluation workflow.

## Related

- `agents/bob/workspace/active-experiments-audit-2027-09.md` — first noticed this gap
- `agents/bob/workspace/EXP-297-post-deployment-measurement.md` — specific example
- H-053 (decay without reinforcement) — meta-applicable here
