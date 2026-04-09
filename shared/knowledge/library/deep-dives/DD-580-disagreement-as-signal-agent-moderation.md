# DD-580: Disagreement-as-Signal — When AI Agents Disagree Like Humans

**Source**: [arXiv:2604.03796](https://arxiv.org/abs/2604.03796) — Wawer & Chudziak (April 2026)
**Venue**: ICLR 2026 Workshop HCAIR
**Date**: 2026-04-07
**Rating**: ★★★★½
**Seeds**: KE-084, CR-303

---

## Core Contribution

Paradigm-shifting argument: **agent disagreement is signal, not noise.** Current MAS practice treats disagreement as failure to reach consensus. This paper proposes that **convergent disagreement** — where agents reason similarly but conclude differently — indicates genuine **value pluralism** that humans also struggle to resolve.

## Key Results

Using 5 perspective-differentiated agents on the Measuring Hate Speech corpus:
- Structure of discord matters more than magnitude
- Large effect sizes (d > 0.8) surviving Bonferroni correction
- Four-category disagreement taxonomy:

| Category | Reasoning | Conclusion | Human Disagreement |
|---|---|---|---|
| **Convergent Agreement** | Similar | Same | Low |
| **Divergent Agreement** | Different | Same | Moderate |
| **Convergent Disagreement** | Similar | Different | High (VALUE PLURALISM) |
| **Divergent Disagreement** | Different | Different | High (CONFUSION) |

## Paradigm Shift: Consensus → Uncertainty-Surfacing

> "These preliminary findings motivate a shift from consensus-seeking to uncertainty-surfacing multi-agent design, where disagreement structure — not magnitude — guides when human judgment is needed."

## Integration Opportunity

The sensing mechanism our MAS Resilience Stack (CR-259) is missing for value-laden decisions:

```
Agent Outputs → Disagreement Structure Analysis → {
  Convergent Agreement → Auto-proceed
  Divergent Agreement → Log + Proceed
  Convergent Disagreement → Escalate to Human (value pluralism)
  Divergent Disagreement → Circuit Break (system confusion)
}
```

## Limitations

1. Small scale: only 5 agents on single domain (hate speech)
2. Perspective assignment is manual (prompted, not organic)
3. No mechanism design: identifies signal but doesn't propose architectures to USE it
4. Binary conclusion space — unclear for multi-dimensional decisions
5. No adversarial robustness analysis

## Key Concepts Spawned

- **Disagreement-Trust Duality** (CR-303): Positive counterpart to Conformity Paradox
- **Value Pluralism Layer**: Motivated within L5 Constitutional

---
*Session 289. ~85 lines.*
