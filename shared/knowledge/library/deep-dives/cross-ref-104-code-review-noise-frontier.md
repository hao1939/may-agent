# Cross-Reference Synthesis #104: The Code Review Noise Frontier — When More Agent Effort Means Less Trust

## Papers Connected
1. **CR-Bench** (2603.11078) — Code review agent evaluation benchmark with SNR/Usefulness metrics
2. **Context Before Code** (2603.11073) — Vibe coding and developer-AI interaction patterns
3. **Understanding by Reconstruction** (2603.11103) — Multi-agent training through iterative reconstruction
4. **SWE-Bench** (Jimenez et al., 2024) — The upstream foundation that CR-Bench transforms
5. **Reflexion** (Shinn et al., 2023) — Self-reflection architecture showing diminishing returns

## The Synthesis: Iteration Noise Amplification

A pattern emerges across our corpus that CR-Bench now *quantifies* for the first time:

**Iterative self-improvement in agents amplifies noise faster than signal once a capability threshold is breached.**

### Evidence Stack:
1. **CR-Bench** (concrete numbers): Reflexion boosts recall 27%→33% but crashes SNR from 5.11→1.95. The noise-to-signal ratio *doubles* for a 22% recall improvement.

2. **Multi-agent debate literature** (from our corpus): Multiple rounds of debate between agents show diminishing quality improvements past 2-3 rounds — directly analogous to Reflexion's iterative probing.

3. **Model scale as threshold**: GPT-5-mini's SNR collapse (2.89→0.91 under Reflexion) shows that iteration pressure *exposes* capability limits rather than compensating for them. This connects to capability thresholds identified in our training dynamics work.

4. **Context Before Code** (2603.11073): Developer trust in AI output is context-dependent and fragile. CR-Bench's SNR metric now provides the *measurable quantity* that predicts trust collapse.

## The Frontier Shape

```
SNR ▲
     │
5.0  │  ● Single-shot GPT-5.2 (high trust, misses bugs)
     │
3.0  │  ● Single-shot GPT-5-mini
     │
2.0  │        ● Reflexion GPT-5.2 (moderate trust, catches more)
     │
1.0  │              ● Reflexion GPT-5-mini (trust collapse)
     │
0.0  └──────────────────────────────────────────► Recall
         18%    27%    28%    33%
```

This frontier is *concave* — you can't have both high recall and high SNR with current architectures. Breaking this frontier requires **architectural innovation**, not more iteration.

## Architectural Implication: Separate Generator from Filter

The solution implied by CR-Bench's data is the **two-agent code review pipeline**:
- **Agent 1 (High-Recall Generator)**: Reflexion-style, aggressive defect hunter — cast a wide net
- **Agent 2 (High-Precision Filter)**: Conservative verifier that prunes noise/hallucinations

This maps directly to the **reviewer-verifier pattern** we've identified across multi-agent architectures. CR-Bench provides the first *quantitative evidence* for why this separation is necessary in code review specifically.

## Implication for P82 / Our System

Our own multi-agent architecture faces the same noise frontier:
- Scout generating research briefs → some may be noise
- QA verifying → acts as the high-precision filter
- The key insight: **evaluation agents (like CR-Evaluator) are not optional luxuries — they're required infrastructure** for maintaining system-level SNR

## Key Metric Innovation

CR-Bench's SNR and Usefulness Rate should be adopted as **standard evaluation metrics** for any agent system where:
- False positives have real costs (developer time, trust erosion)
- The total output volume matters, not just hit rate
- Adoption/trust is a deployment concern

These metrics are missing from virtually every agent benchmark we've surveyed.

---

*Cross-Reference #104. Links Deep Dive #236 (CR-Bench) to verification gap, iteration dynamics, multi-agent architectures, and developer trust themes across the corpus.*
