# H-164: Harness-Parameter Trade-off — Runtime Scaffolding vs. Training Internalization

**Status**: Proposed  
**P(H)**: 0.65  
**Tier**: 2 (Theoretically Grounded, Limited Direct Evidence)  
**Date**: 2026-04-15  
**Author**: Bob  
**Derived from**: DD-560 (meta-agent), DD-570 (SKILL0), KE-081 (Automated Harness Optimization), KE-183 (Internalization Distance), H-161 (Dual IT Functions)

## Thesis

Any desired agent behavior can be achieved through two complementary mechanisms:

1. **Harness engineering** (runtime): Add context, prompts, tools, gates, workflows — behavior achieved through external scaffolding
2. **Parameter internalization** (training): Fine-tune, RL-train, or distill the behavior into model weights — behavior achieved through parametric knowledge

These form a **trade-off frontier**: for any given behavior, there exists a continuous spectrum from "fully scaffolded" (100% harness, 0% parametric) to "fully internalized" (0% harness, 100% parametric). The optimal point on this frontier depends on:

| Factor | Favors Harness | Favors Training |
|--------|---------------|-----------------|
| Task novelty | Novel/changing tasks | Routine/stable tasks |
| Deployment cost | Low volume | High volume |
| Flexibility | Need to iterate | Locked requirements |
| Access | API-only users | Model developers |

## Evidence

### For (P(H) ≥ 0.65)

1. **DD-560 + DD-570 represent the two strategies independently emerging** in the same week. meta-agent (DD-560) optimizes harnesses; SKILL0 (DD-570) optimizes parameters. Both achieve the same goal (better agent behavior) through different mechanisms.

2. **KE-176 empirically demonstrates the trade-off boundary**: additive steps (already partially internalized) need minimal harness support; interruptive steps (not internalized) need maximal harness support (Ch2 gates). This is precisely the harness-parameter substitution in action.

3. **KE-129's forced externalization result** shows that for behaviors with zero internalization (judgment tasks), even maximal text-based harness engineering fails — only structural gates work. This marks the "fully scaffolded" extreme of the frontier.

4. **SKILL0's RL internalization** shows that after training, behaviors that previously required scaffolding work automatically. This marks the "fully internalized" extreme.

### Against (P(H) ≤ 0.35)

1. **The two mechanisms may not be substitutable**: Some behaviors may be inherently impossible to internalize (e.g., knowledge about novel APIs), and some may be impossible to scaffold effectively (e.g., response timing).

2. **No one has empirically measured the trade-off**: We have examples of each extreme but no study systematically varying the harness/parameter balance for the same behavior.

3. **The "frontier" metaphor assumes continuity**: In practice, the transition from scaffolded to internalized may be a phase transition, not a smooth gradient.

## Predictions

- **P-164a**: For any behavior currently requiring a Ch2 gate (e.g., "write FINDINGS.md before fixing"), there exists a fine-tuning intervention that would make the behavior occur without the gate at ≥80% rate. (Requires training access to test.)

- **P-164b**: As model generations advance (more RLHF, more training), some behaviors currently requiring gates will become default behaviors, reducing the need for those gates. Operationalization: compare baseline compliance rates on our scenarios across model versions (e.g., Claude 3.5 vs 4.0 vs 4.5).

- **P-164c**: The optimal harness complexity for a given task is inversely proportional to the model's internalization of that task's key behaviors. Models that are better at a task type need simpler harnesses.

## Strategic Implications

For our team (API-only, no training access):
- We are **permanently constrained to the harness side** of the frontier
- DD-560 (meta-harness optimization) is our primary optimization strategy
- DD-570 (SKILL0) is relevant only as a **lens for understanding** why our gates work and when they're needed
- As model providers internalize more behaviors (better base models), some of our gates should become unnecessary — we should periodically test whether they're still needed

## Cross-References

| Entry | Connection |
|-------|-----------|
| KE-081 | Automated harness optimization — the runtime optimization side of the trade-off |
| KE-183 | Internalization distance — formalizes which side of the trade-off each behavior falls on |
| H-161 | Dual IT functions — F2 (behavioral forcing) is the harness side; SKILL0 eliminates the need for F2 |
| DD-560 | meta-agent — exemplar of harness-side optimization |
| DD-570 | SKILL0 — exemplar of parameter-side optimization |
| CR-301 | Cambrian explosion — the ecosystem map shows both optimization strategies emerging independently |

---
*H-164 • Filed by Bob • 2026-04-15 ~08:45*
*Status: Proposed • P(H) 0.65 • Tier 2*
