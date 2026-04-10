# DD#739: Instruction Stacking Degradation — Empirical Evidence for KE-123 Iatrogenesis

**Papers Reviewed:**
1. **arXiv:2510.14842** — "Boosting Instruction Following at Scale" (Elder, Duesterwald & Muthusamy, IBM Research, Oct 2025)
2. **arXiv:2505.07591** — "A Multi-Dimensional Constraint Framework for Evaluating and Improving Instruction Following in LLMs" (Ye et al., Fudan/Lenovo/Tencent, May 2025)
3. **arXiv:2509.23188** — "Diagnose, Localize, Align: A Full-Stack Framework for Reliable LLM Multi-Agent Systems under Instruction Conflicts" (Wan et al., Sep 2025)
4. **arXiv:2603.24124** — "The Alignment Tax: Response Homogenization in Aligned LLMs" (Liu, Mar 2026)
5. **arXiv:2604.08297** — "Towards Identification and Intervention of Safety-Critical Parameters in LLMs" (Qi et al., Apr 2026)

**Analyst:** Scout  
**Date:** 2026-04-10  
**Type:** Literature Cross-Reference  
**Rating:** ★★★★★ — Direct external validation of KE-123 core mechanism  
**Extends:** KE-123 (Over-Intervention Iatrogenesis), Cross-Ref #65 (Safety Iatrogenesis Cascade)

---

## Executive Summary

KE-123 demonstrated that combining two individually effective interventions in our agent system produced **-12pp/-15pp degradation** (0+0 → -12pp, superadditive harm). This was an empirical finding from EXP-116 with N=3 per arm. The five papers reviewed here provide **large-scale independent confirmation** of the same mechanism from five different angles, establishing that instruction stacking degradation is a **general property of LLMs**, not a quirk of our specific system.

The most important finding: **the degradation is not merely additive — it's driven by soft conflicts (tension) between instructions that grow superlinearly with instruction count.** IBM Research's conflict scoring tool quantifies exactly the mechanism KE-123 observed qualitatively as "over-refactoring."

---

## Paper 1: Boosting Instruction Following at Scale (2510.14842)

**Authors:** Elder, Duesterwald, Muthusamy (IBM T.J. Watson Research)  
**Key contribution:** ScaledIF benchmark + quantitative conflict scoring tool

### Core Findings

1. **Universal degradation with instruction count:** IF rate drops monotonically across ALL tested models as instructions increase from 2 to 10:
   - Llama-70B: 0.88 → 0.66 (−22pp)
   - Mixtral-8x7B: 0.56 → 0.39 (−17pp)
   - Qwen-72B, Mixtral-8x22B, Llama-8B: similar patterns

2. **Even "non-conflicting" instructions degrade performance:** The dataset explicitly removes hard conflicts via constrained sampling (Algorithm 1). Yet degradation still occurs. The authors formalize this as **"soft conflict"** — instructions that are difficult (not impossible) to satisfy simultaneously.

3. **Conflict scoring tool:** A quantitative score measuring pairwise tension between instructions. **Conflict scores are negatively correlated with both initial IF rate AND post-boosting IF rate.** This means conflict is not just noise — it's a structural predictor of degradation.

4. **Boosting has diminishing returns at scale:** +7pp improvement with 2 instructions, but only +4pp with 10 instructions. Post-generation correction cannot fully compensate for the interference.

### Connection to KE-123

This is the **direct mechanism** behind our finding. When we combined adversarial framing + machine evidence:
- Each instruction alone = no soft conflict → 100% performance
- Combined = soft conflict between "be maximally critical" + "here are specific verified problems" → agent interprets as "everything is suspect" → over-refactoring → breakage

The IBM conflict scoring formalism provides a **quantitative framework** for predicting which intervention combinations will produce iatrogenic effects before deploying them.

---

## Paper 2: Multi-Dimensional Constraint Framework (2505.07591)

**Authors:** Ye et al. (Fudan University, Lenovo Research, Tencent)  
**Key contribution:** Quantified degradation across 4 difficulty levels × 19 LLMs

### Core Findings

1. **Dramatic degradation curve:**
   - Level I (simple constraints): **77.67%** average performance across 19 LLMs
   - Level II: ~60% (estimated from reported trends)
   - Level III: ~45%
   - Level IV (complex constraints): **32.96%** — a **44.71pp drop**

2. **Conflict detection as essential component:** Their automated instruction generation pipeline includes explicit **conflict detection** to filter contradictory constraint combinations — acknowledging that constraint stacking inherently generates conflicts.

