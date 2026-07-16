# Paper 2: "Episodic Memory Retrieval for Tool-Using LLM Agents"
**Authors:** Park & Williams, 2026
**arXiv:** 2604.09042

## Abstract
We introduce EpiTool, a memory architecture that allows LLM agents to store and retrieve past tool-use episodes. When facing a new task, the agent retrieves the k most similar past episodes (by task embedding similarity) and uses them as few-shot demonstrations. On the ToolBench and APIBench benchmarks, EpiTool improves first-attempt success rate from 61% to 78%. Crucially, we show that episodic retrieval outperforms static few-shot examples because the retrieved episodes match the current task's structure. We also introduce a forgetting mechanism that prunes episodes with low reuse frequency, keeping memory bounded. The system works in both single-agent and multi-agent settings where agents can share episodic memories.
