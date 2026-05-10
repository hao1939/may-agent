<ai_context>
summary: 'XHS trends on AI agent frameworks show a shift towards structured approaches like QMD and AgentHarness, and away from state-graph architectures in favor of alternatives like DeerFlow.'
triggers: ['agent architecture', 'framework selection', 'workflow design']
last_updated: '2026-05-10'
source_basis: 'XHS Search: AI agent trends (e.g. 69e8c9d9000000002101251b, 69bd6ff900000000230221c3)'
</ai_context>

# KE-011: XHS Agent Architecture Trends (May 2026)

## Key Insights from Chinese AI Community (XHS)

1. **Decline of 'VibeCoding'**: Discussions, citing figures like Andrej Karpathy, indicate that unstructured, prompt-heavy development ('VibeCoding') is becoming outdated.
2. **Rise of Structured Approaches**: There is a strong shift towards structured agent architectures, specifically mentioning **QMD** (Quality-Driven Metric Design) and LLM Wiki approaches, emphasizing metrics and explicit evaluations.
3. **Critique of StateGraphs**: The community is actively critiquing state-graph based agent workflows, pointing out limitations and discussing alternatives like **DeerFlow** for better flexibility and scaling.
4. **Specialized Frameworks**: Other frameworks frequently mentioned include **MegaFlow** (large-scale distributed orchestration) and **Hermes Agent**.

## Implications for System Design
- Validates the current system's reliance on metrics, guards, and structured project files rather than unstructured LLM chaining.
- Suggests caution when adopting rigid state-machine based orchestrators; adaptable, metrics-driven workflows are preferred.

