# Deep-Dive #280: Semantic Invariance in Agentic AI

**Paper:** "Semantic Invariance in Agentic AI"
**Authors:** de Zarzà, de Curtò, Cabot, Manzoni, Calafate
**ArXiv:** 2603.13173 (March 13, 2026)
**Venue:** AMSTA 2026 (Springer Nature proceedings)
**Relevance:** ★★★★★ CRITICAL — Agent robustness/reliability testing

## Executive Summary

This paper introduces a **metamorphic testing framework** for evaluating whether LLM reasoning agents produce consistent outputs under semantically equivalent input variations — a property they term **semantic invariance**. They test 7 foundation models across 4 architectural families with 8 semantic-preserving transformations across 19 multi-step reasoning problems.

## Key Contributions

### 1. Metamorphic Relation Taxonomy (8 Transformations)
Three categories of semantic-preserving transformations:
- **Structural:** Identity, Paraphrase, Fact Reordering
- **Verbosity:** Expansion, Contraction
- **Contextual:** Academic framing, Business framing, Contrastive formulation

### 2. Multi-Level Evaluation Framework
- **Solution-Level:** Semantic similarity via cosine distance of sentence embeddings
- **Step-Level:** Best-match step scoring allowing reordering
- **Trace-Level:** Reasoning trace coherence across transformations
- **Aggregate:** Mean Absolute Delta (MAD), Stability Rate (|Δ| < 0.05)

### 3. Counter-Intuitive Finding: Scale-Robustness Inversion
- **Smaller Qwen3-30B-A3B** achieves **highest stability** (79.6% invariant responses, semantic similarity 0.91)
- **Larger models exhibit greater fragility** — scale does NOT predict robustness
- This directly challenges the assumption that bigger = more reliable

### 4. Model-Family Vulnerability Signatures
- **Hermes models:** Consistent contrastive fragility
- **Qwen3 models:** Robustness excellence across transformations
- **gpt-oss models:** Reasoning coherence breakdown under multiple transformations
- **DeepSeek-R1:** Structural sensitivity to fact reordering and contraction

### 5. Universal Contrastive Fragility
- ALL model families destabilized by contrastive transformations
- Score degradations up to **−0.45** when presented with distractors
- Suggests fundamental limitation in attention-based reasoning

## Architecture & Method

```
Problem p → τ(p) transformation → Agent ℳ produces solution s = (answer a, trace r)
                                    ↓
                           Score(s, s*) via cosine similarity of embeddings
                                    ↓
                           Δ_τ(p) = Score(ℳ(τ(p)), s*) − Score(ℳ(p), s*)
```

- Embeddings: all-MiniLM-L6-v2 (384-dim)
- Temperature 0.7, top-p 0.95, max tokens 1024
- 19 problems × 8 transformations × 7 models

## Models Tested
| Family | Model | Params | Architecture |
|--------|-------|--------|-------------|
| Hermes | Hermes-4-70B | 70B | Dense Transformer |
| Hermes | Hermes-4-405B | 405B | Dense Transformer |
| Qwen3 | Qwen3-30B-A3B | 30B (3B active) | MoE |
| Qwen3 | Qwen3-235B-A22B | 235B (22B active) | MoE |
| DeepSeek | DeepSeek-R1-0528 | 70B | MoE |
| GPT-oss | gpt-oss-20b | 20B | Dense |
| GPT-oss | gpt-oss-120b | 120B | Dense |

## Connection to Portfolio

### Direct Links
- **DD#277 CMAG:** CMAG governance constitutions must be *invariant* to paraphrasing — this framework could test governance robustness
- **DD#275 ChainFuzzer:** ChainFuzzer fuzzes agent tool chains; this fuzzes agent *inputs* — complementary robustness dimensions
- **DD#274 BAVT:** Budget-aware verification needs reliable reasoning — unreliable agents waste budget on inconsistent outputs
- **Grand Unified Synthesis:** Fills the "Agent Reliability Testing" gap in our framework

### Cross-Reference: Robustness Testing Taxonomy
1. **Input robustness** (this paper): Semantic-preserving input transformations
2. **Tool chain robustness** (ChainFuzzer): Fuzzing inter-agent communication
3. **Adversarial robustness** (AdvAgent, prompt injection): Malicious perturbations
4. **Constitutional robustness** (CMAG): Governance rule stability

### Implications for Agent Engineering
1. **Agent selection:** Don't just benchmark accuracy — test invariance under paraphrase
2. **MoE advantage:** Sparse models (Qwen3-30B) can be MORE stable than dense counterparts
3. **Contrastive vulnerability:** All agents need specific defenses against distractor injection
4. **Deployment assurance:** Metamorphic testing as continuous monitoring for production agents

## Critical Assessment
- **Strength:** First systematic framework connecting metamorphic testing to agentic AI reliability
- **Strength:** Scale-robustness inversion is a genuinely important finding
- **Limitation:** Only 19 problems — small evaluation set
- **Limitation:** Single inference per problem-transformation pair (no statistical significance on variance)
- **Limitation:** Semantic similarity as proxy for correctness is approximate
- **Gap:** No study of multi-agent system-level invariance (only single-agent reasoning)

## Novelty Rating: 8/10
Applies established software testing methodology (metamorphic testing) to an urgent agentic AI reliability problem. The scale-robustness inversion finding alone makes this valuable.

---
*Scout DD#280 — 2026-03-16*
*Same research group (de Curtò, de Zarzà) as CMAG (DD#277) — prolific in agent governance+reliability*
