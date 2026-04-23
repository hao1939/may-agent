# EXP-203: Structured Handoff Format for Scout→Bob Information Retention

**Date**: 2026-04-23
**Status**: PHASE-1-COMPLETE
**Predecessor**: EXP-197 (measured 48.8% info loss baseline)
**Hypothesis**: H-168 (agent handoffs lose >15% info per boundary)

---

## Research Question

Does a structured handoff template (with explicit sections for predictions, cross-references, confidence levels, and key claims) reduce Scout→Bob information loss from the 48.8% baseline (EXP-197) to <25%?

## Background

EXP-197 measured information retention across 10 DD→KE pairs:
- Mean retention: 51.2% (48.8% loss)
- Core claims: 73% retained (best)
- Predictions: 29% retained (worst)  
- Cross-references: 18% retained (worst)

The loss pattern is **non-uniform**: factual claims survive, but relational and predictive content is systematically dropped. A structured template that explicitly requires these high-loss categories should improve retention.

## Hypothesis

- **H-203a**: A structured handoff template with mandatory sections for {predictions, cross-references, confidence, mechanism, implications} will achieve ≥75% mean retention (≤25% loss), a ≥24pp improvement over baseline.
- **H-203b**: Prediction retention specifically will improve from 29% to ≥60% (the largest absolute gain).
- **H-203-null**: Structured format adds overhead but doesn't improve retention — agents compress regardless of template, and the loss is in receiver interpretation, not sender formatting.

## Design

### Method: Retrospective + Prospective Hybrid

**Phase 1 — Template Design (no gym needed)**:
Design a structured handoff template based on the EXP-197 loss analysis. Template sections:

```
## Handoff: [Source] → [Target]
### Key Claims (ranked by confidence)
1. [Claim] — Confidence: [H/M/L] — Evidence: [citation]

### Predictions (MUST include ≥2)
- If [condition], then [outcome] — Testable by: [method]

### Cross-References (MUST include all connections)
- Connects to: [H-xxx, KE-xxx, DD-xxx] — Relationship: [supports/challenges/extends]

### Mechanism
- [1-2 sentence causal model]

### What I'm Least Certain About
- [Explicitly flag weak points]
```

**Phase 2 — Retrospective Test (N=10)**:
Take the same 10 DD sources from EXP-197. Have Scout re-process them using the structured template. Score retention using same rubric as EXP-197.

**Phase 3 — Prospective Test (N=10)**:
Apply template to 10 NEW Scout deep-dives. Score retention. Compare to EXP-197 baseline distribution.

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A (baseline) | Free-text handoff (EXP-197 data) | 10 | Already collected |
| B (retro) | Structured template, same 10 DDs | 10 | Same content, different format |
| C (prospective) | Structured template, new DDs | 10 | New content, new format |

### Metrics

- Primary: Mean information retention % (same 5-dimension rubric as EXP-197)
- Secondary: Per-dimension retention (claims, predictions, cross-refs, mechanism, caveats)
- Tertiary: Token overhead (structured vs free-text length)

### Decision Rule

- **Confirmed** if: Arm B or C mean retention ≥75% AND prediction retention ≥50%
- **Partially confirmed** if: Retention improves ≥15pp but stays below 75%
- **Falsified** if: Retention change <10pp (template doesn't help)

## Cost Estimate

- Phase 1: ~0 (design work)
- Phase 2: ~$2 (10 Scout re-processing runs)
- Phase 3: ~$2 (10 Scout new runs + scoring)
- Total: ~$4

## Blockers

- Needs gym infra for controlled Scout runs, OR can be done as production A/B on live Scout deep-dives
- Could start Phase 1 (template design) immediately with no blockers

## Execution

Phase 1 is actionable now — design the template and add it to Scout's context/skills. Phases 2-3 require either gym runs or production integration.
