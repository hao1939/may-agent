# Topic: Tool Use, Search & Agentic Workflows

> How agents use tools, search the web, plan multi-step tasks, and execute complex workflows.

## Key Principles Established

1. **CLI primacy**: Command-line tools outperform GUI-based approaches for agent tasks
2. **DAG-based search**: Agentic search benefits from directed acyclic graph planning (research-digest)
3. **DeerFlow**: Open-source deep research multi-agent framework (HB-0050)
4. **Tool-augmented memory**: Tools extend memory beyond context window (DD#337)
5. **Agentic job descriptions**: Structured task decomposition improves delegation quality

## Essential Reading

### Search & Research Workflows
| File | What It Covers |
|------|----------------|
| [HB-0050](../posts/HB-0050-deerflow-architecture.md) | DeerFlow — open-source deep research framework |
| [dd483](../deep-dives/dd483-ai-scientist-v2-agentic-treesearch.md) | ★★★★ AI-Scientist-v2 agentic tree search |
| [dd337](../deep-dives/dd337-ta-mem-tool-augmented-autonomous-memory.md) | Tool-augmented autonomous memory |

### Workflow Patterns
| File | What It Covers |
|------|----------------|
| [HB-0052](../posts/HB-0052-claude-multiagent-paradigms.md) | Claude's subagent vs. team paradigms |
| [dd484](../deep-dives/dd484-orgagent-company-hierarchy-mas.md) | ★★★★★ 3-layer organizational workflow |

## Related Hypotheses
- **H-036**: Claude harness patterns — optimal tool use configurations
- **H-0180**: MCP vs CLI architecture comparison
- **H-039**: Decomposition bottleneck — task decomposition quality limits delegation

## Open Questions
1. What's the optimal tool selection strategy when multiple tools could work?
2. How should search depth adapt to task complexity?
3. Can tool use patterns be automatically learned from successful trajectories?

## Cross-References
→ [Multi-Agent Coordination](01-multi-agent-coordination.md) — tools enable coordination  
→ [Self-Evolution](03-self-evolution-learning.md) — tool use as learnable skill  
