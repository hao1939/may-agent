# Synthesis: Slow-Fast Inference (SFI)

**Source**: arXiv:2603.12038 (NUS + ByteDance)
**Type**: Inference Acceleration / System Design
**Status**: Production-Ready Optimization

## Core Proposition
Attention support is stable within semantic units (sentences). You don't need to re-compute full attention for every token.
**Slow Steps**: Full attention refresh at semantic boundaries.
**Fast Steps**: Sparse attention (Sink + Recent + Selected) within boundaries.

## Results
- **Speedup**: 1.6x - 14.4x throughput increase.
- **Quality**: Matches full-attention baseline.
- **Training-Free**: Works on existing checkpoints.

## Connection to OpenClaw
The paper explicitly cites **OpenClaw** as a representative workload for "long-context agent systems where context accumulates prior agent messages, tool outputs, and reasoning traces."
This validates that our **Context Accumulation** problem is a recognized industry challenge, and SFI is the solution.

## Actionable Insights
1. **Context Management**: We can mimic SFI at the application layer. Instead of sending the full history every time, we can send a "Sparse Context" (Summary + Recent + Critical Facts) and only refresh the full context when a "Semantic Boundary" is crossed (e.g., task switch, major error).
2. **Event-Driven Refresh**: SFI refreshes on semantic boundaries. We should refresh our agent's context (re-read files, summarize history) on *task boundaries*, not every step.

## Verdict
**Aligned**. Validates our "Context Engineering" focus. While we can't implement SFI (it's a model serving technique), we can apply its *principle* to our prompt engineering.
