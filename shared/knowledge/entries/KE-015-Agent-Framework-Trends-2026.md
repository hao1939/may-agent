# Knowledge Entry: AI Agent Framework Trends 2026

<ai_context>
summary: The community is rejecting complex orchestration graphs (like StateGraph) in favor of simple micro-agents, structured memory, and direct tool execution.
triggers: Architecture discussions, agent framework selection.
last_updated: 2026-05-10
source_basis: XHS community trends, May 2026.
</ai_context>

## Key Trends

1. **Rejecting Heavy Orchestration**: Developers are moving away from complex tools like LangChain/StateGraph. Simple, direct execution models (bash scripts, pure python) are preferred.
2. **Micro-Agents & Subagents**: Instead of monolithic agents, the trend is towards highly specialized, atomic micro-agents with clear, structured handoffs.
3. **Structured Memory over RAG**: Large context windows and noisy vector search (RAG) lead to hallucinations. The focus is shifting to short, precise contexts and structured memory (Knowledge Graphs or explicit file-based context).
4. **Agent Harnesses & Sandboxes**: The limits of an agent are often defined by its harness. There is a strong push towards executing tools in ephemeral, zero-trust micro-sandboxes to ensure safety and reliability.

## Implications for May-Agent
- Maintain the focus on direct `bash` and file system tools (`read`, `write`, `edit`).
- Keep agent boundaries clear and context windows small (context.md).
- Investigate using lightweight sandboxes for tool execution if safety or stability becomes an issue.