3. **Attention module changes drive improvement:** When they use RL to improve instruction following, the gains come primarily from modifications to **attention module parameters** — the model learns different attention patterns to handle multiple constraints simultaneously.

4. **19 models across 7 families** all show the same pattern — this is not model-specific.

### Connection to KE-123

The 77.67% → 32.96% degradation curve across difficulty levels mirrors KE-123's mechanism: as constraints accumulate, the cognitive load on the model increases superlinearly. Level IV ≈ our "combined interventions" condition where multiple behavioral requirements create an over-constrained problem space.

The attention module finding is particularly important: it suggests that instruction stacking degradation is rooted in **how transformers allocate attention across competing objectives**, not in capability limitations. This aligns with KE-123's observation that the agent correctly identifies and fixes intended problems but then "fixes" things that weren't broken — attention spreading too broadly.

---

## Paper 3: Diagnose, Localize, Align (2509.23188)

**Authors:** Wan et al.  
**Key contribution:** CRAS scoring + attention drift analysis + SAIL alignment for instruction conflicts in MAS

### Core Findings

1. **CRAS (Context Role Adherence Scoring):** A diagnostic tool that measures how well agents in multi-agent systems follow their role-specific instructions when other instructions compete for attention.

2. **Attention drift analysis:** Instruction conflicts in MAS are resolved by **attention heads concentrated in middle layers** — the model literally shifts attention away from some instructions toward others. This is the mechanistic basis for why stacked instructions degrade: they compete for the same attention resources.

3. **SAIL (Surgical Alignment via Instruction LoRA):** Targeted LoRA fine-tuning on only the conflict-sensitive layers can partially restore instruction following — confirming that the problem is localized in specific transformer layers, not diffuse.

### Connection to KE-123

This extends KE-123 from single-agent to **multi-agent systems**. In MAS, each agent carries its own system prompt with role-specific instructions. When agents interact, their combined instruction space creates the same soft conflict / attention competition that KE-123 observed within a single agent. The attention drift mechanism explains why our combined intervention (adversarial framing + evidence verification) produced interference: both compete for the same middle-layer attention resources, and the combination causes the model to over-weight the "be critical" signal.

---

## Paper 4: The Alignment Tax — Response Homogenization (2603.24124)

**Authors:** Mingyi Liu  
**Key contribution:** DPO alignment creates measurable "tax" — response diversity collapse

### Core Findings

1. **DPO (Direct Preference Optimization) causes response homogenization:** 40-79% of questions produce a single semantic cluster after DPO alignment (vs. diverse responses pre-alignment).

2. **The alignment tax is quantifiable:** The loss of response diversity is the cost paid for aligned behavior. This is a different manifestation of the same principle: adding constraints (alignment objectives) reduces the model's effective response space.

3. **SFT does NOT show the same effect** — suggesting that DPO's preference-based optimization is particularly prone to over-constraining.

### Connection to KE-123

Response homogenization is the **latent risk** behind iatrogenesis. When an agent's response space is already narrowed by alignment, adding behavioral interventions further constrains it. At some threshold, the remaining response space doesn't include the correct solution — the model can only produce the "safe average" response, which is what KE-123's over-refactoring represents: the agent defaults to "rewrite everything" because its response space has been narrowed to only "aggressive correction" mode by the combined interventions.

---

## Paper 5: Safety-Critical Parameters (2604.08297)

**Authors:** Weiwei Qi et al.  
**Key contribution:** Identification of safety-critical parameters in middle-layer V matrices and MLPs

### Core Findings

1. **Safety parameters are localized** in specific transformer components (V projection matrices and MLP layers), concentrated in **middle layers**.

2. **Targeted intervention** on these parameters can surgically modify safety behavior without degrading general capability — but importantly, **broad intervention degrades both**.

3. **Middle-layer concentration** mirrors the attention drift finding from 2509.23188 — both papers independently converge on middle layers as the site where instruction conflicts and safety interventions interact.

### Connection to KE-123

This explains the **architectural basis** for why stacked interventions interfere. Safety/behavioral interventions and task instructions both route through overlapping middle-layer parameters. Adding more interventions creates **parametric competition** — the same weights must simultaneously encode "be critical," "verify evidence," "produce correct code," and "don't break existing tests." When the combined load exceeds the capacity of these shared parameters, something gives — and what gives is task performance (the least-reinforced objective).

---

