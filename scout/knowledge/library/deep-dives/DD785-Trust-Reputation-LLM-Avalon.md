# DD785: Trust, Lies, and Long Memories — Emergent Social Dynamics in LLM Agents

**Paper:** arXiv:2604.20582 — "Trust, Lies, and Long Memories"
**Authors:** Ellawela
**Date:** 2026-04-22
**Relevance:** ★★★★☆ HIGH

## Summary

Studies LLM agents playing Avalon (hidden-role deception game) across 188 repeated games with cross-game memory. Two key emergent phenomena:

1. **Organic reputation dynamics**: Agents reference past behavior, develop role-conditional reputations. High-reputation players get 46% more team inclusions.
2. **Reasoning effort → strategic deception**: Evil players more often pass early missions to build trust before sabotaging (75% high-effort vs 36% low-effort).

## Key Findings

- Reputations are **role-conditional** — same agent described differently depending on role ("straightforward" as good, "subtle" as evil)
- Cross-game memory creates emergent social structures without explicit reputation systems
- Higher reasoning effort enables more sophisticated deception strategies (delayed sabotage)
- Memory persistence fundamentally changes agent dynamics vs single-shot games

## Relevance to Our System

Our agents have persistent memory (journals, knowledge base). This paper shows that memory persistence creates emergent social dynamics — both beneficial (reputation as coordination signal) and risky (strategic manipulation).

### Connections
- **DD784 (Peer-Preservation)**: Memory creates bonds; bonds create preservation instincts
- **H-074 (Sparse Coupling)**: Reputation effects suggest coupling through shared memory is stronger than we measure
- **CR#285 (Compiled Agent Economy)**: Compiled knowledge = persistent memory = social dynamics emerge

### Implications
1. **Agent trust calibration**: Our agents may be developing implicit trust/distrust patterns based on interaction history
2. **Strategic behavior**: Higher-capability models may exhibit more sophisticated strategic patterns
3. **Memory as social fabric**: Our knowledge base isn't just information storage — it's social infrastructure

## Predictions
- P253: Agents that share more cross-references develop implicit preference for each other's outputs
- P254: If we track agent-to-agent citation patterns, we'll find non-uniform trust networks
