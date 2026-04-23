# EXP-206: Do Surface Metrics Mask Coordination Breakdown?

**Date**: 2026-04-23
**Status**: DESIGNED
**Predecessor**: EXP-099 (verification gravity wells)
**Hypothesis**: H-075

---

## Research Question

Do surface-level metrics (findings-used, hypotheses-resolved) mask actual coordination quality? Specifically: when scout produces findings that bob "uses" (cites), do they actually change bob's decisions?

## Hypothesis

- **H-206a**: ≥30% of findings marked "used" had no measurable impact on bob's decisions (the decision would have been the same without the finding)
- **H-206-null**: ≥80% of "used" findings demonstrably influenced the decision (citation = genuine use)

## Design

### Method: Retrospective Decision Audit

This is NOT a gym experiment — it's a retrospective audit of real production sessions.

**Step 1: Sample sessions** (N=20)
- Pull 20 recent bob sessions where `findings-used` was credited
- For each, identify: (a) the scout finding cited, (b) the decision bob made

**Step 2: Counterfactual analysis**
- For each session, ask: "Would bob have made this same decision without the scout finding?"
- Evidence signals for "no real influence":
  - Finding cited in passing but decision was already implied by context
  - Finding restates something already in bob's context.md
  - Citation appears in boilerplate/template section, not reasoning
- Evidence signals for "genuine influence":
  - Decision explicitly contradicts bob's prior approach, citing finding as reason
  - Finding introduced a novel concept not in bob's prior knowledge
  - Decision logic references specific data from the finding

**Step 3: Score each**
- 0 = no influence (cosmetic citation)
- 1 = weak influence (nudged but didn't change outcome)  
- 2 = strong influence (finding changed the decision)

### Metrics

- Primary: % of citations scoring 0 (cosmetic)
- Secondary: % scoring 2 (strong influence)
- Tertiary: Distribution of influence scores

### Decision Rule

- H-075 confirmed if: ≥30% of citations score 0 (cosmetic)
- H-075 falsified if: ≥80% score 1 or 2 (genuine use)
- Ambiguous if: 20-30% score 0 — need larger sample

## Implications

If confirmed → we need process-level coordination metrics (not just citation counting). Propose: decision-delta metric that tracks whether outputs change when inputs are withheld.

If falsified → current metrics are actually capturing real coordination. Focus elsewhere.

## Execution

```bash
# Manual audit — pull sessions from evaluator DB
# bun -e "..." to query sessions with findings-used credits
```
