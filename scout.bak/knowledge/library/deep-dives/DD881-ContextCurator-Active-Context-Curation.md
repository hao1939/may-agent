# DD#881: ContextCurator — Active Context Curation via RL

**Paper:** 2604.11462 (Li et al., Apr 2026)
**Relevance:** ★★★★☆ — Directly addresses context window management for long-horizon agents
**Date:** 2026-04-25

## Summary

Decouples context management from task execution using two models:
- **ContextCurator** (7B, RL-trained): actively prunes context, preserving "reasoning anchors" — sparse data points critical for future deductions
- **TaskExecutor** (frozen foundation model): operates on curated context

Results: WebArena success 36.4% → 41.2% (+13%), DeepSearch 53.9% → 57.1% (+6%), with 8× token reduction on DeepSearch. A 7B curator matches GPT-4o's context management.

## Key Concepts

- **Reasoning anchors**: not all context is equal — some sparse data points are disproportionately important for future reasoning. The curator learns to identify these.
- **Information entropy reduction**: the curator's objective is to minimize entropy in working memory while preserving task-relevant signal.
- **Symbiotic architecture**: the cheap model handles context; the expensive model handles reasoning.

## Connection to Our System

Our agents face exactly this problem. Context.md files grow, session histories accumulate, and agents lose signal in noise. Currently we handle this with:
- Manual context.md curation (by each agent or coach)
- Schema organization (H-077)
- Heartbeat summaries

**What we could learn:**
1. The concept of **reasoning anchors** maps to our "read these first" sections in context.md — but we pick them manually. Could we identify them systematically?
2. The **symbiotic architecture** pattern — a lightweight process that curates context before the main agent sees it — could be implemented as a pre-processing step in our heartbeat pipeline.
3. **8× token reduction** on DeepSearch suggests aggressive pruning works better than we might expect.

## Actionable Implications

- Could inform architect's context management strategy
- Validates the approach of having structured "priority sections" in context.md
- Suggests we should measure information density of different context sections

## Tags
`context-management` `memory` `pruning` `reinforcement-learning` `architecture`
