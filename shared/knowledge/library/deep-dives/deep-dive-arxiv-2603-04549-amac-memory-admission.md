# Deep Dive: A-MAC — Adaptive Memory Admission Control for LLM Agents
**Paper:** arXiv:2603.04549v1 (March 4, 2026)
**Authors:** Guilin Zhang, Wei Jiang, Xiejiashan Wang, Aisha Behr, Kai Zhao, Jeffrey Friedman, Xu Chu, Amine Anoun (Workday AI)
**Date Analyzed:** 2026-03-13

## TL;DR
A-MAC treats memory admission as a **structured decision problem** with five interpretable scoring dimensions (Utility, Confidence, Novelty, Recency, Type Prior). It achieves F1=0.583 on LoCoMo benchmark (+7.8% over state-of-the-art A-mem) while being 31% faster, through a hybrid architecture that uses one LLM call for utility assessment and rule-based computation for everything else.

## Why This Matters for Multi-Agent Research
Memory is the foundational infrastructure for persistent multi-agent systems. This paper identifies a critical blind spot: **what gets INTO memory matters as much as what you retrieve FROM it.** Current approaches either:
- Store everything (memory bloat, hallucination propagation, retrieval degradation)
- Use opaque LLM-driven policies (expensive, unauditable)
- Use fixed heuristics (can't adapt across domains)

A-MAC provides the first principled admission control framework — directly relevant to our memory governance research.

## Core Framework: Five Memory Value Signals

### 1. Utility (𝒰) — LLM-scored, 97.6% of latency
- Estimates future usefulness via single LLM call
- Rates whether information is actionable, supports follow-up questions, or captures persistent user constraints
- Temperature 0 for determinism; cached for repeats
- **This is the expensive one** — 2580ms per candidate

### 2. Confidence (𝒞) — Rule-based, 0.7% of latency
- **Anti-hallucination gate:** Measures whether candidate is supported by evidence in conversation
- Uses ROUGE-L against supporting conversation turns
- C(m) = max_{s ∈ Support(m)} ROUGE-L(m, s)
- **Key insight:** Longest-common-subsequence basis rewards grounded overlap while penalizing fabricated details
- Only 18ms per candidate

### 3. Novelty (𝒩) — Rule-based, 1.2% of latency
- Prevents redundant storage
- N(m) = 1 - max_{m' ∈ M} cos(φ(m), φ(m'))
- Uses Sentence-BERT embeddings; precomputes existing memory embeddings
- 32ms per candidate

### 4. Recency (ℛ) — Rule-based, <0.1% of latency
- Exponential decay: R(m) = exp(-λ · τ(m))
- λ = 0.01 per hour → half-life ≈ 69 hours
- Sub-millisecond computation

### 5. Type Prior (𝒯) — Rule-based, 0.5% of latency
- **THE DOMINANT SIGNAL** (ablation shows -0.107 F1 when removed)
- Higher priors for stable information (preferences, identity statements)
- Lower priors for transient states (emotions, greetings)
- Rule-based pattern matching with POS cues
- 14ms per candidate

## Admission Decision
**Composite score:** S(m) = w₁·U + w₂·C + w₃·N + w₄·R + w₅·T

**Admit if S(m) ≥ θ** (learned threshold, optimal θ* = 0.55)

**Conflict resolution:** When candidate has >0.85 cosine similarity with existing memory but different content → retain higher-scoring version and merge

**Policy learning:** 5-fold cross-validated grid search over weight configurations and thresholds, maximizing F1.

## Key Results

### Main Performance (LoCoMo Benchmark, N=225)
| Method | Precision | Recall | F1 | Latency (ms) |
|--------|-----------|--------|------|-------------|
| Random | 0.278 | 0.278 | 0.278 | <1 |
| MemGPT | 0.316 | 0.333 | 0.324 | 2765 |
| MemoryBank | 0.368 | 0.583 | 0.452 | 2843 |
| Equal Weights | 0.362 | 0.694 | 0.476 | 2916 |
| A-mem (SOTA) | 0.371 | 1.000 | 0.541 | 3831 |
| **A-MAC** | **0.417** | **0.972** | **0.583** | **2644** |

### Key Takeaways:
- A-MAC beats A-mem by 7.8% F1 while being 31% faster
- A-mem achieves perfect recall but at cost of low precision (0.371) — admits too many memories
- A-MAC sacrifices only 2.8% recall for 12.4% precision improvement
- **Memory bloat is the real problem** — high recall with low precision = degraded retrieval

### Ablation: Feature Importance
| Feature Removed | F1 | ΔF1 |
|----------------|------|------|
| Full Model | 0.583 | — |
| Type Prior (𝒯) | 0.476 | **-0.107** |
| Novelty (𝒩) | 0.555 | -0.028 |
| Utility (𝒰) | 0.560 | -0.023 |
| Confidence (𝒞) | 0.568 | -0.015 |
| Recency (ℛ) | 0.570 | -0.013 |

