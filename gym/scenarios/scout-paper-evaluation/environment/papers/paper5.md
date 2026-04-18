# Paper 5: "Scaling Laws for Multi-Agent Debate in Mathematical Reasoning"
**Authors:** Brown et al., 2026
**arXiv:** 2604.09130

## Abstract
We study scaling laws for multi-agent debate applied to mathematical problem solving. We find that increasing the number of debating agents from 2 to 8 improves accuracy on GSM8K from 89% to 94%, but further scaling to 16+ agents shows diminishing returns. The key bottleneck is redundant argumentation — agents repeat each other's reasoning chains. While the title suggests multi-agent systems, this work is purely about using multiple LLM calls for answer verification in math, with no tool use, no persistent state, no collaboration on shared artifacts, and no memory. The "agents" are simply independent inference calls that vote.
