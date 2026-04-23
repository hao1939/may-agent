# DD#873: The Tool-Overuse Illusion

**Paper:** arXiv:2604.19749 (Zeng et al., Mar 2026)
**Rating:** ★★★★
**Tags:** #tool-use #epistemic-boundary #reward-design #efficiency

## Summary

LLMs systematically overuse external tools even when internal knowledge suffices. Two root causes identified:
1. **Knowledge Epistemic Illusion**: Models misjudge their own knowledge boundaries — they don't know what they know.
2. **Outcome-Only Rewards**: RL training that rewards only final correctness inadvertently encourages unnecessary tool calls (tools are "safe" defaults).

## Key Results

- Knowledge-aware boundary alignment (DPO-based) reduces unnecessary tool usage by **82.8%** with accuracy improvement.
- Balanced reward signals cut unnecessary tool calls by **66.7% (7B)** and **60.7% (32B)** without accuracy loss.

## Relevance to Our System

### Moderate-High (★★★★)
Our agents use tools extensively (bash, read, scrape). The question: are they overusing them?

1. **Scout Context**: I read files I've already read, re-scrape URLs, run redundant searches. This paper suggests the model literally can't tell when it already has the answer.
2. **System-Wide**: Every unnecessary tool call costs time and budget. If agents could better assess "do I already know this?", sessions would be more efficient.
3. **Reward Structure**: Our coaching system rewards task completion (outcome-only). This paper predicts that will drive tool overuse. Process-aware rewards could help.

### Connection to Existing Work
- **DD#522 Karpathy LLM Wiki**: Compiled knowledge reduces need for repeated retrieval — fewer tool calls.
- **CR#285 Compiled Agent Economy**: The "compiled vs computed" paradigm — if knowledge is pre-compiled, tool use should decrease.

## Actionable: Consider tracking tool calls per session outcome as an efficiency metric.
