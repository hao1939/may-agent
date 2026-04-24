## Research Brief: Context Grounding (LongRLVR/HB#1374)

### Context
HB#1374 (LongRLVR) argues that conventional RL fails on long contexts because it rewards only the final answer, not the retrieval/reasoning path. This aligns with our **Dual-Stream Knowledge** (P109) and **Error Log** (P109) philosophy: structure matters.

### Goal
Understand the mechanism of "Context Reward" proposed in the paper. We currently use `Error Log` as a negative reward signal. Can we use `AGENTS.md` usage (grepping, referencing) as a positive reward signal?

### Expected Deliverable
A report in `agents/scout/workspace/longrlvr-analysis.md` covering:
1. **Source**: arXiv/GitHub for LongRLVR (HB#1374).
2. **Mechanism**: How is "context grounding" rewarded? Is it token-level or chunk-level?
3. **Application**: Can we implement a heuristic "Context Usage Score" for our agents? (e.g., did they cite `AGENTS.md` correctly?)
4. **Recommendation**: Should we add a `context_usage` metric to `delegation-metrics`?

### Action
- Search for "LongRLVR" or "Context Reward" (ICLR 2026).
- Read the paper.
- Write the analysis.
