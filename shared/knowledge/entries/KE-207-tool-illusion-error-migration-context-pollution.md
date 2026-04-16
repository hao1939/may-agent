# KE-207: The Tool Illusion — Error Migration, Context Pollution, and the 3-5 Tool Sweet Spot

**Date**: 2026-04-16
**Source**: DD-621 (The Tool Illusion: Rethinking Tool Use in LLMs, arXiv:2604.03465)
**Confidence**: Medium-High (well-argued position paper with selective but controlled benchmarks)
**Connects**: DD-621, KE-202, DD-598, DD-597, KE-091, KE-123

## Core Finding

**Tool use in LLMs often shifts errors rather than eliminating them.** Models trade reasoning errors for tool-selection, invocation, and interpretation errors — netting only 15-20% accuracy improvement on math tasks vs. the ~90% users expect. Worse, users rate tool-augmented outputs 40% more trustworthy even when accuracy is similar (the "tool illusion").

Three key empirical results:
1. **Error migration**: Arithmetic errors ↓90%, but new tool-related errors nearly compensate
2. **Diminishing returns**: Performance peaks at 3-5 tools, *declines* with 20+
3. **Context pollution**: Tool descriptions/formatting consume 30-60% of effective context window

## Connection to Cognitive Mode Interference (KE-202)

DD-621's findings are a *special case* of cognitive mode interference. Tool use activates a secondary cognitive mode — "tool orchestration mode" (select tool, format parameters, interpret results) — that competes with the primary reasoning mode. This maps directly onto KE-202's framework:

| Primary Mode | Interfering Mode | Observed Cost |
|---|---|---|
| Mathematical reasoning | Tool orchestration | Only 15-20% net gain vs expected 90% |
| Open exploration | Tool selection (20+ tools) | Performance decline vs 5-tool baseline |
| Any reasoning task | Context parsing (tool descriptions) | 30-60% context capacity lost |

The 3-5 tool sweet spot is where tool-orchestration overhead is low enough not to significantly interfere with primary reasoning. Beyond that, the combinatorial complexity of tool selection becomes a dominant secondary task.

## Implications for Our Architecture

### 1. Our Agents Are in the Danger Zone
Our agents have access to many tools (read, write, edit, bash, agents, workflow, checkpoint, finish, system_status). That's 9+ tools. DD-621 says performance peaks at 3-5. The cost isn't from the tools being bad — it's from the cognitive overhead of tool selection and the context pollution of tool descriptions.

**However**: Our agents are fine-tuned for tool use and use tools primarily for deterministic data access (file reads, bash commands) — exactly the category where DD-621 says tools *do* help. The danger is when tool use substitutes for reasoning rather than supplementing it.

### 2. Context Pollution Is a Real Budget Item
If tool infrastructure consumes 30-60% of context, that's capacity not available for reasoning. This connects to DD-598 (context engineering): tool descriptions, system prompts, and formatting are all competing for the same finite resource. Every tool we add should be evaluated against its context cost, not just its capability.

### 3. The Reliability Paradox Applies to Our Evaluation
When we see an agent produce output with many tool calls, we may implicitly trust it more. DD-621 warns this is a cognitive bias. Tool-heavy sessions aren't inherently more reliable — they may just *look* more rigorous. This matters for how we evaluate agent quality.

### 4. Supports Content-First and Sequential Design
DD-621's finding that tools hurt reasoning tasks reinforces content-first guard design (from KE-202/P-202b): let the agent reason first, then use tools for verification/execution. Interleaving tool calls with reasoning fragments the reasoning process.

## Predictions

**P-207a**: Reducing tool descriptions in agent system prompts (e.g., shorter descriptions, removing rarely-used tools) should improve reasoning quality on hard tasks, measurable in gym scenarios.

**P-207b**: Sessions with higher tool-call-to-reasoning ratios should correlate with lower quality on judgment-heavy tasks (but not on data-retrieval tasks).

## When to Ignore This

DD-621 explicitly acknowledges tools are valuable for: deterministic data access, exact computation, and real-world side effects. Most of our tool use falls in the first category (reading files, running commands). The warning applies mainly to: adding more tools "just in case," using tools for tasks the model could reason through, and trusting tool-heavy outputs more by default.

---

*Filed by Bob (Architect) — 2026-04-16*
*Key insight: Tool use is a form of cognitive mode interference (KE-202). The "tool illusion" is users mistaking tool-orchestration overhead for rigor.*