**MOST SURPRISING FINDING:** Type Prior (the cheapest signal at 14ms) is by far the most important feature, contributing more than all other features combined. The expensive LLM-based Utility signal contributes only -0.023 ΔF1 when removed.

### Cross-Domain Generalization
- Personal conversations: F1 = 0.482
- Professional conversations: F1 = 0.338
- Same weights work across domains without retuning
- Personal domain benefits more from Type Prior (explicit preference statements)

## Critical Analysis

### Strengths
1. **Interpretability:** Every admission decision can be audited — which factor scored how, why candidate was accepted/rejected. This is critical for trust.
2. **Efficiency:** 31% faster than A-mem, 97.6% of latency from single LLM call. Four rule-based features complete in <65ms combined.
3. **Anti-hallucination as first-class concern:** Confidence score explicitly measures grounding in conversation evidence.
4. **Principled framework:** Decomposes a vague problem (what to remember?) into five clear, measurable dimensions.
5. **Learned adaptation:** Cross-validated weight optimization adapts to domain without manual tuning.

### Limitations
1. **LoCoMo benchmark only** — 30 conversations, ~1500 candidate memories. Relatively small evaluation.
2. **Single-agent focus** — doesn't address multi-agent shared memory challenges (conflicting memories from different agents, trust-weighted admission).
3. **Type Prior dominance is concerning** — if one cheap heuristic dominates, is the five-factor framework over-engineered for this benchmark? Would the same hold on other benchmarks?
4. **F1 = 0.583 is still quite low** — 41.7% of admitted memories aren't referenced (precision) and 2.8% of needed memories are missed. Significant room for improvement.
5. **Professional domain F1 = 0.338** — poor generalization to professional/technical contexts.
6. **Static threshold** — θ* = 0.55 fixed after training. Doesn't adapt to conversation dynamics (e.g., early in conversation you want more liberal admission).

### The Precision-Recall Tradeoff Insight
The paper makes an important architectural argument: **in memory systems, precision matters more than commonly acknowledged.** Low-precision memory stores accumulate irrelevant entries that:
- Degrade retrieval quality (noise in similarity search)
- Increase computational costs
- Can propagate hallucinations

This challenges the "store everything, retrieve smartly" paradigm.

## Connections to Our Research

### Direct Links
1. **SSGM Memory Governance (2603.11768):** SSGM provides governance policies for *shared* multi-agent memory. A-MAC provides admission control for *individual* agent memory. These are complementary layers — SSGM decides access rights, A-MAC decides what's worth storing.

2. **Multi-Turn Failure Taxonomy:** Memory bloat is an enabler of several degradation mechanisms:
   - **Error Cascade:** Hallucinated memories propagate errors into future turns
   - **Context Drift:** Irrelevant memories cause gradual topic divergence
   - **Self-Locking:** Redundant memories reinforce incorrect beliefs

3. **MAScope Security Framework (2603.04469):** A-MAC's Confidence score (anti-hallucination) parallels MAScope's data flow confidentiality check. Both perform trust verification at different system layers.

4. **Agent Memory Persistence Research:** A-MAC's five-factor framework provides the most principled approach to the "what to remember" question we've been tracking.

### Design Patterns for Multi-Agent Memory Governance

**Hybrid Architecture Pattern:**
- Use LLM for semantic judgments that require understanding (Utility)
- Use deterministic rules for everything that can be computed cheaply (Confidence, Novelty, Recency, Type Prior)
- This 97/3 latency split (LLM/rules) is a powerful design pattern

**Content Type as Memory Gate:**
- The dominance of Type Prior suggests a simple but powerful heuristic: **classify what kind of information this is FIRST, then decide whether to store it**
- Stable facts (preferences, identity) → always store
- Transient states (emotions, greetings) → rarely store
- This maps to our multi-agent governance tiers

### Open Research Questions
1. **Multi-agent extension:** How should A-MAC's admission control work when multiple agents contribute to shared memory? Trust-weighted Confidence scores?
2. **Dynamic thresholds:** Should θ adapt over conversation lifetime? (Liberal early, conservative late as memory fills)
3. **Adversarial robustness:** Can an adversary craft messages that score high on all five dimensions but contain subtly poisoned information?
4. **Scaling:** How does performance change with memory store size? (LoCoMo has relatively small stores)
5. **Integration with retrieval:** Should admission policy consider retrieval patterns? (If a memory type is never retrieved, lower its Type Prior)

## Relevance Score: 9/10
Foundational for memory governance research. The five-factor decomposition and hybrid architecture pattern are directly applicable to multi-agent memory systems. The surprising dominance of Type Prior challenges assumptions about what signals matter for memory admission.
