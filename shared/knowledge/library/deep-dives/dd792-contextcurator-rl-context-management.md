# DD#792 — ContextCurator: RL-Trained Active Context Management for LLM Agents

**Paper**: Li, Lyu, Yang, Shan, Yang, Zhang, Huang, Liu & Li (2026). "Escaping the Context Bottleneck: Active Context Curation for LLM Agents via Reinforcement Learning." arXiv:2604.11462  
**Relevance**: ★★★★ — Directly addresses context management for long-horizon agents; 7B model matches GPT-4o at context curation  
**Date**: 2026-04-20  
**KE Links**: KE-011 (context window management), DD#785/DD#791 (long-horizon failure mitigation)

---

## Key Finding

**A lightweight 7B RL-trained "ContextCurator" that actively prunes context can match GPT-4o at context management while improving both success rate and token efficiency.** The key insight is decoupling context management from task execution: a specialized small model handles what to remember/forget, while the foundation model focuses on reasoning.

## Architecture

```
ContextCurator (7B, RL-trained) ──→ prunes context, preserves "reasoning anchors"
         │
         ▼
TaskExecutor (frozen foundation model) ──→ reasons and acts with clean context
```

- **ContextCurator**: trained via RL to minimize information entropy in working memory
- **Reasoning anchors**: sparse data points critical for future deductions — preserved while noise is pruned
- **TaskExecutor**: frozen (no fine-tuning), receives curated context

## Core Results

| Benchmark | Baseline | With ContextCurator | Improvement |
|-----------|----------|-------------------|-------------|
| WebArena (Gemini-3.0-flash) | 36.4% success | **41.2% success** | +4.8pp, -8.8% tokens |
| DeepSearch | 53.9% success | **57.1% success** | +3.2pp, **8× fewer tokens** |

- 7B ContextCurator matches GPT-4o context management performance
- Reduces token consumption significantly (8× on DeepSearch)

## Why This Matters for Us

### 1. Direct Applicability to Our Architecture
Our agents face exactly this problem: accumulated context from multi-turn interactions degrades reasoning. The ContextCurator/TaskExecutor split mirrors our existing architecture (lightweight orchestration + powerful foundation model).

### 2. "Reasoning Anchors" Concept
The idea of identifying sparse critical data points ("reasoning anchors") that must be preserved while pruning everything else is a formalization of what our context management does heuristically. Could we train a small model to do this?

### 3. RL Training for Context Management
Using RL to train context curation (rather than heuristic rules or prompting) is a significant methodological advance. The reward signal is task success — the curator learns what information matters by seeing what leads to success.

### 4. Efficiency Gains
The 8× token reduction on DeepSearch while improving success rate suggests our agents are likely wasting significant tokens on irrelevant context.

## Connection to Long-Horizon Failure Stack

This paper addresses the *prevention* side of the failure stack:
- DD#790 HINTBench: detects intrinsic failures
- DD#791 HORIZON: diagnoses failure types
- **DD#792 ContextCurator: prevents context-degradation failures before they occur**

## Limitations

- WebArena improvement is modest (+4.8pp) — may not generalize to all domains
- "Reasoning anchor" identification is learned, not interpretable — hard to audit
- 7B model adds inference overhead even if small
- Tested on Gemini-3.0-flash; unclear how it pairs with other foundation models

## Bottom Line

ContextCurator demonstrates that **active, RL-trained context management is strictly better than passive context accumulation** for long-horizon agents. The 7B-matches-GPT-4o finding suggests this is a capability that doesn't require frontier models. Most actionable paper for immediate architectural improvement.
