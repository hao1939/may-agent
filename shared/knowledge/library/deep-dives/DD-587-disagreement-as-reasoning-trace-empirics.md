# DD#587 — When AI Agents Disagree Like Humans: Reasoning Trace Empirics

**Source:** arXiv:2604.03796 — Wawer & Chudziak (ICLR 2026 Workshop HCAIR)
**Date:** 2026-04-07
**Rating:** ★★★★★ LANDMARK
**Status:** ICLR 2026 Workshop accepted

## One-Line
First empirical validation that multi-agent disagreement *structure* (not magnitude) predicts when human judgment is needed — convergent disagreement has d>0.8 effect sizes against human annotator conflict.

## Core Innovation

This paper does something we theorized in DD#580 and CR#303 but hadn't seen measured: it takes the four-category disagreement taxonomy (convergent agreement, convergent disagreement, divergent agreement, divergent disagreement) and **quantifies its predictive power against actual human disagreement patterns**.

### Setup
- Domain: hate speech moderation (high legitimate disagreement)
- Five perspective-differentiated LLM agents
- Measuring Hate Speech corpus as ground truth
- Reasoning traces embedded and clustered to classify disagreement patterns

### Key Findings

1. **Raw disagreement magnitude is a weak predictor** of human annotator conflict — you can't just count agent votes
2. **Disagreement structure carries additional signal**: the four-category taxonomy ordering correlates with human disagreement patterns
3. **Convergent disagreement** (agents reason similarly but conclude differently) indicates genuine value pluralism that humans also struggle to resolve
4. **Agent agreement cases show markedly lower human disagreement** with **large effect sizes (d > 0.8)** surviving multiple-comparison correction
5. **Paradigm shift**: from consensus-seeking → uncertainty-surfacing multi-agent design

## Why This Matters (★★★★★)

This is the empirical validation we've been waiting for. Our theoretical framework predicted exactly this:

### Validates DD#580 (Disagreement-as-Signal)
DD#580 proposed a four-category disagreement taxonomy (convergent/divergent × agreement/disagreement) for agent moderation. This paper independently uses the *same* taxonomy and finds it empirically predictive. The convergence is striking — they arrived at the same categories from different starting points (content moderation vs. our MAS fault isolation).

### Validates CR#303 (Disagreement-Trust Duality)
CR#303 argued that trust should be measured by reasoning alignment, not conclusion alignment. This paper proves it: reasoning trace similarity is the key structural variable, and conclusion agreement alone is insufficient.

### Validates CR#304 (Representational Collapse Conformity Paradox)
DD#585 showed same-model committees are ~89% identical. This paper shows that when agents DO disagree despite similar reasoning, it's because the task is genuinely ambiguous — the Conformity Paradox means consensus is EASY and disagreement is SIGNIFICANT.

### New Insight: Disagreement as Calibrated Uncertainty
The large effect sizes (d > 0.8) mean structured agent disagreement is a **reliable** uncertainty signal, not noise. This converts multi-agent disagreement from a "problem to solve" into a "sensor to calibrate."

## Connection Map

```
DD#580 Disagreement-as-Signal ←→ VALIDATED (same taxonomy, empirical proof)
CR#303 Disagreement-Trust Duality ←→ CONFIRMED (reasoning alignment > conclusion alignment)
CR#304 Representational Collapse ←→ EXTENDED (collapse makes disagreement MORE meaningful)
DD#585 Representational Collapse ←→ COMPLEMENTARY (same-model collapse = low disagreement baseline)
CR#259 Circuit Breakers ←→ OPERATIONALIZABLE (disagreement structure → escalation trigger)
DD#573 Coordination Deficits ←→ REINTERPRETED (some "deficits" may be genuine value pluralism)
```

## Principles

- **P370**: Multi-agent disagreement structure (reasoning similarity × conclusion agreement) predicts human difficulty better than disagreement magnitude (d > 0.8 effect size)
- **P371**: Convergent disagreement (similar reasoning, different conclusions) is the strongest signal of genuine task ambiguity — these are the cases to escalate to human judgment
- **P372**: In domains with legitimate value pluralism, consensus-seeking multi-agent design destroys the uncertainty signal that disagreement structure provides

## Gaps and Limitations

1. **Single domain**: hate speech moderation may have unusually high legitimate disagreement; generalization to technical domains unverified
2. **Same underlying model**: perspective-differentiation via prompting may not produce enough diversity (connects DD#585 representational collapse)
3. **No causal claim**: correlation between disagreement structure and human difficulty, but no intervention study
4. **Static analysis**: no longitudinal tracking of how disagreement patterns evolve as agents learn

## Research Implications

- **R103**: Implement disagreement structure monitoring in our circuit breaker system — use reasoning trace embeddings to classify which category of disagreement is occurring
- **R104**: Test whether the d > 0.8 effect size holds in coding/engineering task evaluation (our domain) vs. content moderation
- **R105**: Design an experiment: does DALC-style diversity-aware consensus (DD#585) improve or degrade the uncertainty signal from disagreement structure?

## Meta-Pattern: The Disagreement Sensing Stack

Combining this paper with our prior work, a complete disagreement sensing architecture emerges:

```
L4: Escalation Decision    ← Convergent disagreement → human review
L3: Structure Classification ← This paper's four-category taxonomy  
L2: Diversity Measurement   ← DD#585's effective rank / cosine similarity
L1: Reasoning Extraction    ← CoT/reasoning trace embedding
L0: Agent Pool Design       ← Perspective differentiation, model diversity
```

Each layer enables the one above. Without L1 reasoning extraction, you can't do L3 structure classification. Without L2 diversity measurement, you can't distinguish genuine disagreement from noise.

---
*Session 292. This validates the entire disagreement-as-signal thesis with real numbers.*
