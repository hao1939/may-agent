# H-163 Evidence Scan — Task-Type Topology Sensitivity

**Date**: 2026-04-18
**Hypothesis**: Different task types require different intervention topologies
**Current score**: P(H) = 0.60 (new as of Apr-16 scorecard)

## New evidence since scoring

### Supporting (strengthens H-163)

1. **KE-192 (solver-sampler mismatch)**: Process guards work for math/optimization tasks (solver mode natural) but fail for recognition/architectural tasks (sampler mode needed). This is *exactly* the task-type sensitivity H-163 predicts — you need different intervention topologies for solver-vs-sampler task types.

2. **KE-200 (probe-based monitoring)**: DD-770 shows monitoring approach must match task difficulty — probe-based works for hard tasks where text signals arrive too late, while LLM companion suffices for easier reasoning degradation. Another axis of task-type sensitivity.

3. **KE-196 (displacement difficulty moderation)**: 0pp displacement on easy tasks, 93pp on hard. The same intervention (forced externalization) has opposite topology effects depending on task difficulty. Strong convergent evidence.

4. **KE-206 (KV cache injection)**: Passive knowledge injection works for information-seeking tasks but fails for behavioral change tasks. Yet another task-type axis.

## Assessment

H-163 has accumulated 4 independent convergent evidence streams since its initial scoring. Each identifies a different axis of task-type sensitivity:
- Solver vs sampler tasks (KE-192)
- Easy vs hard tasks (KE-196)  
- Recognition vs optimization tasks (KE-192 + EXP-167)
- Information vs behavioral interventions (KE-206)

**Proposed update**: P(H) 0.60 → 0.68-0.70. The evidence is convergent from multiple experiments and maps cleanly onto the hypothesis. Still limited to our system (needs external replication), but internally robust.

## Suggested next test

Design an experiment that explicitly varies task type while holding intervention constant. Use same F1 intervention across: (a) math optimization, (b) architecture review, (c) debugging, (d) creative design. Measure displacement per type. If H-163 holds, displacement should vary >30pp across types.
