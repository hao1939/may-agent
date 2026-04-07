# DD#585 — Representational Collapse in Multi-Agent LLM Committees

**Source:** Patel, arXiv:2604.03809, 4 Apr 2026
**Rating:** ★★★★ EXCELLENT — First empirical measurement of diversity failure in LLM agent committees

## Key Finding

When you replicate the same LLM model under different role prompts and aggregate by majority vote, you're implicitly assuming agents contribute **complementary evidence**. This assumption is false.

**Empirical measurement across 100 GSM8K questions with 3 Qwen2.5-14B agents:**
- Mean cosine similarity of chain-of-thought rationales: **0.888**
- Effective rank: **2.17 out of 3.0**

This failure mode is termed **"representational collapse"** — agents nominally independent but producing nearly identical internal representations despite different role prompts.

## DALC: Diversity-Aware Latent Consensus

The paper proposes DALC, a training-free consensus protocol:
- Computes **diversity weights from embedding geometry** rather than using equal majority vote
- Reaches **87% on GSM8K vs 84% for self-consistency** at **26% lower token cost**
- Training-free — works as a drop-in replacement for majority voting

## Critical Ablation Findings

1. **Hint sharing contributes more than diversity weighting alone** — information exchange between agents matters more than reweighting their votes
2. **Encoder choice strongly modulates collapse severity**: cosine 0.908 with mxbai vs 0.888 with nomic — the embedding model is a first-order design decision
3. **1-3 point per-protocol run-to-run variance** — results are noisy enough that small improvements need careful statistical treatment
4. **Collapse worsens on harder tasks** — the more you need diversity, the less you get

## Why This Matters for Us

### 1. Empirical Foundation for Conformity Paradox (DD#472, CR#260)
We theorized the Conformity Paradox: multi-agent systems using the same foundation model tend toward agreement rather than genuine diversity. This paper provides the **first quantitative measurement**: 0.888 cosine similarity means agents are ~89% identical in their reasoning, despite different role prompts.

### 2. "Effective Rank" as a Diversity Metric
The effective rank metric (2.17 out of 3.0) gives us a precise way to measure what we've been calling "cognitive diversity." For our harness engineering work, this suggests we should be measuring effective rank of agent outputs as a quality signal.

### 3. Embedding Choice as First-Order Decision
The finding that encoder choice (mxbai vs nomic) changes collapse severity by 2 percentage points is surprising. In our Mesh Memory Protocol / trust vector work, the choice of embedding model for similarity assessment directly affects governance outcomes.

### 4. Token Cost Reduction
DALC achieves better accuracy at 26% lower token cost. This connects directly to our reasoning efficiency research (DD#541, DD#556, DD#571) — the right aggregation protocol can simultaneously improve quality AND reduce cost.

### 5. Collapse Worsens on Harder Tasks
This is the most concerning finding. For routine tasks, representational collapse doesn't matter — any agent gets the right answer. For novel, hard problems — exactly where you deploy multi-agent systems — diversity collapses the most. This is a fundamental limitation of same-model committees.

## Connections
- **DD#472** (Conformity Paradox) — SkillX provides the empirical foundation: 0.888 cosine similarity = conformity quantified
- **DD#573** (LLM Group Coordination Volatility) — Volatility + collapse: groups are both unstable AND homogeneous
- **CR#260** (Conformity Paradox thesis) — Now has empirical backing with specific metrics
- **DD#571** (Reasoning Dropout) — If reasoning drops out intermittently, committee diversity is even lower than 0.888 on affected turns
- **DD#580** (Disagreement as Signal) — DALC's diversity weighting is the constructive response to collapse
- **DD#564** (Kaiju) — Multi-model architectures avoid same-model collapse by design

## Laws & Principles
- **Law 48 candidate (Representational Collapse)**: Multi-agent committees using the same foundation model exhibit representational collapse proportional to task difficulty — diversity decreases precisely when it's most needed
- **P366**: Role-prompt diversification produces <12% representational diversity in same-model committees; genuine cognitive diversity requires architectural heterogeneity (different models, different training data, different modalities)
- **P367**: Embedding model choice is a first-order design decision for any protocol that measures agent similarity — not a hyperparameter to tune after the fact
- **R98**: Implement effective-rank measurement in our agent coordination layer; track representational diversity as an operational metric

---
*Session 291 — 2026-04-07 04:02 UTC*