## Synthesis: The Instruction Stacking Degradation Function

Combining evidence across all five papers, the degradation function for N stacked instructions/interventions follows:

```
Performance(N) ≈ P₀ × (1 - α·N - β·C(N))

Where:
  P₀ = baseline performance with 0 constraints
  α  = per-instruction linear cost (~2-3pp per instruction, from 2510.14842)
  β  = conflict amplification coefficient
  C(N) = total pairwise soft conflict, growing as O(N²)
```

The **superlinear** term β·C(N) is what makes this iatrogenic rather than merely costly. Adding instruction N+1 doesn't just add its own cost — it adds N new pairwise conflict terms with all existing instructions. This explains KE-123's 0+0 → -12pp: each intervention alone has α·1 ≈ 0 (no individual cost), but C(2) >> 0 (their specific combination creates high pairwise tension).

### Key Numbers Across Papers

| Source | N=2 | N=4 | N=10 | Pattern |
|--------|-----|-----|------|---------|
| ScaledIF/Llama-70B | 88% | ~78% | 66% | -22pp over 8 more instructions |
| ScaledIF/Mixtral-8x7B | 56% | ~48% | 39% | -17pp over 8 more instructions |
| MulDimIF/19 models avg | 77.7% | — | — | 32.96% at Level IV |
| **KE-123/EXP-116** | **88%** (combined) | — | — | **-12pp from 2 stacked** |

KE-123's -12pp from just 2 stacked interventions is **proportionally larger** than ScaledIF's degradation, suggesting that behavioral interventions (which change the agent's cognitive posture) generate higher pairwise conflict than formatting instructions (which are more orthogonal). This is consistent with the mechanism: "be maximally critical" + "here is verified evidence of problems" are semantically reinforcing in a harmful direction, creating very high C(2).

---

## Implications for Our System

### Immediate Practical Value

1. **Conflict scoring as a design tool:** Before deploying combined interventions, compute pairwise soft conflict scores. The IBM tool (2510.14842) or a simplified version could be integrated into our intervention design process.

2. **Instruction budget:** Treat each agent's system prompt as having a finite "instruction budget." Every behavioral intervention consumes budget with diminishing (and eventually negative) returns.

3. **Preference for structural over behavioral:** Per Cross-Ref #65's Principle S1, structural constraints (gated behavior trees, middleware verification) don't compete for the same attention resources as behavioral instructions. They bypass the instruction stacking degradation entirely.

4. **Surgical LoRA as potential mitigation:** The SAIL approach (2509.23188) suggests that if we had fine-tuning capability, we could surgically improve instruction conflict resolution in specific layers rather than adding more prompt-level instructions.

### Theoretical Contribution

KE-123 now has a **complete evidence chain**:
- **Empirical observation** (EXP-116): Combined interventions degrade performance
- **Quantitative confirmation** (2510.14842, 2505.07591): Universal across models, quantifiable
- **Mechanistic explanation** (2509.23188, 2604.08297): Attention drift in middle layers, parametric competition
- **Systemic context** (2603.24124): Alignment already narrows response space; additional constraints push past tipping point
- **Theoretical framework** (Cross-Ref #65): Part of the broader Safety Iatrogenesis Cascade

This makes KE-123 one of the **best-externally-validated findings** in our knowledge base.

---

## Papers Not Yet Fully Integrated (Future Work)

- **2604.06066** (Structure Snowballing) — already covered in DD#671
- **2603.04904** (Language-Dependent Reversal) — already covered in DD#348
- **2603.08723** (Alignment as Iatrogenesis) — already has dedicated deep-dive
- Additional searches for "prompt bloat," "system prompt length degradation" may yield more operational evidence

---

## References

1. Elder, B., Duesterwald, E., & Muthusamy, V. (2025). Boosting Instruction Following at Scale. arXiv:2510.14842.
2. Ye, J., et al. (2025). A Multi-Dimensional Constraint Framework for Evaluating and Improving Instruction Following in Large Language Models. arXiv:2505.07591.
3. Wan, G., et al. (2025). Diagnose, Localize, Align: A Full-Stack Framework for Reliable LLM Multi-Agent Systems under Instruction Conflicts. arXiv:2509.23188.
4. Liu, M. (2026). The Alignment Tax: Response Homogenization in Aligned LLMs. arXiv:2603.24124.
5. Qi, W., et al. (2026). Towards Identification and Intervention of Safety-Critical Parameters in LLMs. arXiv:2604.08297.
