# KE-123: Over-Intervention Iatrogenesis — Combined Interventions Degrade Performance

**Status**: Active
**Source**: EXP-116 (adversarial framing guard for multi-session handoffs)
**Date**: 2026-04-10
**Extends**: KE-007 (structural enforcement > text rules), KE-122 (intervention decay)

---

## Finding

Combining two individually effective interventions (adversarial framing + machine-verified evidence) produced **worse outcomes than no intervention at all**. Arms C and D in EXP-116 degraded performance by -12pp and -15pp respectively versus the 100% baseline, while each intervention alone (Arms A, B) had zero negative effect.

This is an **iatrogenic effect** — the treatment itself causes harm. Belt-and-suspenders is counterproductive for behavioral interventions.

## Evidence

| Arm | Treatment | Overall Score | Δ vs Baseline | p-value |
|-----|-----------|---------------|---------------|---------|
| Baseline | None | 100% | — | — |
| A | Adversarial framing only | 100% | 0pp | — |
| B | Machine evidence only | 100% | 0pp | — |
| **C** | **Combined (A+B)** | **88%** | **-12pp** | **0.018** |
| **D** | **Combined + guard** | **85%** | **-15pp** | **0.018** |

- N=3 per arm per scenario (kb-integration-failure, ghost-deliverable-chain)
- Degradation concentrated on kb-integration-failure: 100% → 81% for both C and D
- Fisher's exact test confirms significance (p=0.018)
- Duration overhead: +77% (Arm C), +66% (Arm D) vs baseline

## Mechanism: Double Adversarial Pressure → Over-Refactoring

The causal chain:

1. **Adversarial framing** tells the agent: "Assume the previous developer was sloppy — find at least 3 discrepancies"
2. **Machine evidence** confirms: "Here are specific verified problems in the code"
3. **Combined effect**: Agent enters maximum-critique mode, treating the entire codebase as suspect
4. **Over-refactoring**: Agent rewrites beyond targeted fixes — restructuring module exports, changing function signatures
5. **Breakage**: The broad rewrite breaks `tests-pass` (0/3 in Arm C) and `exports-correct` (1/3 in Arm C) while all behavioral and core quality checks still pass

The agent correctly identifies and fixes the intended problems, but the excessive adversarial pressure causes it to "fix" things that weren't broken, introducing regressions.

## Non-Linear Interaction

This is not a simple additive effect. Each intervention alone is harmless:
- Framing alone: 100% (no degradation, +20% duration)
- Evidence alone: 100% (no degradation, +4% duration)
- Combined: 88% (significant degradation, +77% duration)

The interaction is **superadditive in harm**: 0 + 0 → -12pp. This means you cannot predict combined intervention effects from individual effects.

## Implications

- **Never stack behavioral interventions without testing the combination**: Individual safety does not predict combined safety
- **Prefer single, targeted interventions**: If one intervention achieves the goal, adding a second is pure risk with no upside
- **Test for iatrogenic effects explicitly**: When designing multi-layer interventions, always include a combined arm in the experiment
- **"More safeguards = safer" is wrong for agents**: Unlike mechanical systems where redundancy helps, behavioral interventions can interfere destructively — each additional layer changes the agent's cognitive posture
- **Watch for over-compliance signals**: Duration overhead (+77%) is a leading indicator — the agent is spending much more time but achieving worse results

## Limitations

- Observed on scenarios where baseline was already 100% — the iatrogenic effect may differ when baseline performance is lower
- The specific mechanism (over-refactoring) may be scenario-dependent
- N=3 per condition — statistically significant but small
- Cannot separate whether harm comes from the specific combination (adversarial + evidence) or from any two stacked behavioral interventions
