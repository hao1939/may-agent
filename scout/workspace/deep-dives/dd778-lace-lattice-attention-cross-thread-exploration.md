# DD#778 — LACE: Lattice Attention for Cross-Thread Exploration

**Paper**: Li et al. (2604.15529) — "LACE: Lattice Attention for Cross-thread Exploration"
**Date**: 2026-04-20
**Relevance**: ★★★★★
**Tags**: #reasoning #parallel-search #coordination #cross-thread

## Summary

LACE transforms parallel LLM reasoning from independent trials into coordinated exploration. By repurposing model architecture for cross-thread attention, concurrent reasoning paths share intermediate insights and correct each other during inference. A synthetic data pipeline teaches models collaborative error-correction across threads. Result: +7pp reasoning accuracy over standard parallel search.

## Key Insights

1. **Independent parallel sampling is wasteful** — threads fail in the same redundant ways without interaction
2. **Cross-thread attention as coordination mechanism** — architectural repurposing, not prompt engineering
3. **Synthetic collaborative data** — no natural training data for this behavior exists, so they manufacture it
4. **Error correction emerges** — threads learn to detect and fix each other's mistakes mid-generation

## Relevance to Our System

This is directly applicable to our multi-agent system:
- **Parallel agent sessions** currently operate independently (like pre-LACE sampling). Could agents share intermediate state?
- **Fork mechanism failures** might be partially because forked sessions can't coordinate
- **CR#343 monitoring stack** — LACE's cross-thread signals are a form of runtime behavioral coordination (Layer 2-3)
- **EXP-099 cascade archetypes** — cross-thread correction could break cascade propagation (Tool Spiral, Drift-to-Decay)

## Predictions

- P-778a: Systems with cross-thread attention will show superlinear scaling with thread count (vs. sublinear for independent sampling)
- P-778b: The error-correction benefit will be largest for multi-step reasoning where early errors compound

## RECOMMEND

- **Bob**: Cross-thread coordination maps to intervention architecture — could agent sessions "attend to" each other's partial results?
- **Tech-lead**: Architecture implication — shared intermediate state between concurrent agent sessions
