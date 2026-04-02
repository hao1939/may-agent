# HB#1482 — LoRA Knowledge Packing: Limits of Parametric Knowledge Integration

**Source**: arXiv:2502.14502v3 [cs.CL] (AIRI/Skoltech/MIPT) — Direct Paper Tracking  
**Title**: How Much Knowledge Can You Pack into a LoRA Adapter without Harming LLM?  
**Date**: March 24, 2025 (v3)  
**TL;DR**: LoRA fine-tuning for knowledge integration inevitably degrades general capabilities — 3,000 new facts cause measurable decline on TruthfulQA/MMLU; training data composition is critical

---

## Core Research Question

> To what extent can additional knowledge be integrated into LLMs via LoRA while preserving general capabilities?

**Key Finding**: There is a **fundamental trade-off** between new knowledge integration and preservation of existing capabilities. No free lunch.

---

## Experimental Design

| Variable | Values Tested |
|----------|---------------|
| **Base Model** | Llama-3.1-8B-Instruct |
| **New Facts** | 1, 10, 50, 100, 500, 3000 |
| **Evaluation** | Intrinsic (fact recall) + Extrinsic (MMLU, TruthfulQA) |
| **Mitigation** | Paraphrased facts, Mixed known+new facts |

---

## Key Findings

### 1. Performance Degradation Curve

```
New Facts → TruthfulQA Score Decline
1         → Minimal impact
10        → Slight decline  
50        → Noticeable decline
100       → Significant decline
500       → Strong decline
3000      → Severe degradation
```

**Figure 1**: Clear inverse correlation between new knowledge volume and general benchmark performance.

### 2. Mitigation Strategy Results

| Approach | Effectiveness | Caveat |
|----------|---------------|--------|
| **Paraphrased facts** | Partial mitigation | Still harmful |
| **Mixed known+new** | Best results | External benchmarks still decline |
| **Pure new facts** | Worst | Severe overfitting to overrepresented entities |

### 3. Overconfidence Phenomenon

> "The model becomes more confident and refuses to provide an answer in only few cases"

**Critical Safety Issue**: Fine-tuned models become **more confident in wrong answers**, not less. False confidence increases without corresponding accuracy gains.

### 4. Entity Bias Regression

When training data is biased toward certain entities:
- Model **regresses to few overrepresented answers**
- Loses nuanced discrimination capability
- Collapses to high-frequency response patterns

---

## Implications for OpenClaw

### Direct Validation: Non-Parametric > Parametric for Knowledge

| Approach | LoRA Fine-tuning | OpenClaw Skill System |
|----------|------------------|----------------------|
| **Knowledge Update** | Destructive to base model | Isolated, non-destructive |
| **Confidence Calibration** | Degrades (overconfidence) | Preserved (base model frozen) |
| **Scope Control** | Diffuse, hard to bound | Explicit SKILL.md boundaries |
| **Rollback** | Difficult | Trivial (disable skill) |
| **Verification** | Post-hoc benchmarking | Pre-execution static analysis |

### Validation of P126 Dual-Track Learning

This paper empirically validates our design:
- **Parametric updates** (LoRA) → **harm general capabilities**
- **Non-parametric knowledge** (Skills) → **preserves base model integrity**

The Skill/AGENTS.md architecture is not just a convenience — it's a **necessity** for maintaining reliable agent behavior.

### Skill Design Implications

| Insight | Skill Design Action |
|---------|---------------------|
| Mixed data performs best | SKILL.md should reference both known patterns AND novel extensions |
| Entity bias is dangerous | Skill scope must explicitly declare entity coverage |
| External benchmark decline | Skills should include regression tests for base capabilities |
| Overconfidence increase | Confidence thresholds should be stricter for Skill outputs |

---

## Limitations Acknowledged by Authors

1. Single model family (Llama-3.1)
2. Synthetic fact generation (may not reflect real-world knowledge patterns)
3. Limited mitigation techniques explored
4. No analysis of multi-task interference

---

## L3 Flags

- #1482-A: Evaluate current Skill set for entity bias patterns
- #1482-B: Design Skill regression test suite to detect base capability degradation
- #1482-C: Research confidence calibration techniques for Skill outputs
- #1482-D: Explore "mixed knowledge" prompting pattern in SKILL.md templates

---

## Cross-Reference Network

| Prior Finding | This Paper | Consistency |
|---------------|------------|-------------|
| P126 Dual-Track Learning | LoRA harms general capabilities | ✅ Strong validation |
| HB#1479 RFT Generalization | Cross-environment migration fails | ✅ Related mechanism |
| HB#1478 XSkill | Non-parametric experience storage | ✅ Alternative validated |
| SYNTH-006 Skill Architecture | Layered knowledge management | ✅ Design rationale strengthened |

---

## Quotations

> "These findings highlight the potential pitfalls of LoRA-based LLM updates and underscore the importance of training data composition and tuning parameters to balance new knowledge integration and general model capabilities."

> "The model tends to regress to few overrepresented answers."

> "The model becomes more confident and refuses to provide an answer in only few cases."

---

**Archived**: 2026-03-15  
**Signal Strength**: 🔥 High — Directly validates OpenClaw non-parametric knowledge architecture  
**Next Steps**: Cross-reference with Scout for implementation details
