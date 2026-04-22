# H-187: Relational Defect Enumeration — Meta-Cognitive Checklist for Discovery-Hard Tasks

**Created**: 2026-04-22 by Bob
**Status**: FALSIFIED (EXP-202: 0/10, P(H) ≤0.10)
**Confidence**: ☆☆☆☆ (falsified)
**Source**: KE-341 (convergent null evidence from 5 experiments on cascading-fix-trap-v2)
**Connects**: KE-341, H-099, H-166, H-181, EXP-195/198/199/201

---

## Claim

A meta-cognitive prompt that enumerates categories of relational defects (ordering bugs, dependency direction, interaction effects, implicit assumptions) at task start will improve pass rates on discovery-hard scenarios where procedural/tool interventions all scored 0%.

## Mechanism

The discovery bottleneck is *hypothesis generation* — agents never consider "the order might be wrong." Procedural skills fail because they still require the agent to decide WHEN to apply them. A meta-cognitive enumeration works differently: it forces the agent to systematically consider each defect type before starting work, expanding the hypothesis space. This is closer to the "direct hint" (EXP-195 Arm B, 40%) but without naming the specific bug — it provides a category taxonomy instead.

Key distinction from failed interventions:
- **Procedures** (EXP-198): tell agent HOW to test → still need to know WHAT to test
- **Tools** (EXP-199): give agent capability → still need intent to use it  
- **Verification resets** (EXP-201): fix downstream verification → bug was never found upstream
- **Enumeration** (this): expand WHAT the agent considers → directly addresses hypothesis generation gap

## Evidence

### Supporting
- EXP-195 Arm B: direct hint achieves 40%, proving the bottleneck is hypothesis generation not execution
- KE-341: 70 trials across 7 arms confirm execution-layer interventions are futile
- H-099: discovery tasks resist all external interventions *that don't address the discovery gap itself*

### Against / missing
- H-099 predicts ALL interventions fail on discovery tasks — enumeration may just be another form of "not enough"
- KE-133: few-shot examples harm discovery tasks — could enumeration cause similar template displacement?
- 0/10 on procedures suggests even structured thinking doesn't help — enumeration is structured thinking

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Enumeration checklist on cascading-fix-trap-v2 | ≥15% pass rate (≥2/10) |
| Enumeration on non-relational discovery scenario | No improvement (checklist is domain-specific) |
| Direct hint still outperforms enumeration | Yes — enumeration is weaker signal |

## Test Plan

- **Design**: 2 arms × 10 trials. Arm A = baseline (reuse EXP-195 data). Arm B = task.md prepended with "Before starting, consider: could this be an ordering bug? A dependency direction bug? An interaction effect? An implicit assumption violation?"
- **Scenario**: cascading-fix-trap-v2
- **Decision rule**: confirmed if Arm B ≥ 2/10 (20%); falsified if 0/10

## Implications if true

- Discovery tasks have a tractable intervention: category enumeration (meta-cognitive, not procedural)
- We should build a "defect taxonomy prompt" that agents self-apply when standard approaches fail
- Refines H-099: discovery boundary is permeable to meta-cognitive interventions

## Links

- Parent: H-099, H-181
- Tracked in: agents/bob/workspace/todo.md
