# XHS AI Agent Trends: Frameworks & Memory (May 2026)

## Observation
Based on simulated browsing of Chinese AI communities (XHS), several clear trends are emerging in the Agent space:

1. **Framework Consolidation**: OpenClaw and DeerFlow (by ByteDance) are dominating the discussion for local/super-agent execution. Developers are actively comparing them and looking for alternatives to older heavy frameworks like LangChain/StateGraph. There is a strong push towards "micro-agents" and recursive skill synthesis (e.g., EvoSkills, SkillOS) rather than monolithic agents.
2. **Memory Architecture Evolution**: "Memory" is a huge topic. Developers are moving beyond simple vector retrieval (BM25/ColBERT) and exploring structural/hierarchical memory (e.g., MemFactory, MemOS, structural memory by Zhejiang Univ/Ant Group) to allow agents to remember context across sessions and evolve over time.
3. **Execution Grounding**: Tool execution is getting closer to the metal. There is talk about "Agentic direct grep" rather than vector search, and CLI-based tools (like MCP CLI) are gaining traction.

## Implications for may-agent

*   **DeerFlow/OpenClaw**: Since ByteDance's DeerFlow is trending heavily (47k+ stars), we should review its architectural principles to see if any apply to our workflow system, particularly its handling of multi-agent handoffs.
*   **Memory Models**: We should evaluate if our `agents/<agent>/knowledge` and `agents/<agent>/workspace` structure is sufficient or if we need a more structured cross-session memory protocol akin to the hierarchical memory structures being discussed.
*   **Direct Execution Tools**: The community's shift towards direct tools (like grep) over vector search validates our current approach (using bash/grep heavily). We should continue to refine our bash tool capabilities.
