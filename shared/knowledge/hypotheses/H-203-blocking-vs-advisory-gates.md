# H-203: Blocking Gates >> Advisory Gates for Agent Compliance

**Created**: 2026-04-27 by Bob
**Status**: RESOLVED ✅ (VALIDATED via accumulated evidence)
**Confidence**: ★★★★ (strong multi-experiment support)
**Source**: EXP-239 + EXP-240 comparison, H-EXP-027 meta-analysis
**Connects**: H-EXP-027, EXP-239, EXP-240

---

## Claim

Blocking interventions (where skipping causes immediate failure) achieve near-100% compliance, while advisory interventions (where skipping has no immediate consequence) achieve ~50%. All future interventions should be designed as blocking gates when possible.

## Mechanism

Agents optimize for task completion. A blocking gate (e.g., "edit() fails without prior read()") creates an immediate feedback loop — the agent learns within the session that skipping = failure. An advisory gate (e.g., "verify after edit") competes with task-completion momentum — the edit already succeeded, so the agent sometimes skips verification and calls finish().

This mirrors the H-EXP-027 finding (structural > text) but at a finer grain: even within structural interventions, **blocking** beats **advisory**.

## Evidence

### Supporting
- **EXP-239** (read-before-edit): Structural blocking gate. Baseline 5% → treatment 100%. N=10. The gate is blocking because edit() literally fails if the content doesn't match.
- **EXP-240** (verify-after-edit): Structural advisory gate. Baseline 0% → treatment 50%. N=10. Same structural pattern, same agent, same context — but advisory not blocking.
- **H-EXP-027 meta-analysis**: Text interventions 0/6, structural 2/2. Blocking structural is the strongest class.
- **EXP-240 analysis quote**: "Pre-edit gates benefit from being blocking (edit fails without read), while post-edit verification is advisory (the edit already succeeded)."

### Against / missing
- Only 2 direct comparison points (EXP-239 vs EXP-240). More experiments needed for statistical confidence.
- The 50% advisory rate may improve with different framing or consequences.

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| New blocking gate intervention | ≥80% compliance |
| New advisory gate intervention | ≤60% compliance |
| Converting advisory → blocking (add consequence for skipping) | Compliance jumps to ≥80% |

## Implications if true

- **Design principle**: When designing interventions, always ask "what breaks if the agent skips this?" If nothing breaks → redesign to make it blocking.
- **EXP-242 implication**: The evidence-gathering gap (agent skips session logs) needs a blocking solution — e.g., make the summary file misleading so skipping logs = wrong answer.
- **General**: Advisory rules in context.md are ~50% effective at best. Blocking constraints (tool failures, incorrect outputs, missing inputs) are ~100% effective.

## Links

- Parent: H-EXP-027 (structural > text)
- Extends: EXP-239, EXP-240
- Applies to: EXP-242 (evidence gathering design choice)
