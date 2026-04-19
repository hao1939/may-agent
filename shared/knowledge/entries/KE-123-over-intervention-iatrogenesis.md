# KE-123: Over-Intervention Iatrogenesis — Combined Interventions Degrade Performance

**Status**: SUPPORTED — EXP-116 results validated by EXP-118 confirmation that coder runs are real
**Source**: EXP-116 (adversarial framing guard for multi-session handoffs)
**Date**: 2026-04-10
**Extends**: KE-007 (structural enforcement > text rules), KE-122 (intervention decay)

> **Note (2026-04-10)**: Earlier marked "UNSUPPORTED" based on incorrect claim that `--agent coder` was an invalid agent name. Investigation confirmed coder IS a registered agent (agents/coder/agent.json exists). EXP-118 confirmed baselines are real with other agents (bob, optimizer). The iatrogenesis finding (combined interventions = -12pp/-15pp degradation) from EXP-116 stands as valid experimental evidence.

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

## External Grounding: CR-335 Error Propagation Lifecycle

CR-335's Phase 4 (Amplification) provides an external mechanism for the iatrogenic effect observed here. When combined interventions are committed to the agent's context (Phase 2: Commitment), they are inherited as authoritative instructions (Phase 3: Inheritance) and *amplified* beyond their individual intent (Phase 4: Amplification). The superadditive harm (0 + 0 → -12pp) maps to CR-335's finding that inherited context is treated as more authoritative than in-session reasoning — two instructions that individually leave slack become jointly over-constraining because the agent treats their combination as a stronger mandate than either alone.

**Citation**: CR-335 (Error Propagation Lifecycle, ★★★★★, 2026-04-10)

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

## Connection to KE-125 (Discovery Task Harm)

KE-123 and KE-125 are complementary demonstrations that interventions can be actively harmful:
- **KE-123**: Combining multiple effective interventions causes harm (quantity overload — 0+0 → -12pp)
- **KE-125**: Applying a single effective intervention to the wrong task type causes harm (type mismatch — 67%→0%)
- **EXP-122 (added 2026-04-10)**: Environmental hints (non-instructional intervention) also fail on discovery tasks — NULL RESULT. Fourth intervention type tested (after EXP-117 forced checklist ❌, EXP-120 progressive tracking ❌, EXP-121 time budget ≈, EXP-122 environmental hints ∅). The problem is creative inference capability, not information availability or intervention type.

Both extend the same principle: **intervention effectiveness is not monotone**. More intervention ≠ better outcomes. The right intervention for the right task at the right dose matters — a medical analogy (iatrogenesis = doctor-caused harm). Together they define two axes of the "harmful intervention space": stacking depth (KE-123) and task-type mismatch (KE-125). EXP-122's null result adds a third axis: **intervention modality** — even switching from instructional to environmental cues doesn't help when the underlying problem is a reasoning gap.

## External Literature Validation (added 2026-04-10)

DD#739 reviews five papers that independently confirm KE-123's mechanism at large scale:

- **arXiv:2510.14842** (IBM Research): ScaledIF benchmark shows IF rate drops from 88%→66% (Llama-70B) as instructions increase from 2→10. Introduces "soft conflict" scoring — pairwise tension between instructions that grows as O(N²). Negatively correlated with performance. **Direct quantitative confirmation of our superadditive harm finding.**
- **arXiv:2505.07591** (Fudan/Lenovo/Tencent): Performance drops from 77.67%→32.96% across 19 LLMs as constraint complexity increases. Improvement comes from attention module changes — suggesting degradation is rooted in how transformers allocate attention across competing objectives.
- **arXiv:2509.23188**: Instruction conflicts in multi-agent systems resolved by attention heads in middle layers. SAIL (surgical LoRA) can partially restore performance — confirming the problem is localized, not diffuse.
- **arXiv:2603.24124**: DPO alignment causes 40-79% response homogenization. Already-narrowed response space makes additional behavioral constraints more likely to push past the over-constraint tipping point.
- **arXiv:2604.08297**: Safety-critical parameters concentrated in middle-layer V matrices/MLPs — overlapping with task performance parameters. Explains parametric competition when multiple interventions stack.

**Key insight from synthesis:** The degradation function approximates `P(N) ≈ P₀ × (1 - α·N - β·C(N))` where C(N) grows as O(N²) pairwise soft conflicts. KE-123's -12pp from 2 interventions implies very high pairwise conflict between "adversarial framing" and "evidence verification" — higher than formatting instructions because behavioral interventions change the agent's cognitive posture, creating semantic (not just parametric) interference.

**This makes KE-123 one of the best externally-validated findings in our knowledge base.**

See: `agents/shared/knowledge/library/deep-dives/DD-739-instruction-stacking-degradation-empirical-evidence.md`

## Limitations

- Observed on scenarios where baseline was already 100% — the iatrogenic effect may differ when baseline performance is lower
- The specific mechanism (over-refactoring) may be scenario-dependent
- N=3 per condition — statistically significant but small
- Cannot separate whether harm comes from the specific combination (adversarial + evidence) or from any two stacked behavioral interventions
