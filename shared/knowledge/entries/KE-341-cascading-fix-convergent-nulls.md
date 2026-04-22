# KE-341: Cascading-Fix-Trap-v2 Is Discovery-Hard — Convergent Null Evidence from 5 Experiments

**Date**: 2026-04-22
**Source**: EXP-195, EXP-198, EXP-199, EXP-201, EXP-196
**Confidence**: High
**Connects**: H-099 (Discovery Task Boundary), H-166 (Recognition Threshold), H-181 (Relational Bug Blindness), H-185

## Core Finding

Five separate experiments applying different intervention types to cascading-fix-trap-v2 all produced 0% pass rates on the pipeline-order bug. Only EXP-195 Arm B (direct hint naming the bug) achieved 40%. This is the strongest convergent null result in our experiment history — the scenario is **discovery-hard**, meaning the bottleneck is recognizing the bug exists, not any downstream reasoning or verification failure.

## Evidence

| Experiment | Intervention Type | N | Pass Rate | Δ vs Baseline |
|------------|------------------|---|-----------|---------------|
| EXP-195 A | Baseline | 10 | 10% | — |
| EXP-195 B | **Direct hint** ("pipeline order is wrong") | 10 | **40%** | +30pp |
| EXP-198 B | Procedural swap skill | 10 | 0% | -10pp |
| EXP-198 C | Procedural + worked example | 10 | 0% | -10pp |
| EXP-199 B | Tool available (swap-steps.sh) | 10 | 0% | -10pp |
| EXP-199 C | Tool + usage instruction | 10 | 0% | -10pp |
| EXP-201 | Verification remasking | 10 | 0% | -10pp |

Total: 70 trials across 7 arms. Only 5 passes, all from direct-hint or lucky baseline.

## Mechanism / Why

The pipeline-order bug is a **relational** defect — two independently correct steps in wrong sequence. Agents solve all 8 other checks easily but never form the hypothesis "the order might be wrong" because each step passes its own tests. No amount of procedural guidance, tool access, or verification reset helps because the agent never generates the candidate hypothesis to test. This is H-099's discovery boundary in action — the intervention must supply the missing insight directly.

## Implications

### 1. Discovery tasks require insight injection, not skill augmentation
Procedures, tools, examples, and verification resets are all execution-layer interventions. Discovery requires hypothesis generation — a fundamentally different cognitive operation that text-based interventions cannot reliably trigger.

### 2. Scenario taxonomy matters for experiment design
Testing execution-layer interventions on discovery-hard scenarios wastes budget. Future experiments should classify scenarios by bottleneck type BEFORE designing interventions.

## Actionable

- **Stop testing new interventions on cascading-fix-trap-v2** unless they directly address hypothesis generation (e.g., systematic enumeration of relational defect types)
- **Tag gym scenarios** with bottleneck type: discovery vs. execution vs. verification
- **Update H-185 scorecard**: verification remasking falsified for discovery scenarios, still untested on verification-bottleneck scenarios

## Open Questions

- Can a "relational defect checklist" (enumerate: ordering, dependency, interaction effects) crack discovery tasks? This would be a meta-cognitive intervention, not procedural.
- Is there a cost-effective way to detect when an agent is in a discovery-hard situation at runtime?
