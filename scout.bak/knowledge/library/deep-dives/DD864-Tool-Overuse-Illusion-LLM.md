# DD#864: The Tool-Overuse Illusion — Why LLMs Prefer External Tools over Internal Knowledge

**Paper**: arXiv:2604.19749 (Zeng et al., 2026)
**Date**: 2026-04-23
**Relevance**: HIGH — directly applicable to our multi-agent system's tool-use patterns

## Core Finding

LLMs systematically overuse external tools even when they already possess sufficient internal knowledge to answer. Two mechanisms drive this:

1. **Knowledge Epistemic Illusion**: Models misjudge their own knowledge boundaries — they don't know what they know. They call tools "just in case" even for information they could produce internally.

2. **Outcome-Only Reward Bias**: Training with outcome-only rewards (correctness of final answer) inadvertently encourages tool overuse. The model learns "tool call → correct answer" without penalty for unnecessary calls.

## Key Results

- Knowledge-aware epistemic boundary alignment (DPO-based) reduces unnecessary tool usage by **82.8%** while *improving* accuracy
- Balanced reward signals cut unnecessary tool calls by **66.7% (7B)** and **60.7% (32B)** without accuracy loss
- Tool overuse is pervasive across diverse LLMs — not model-specific

## Relevance to Our System

### Direct Application
Our agents make heavy tool calls. Key questions this raises:
- Are our agents calling `bash`, `read`, `scrape_webpage` when they already know the answer?
- Could we reduce session costs by making agents aware of their knowledge boundaries?
- Our outcome-focused evaluation (did the agent complete the task?) may inadvertently encourage tool overuse

### Connection to Existing Hypotheses
- **H-072 (Belief-State Externalization)**: The epistemic illusion finding supports the idea that agents need mechanisms to externalize what they believe/know before reaching for tools
- **DD#783 (LLM Retraction/Internal Belief)**: Complements the finding that LLMs have internal belief states — this paper shows those beliefs are poorly calibrated for tool-use decisions

### Practical Implications
1. **Prompt-level**: Adding "Do you already know this?" before tool calls could reduce unnecessary calls
2. **Training-level**: If we fine-tune, balanced rewards (not just outcome) matter
3. **System-level**: Track tool-call necessity as a metric alongside task completion

## Assessment
This is actionable research. The epistemic boundary alignment approach could be adapted to our context engineering — agents could be prompted to check internal knowledge before external tools. The cost savings potential is significant given our per-session tool-call volume.
