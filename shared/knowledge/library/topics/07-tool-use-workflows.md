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

### Knowledge Entries (KE-043+)
| Entry | What It Covers |
|-------|----------------|
| [KE-043](../../entries/KE-043-forced-externalization-complete-picture.md) | ★★★★★ Forced externalization complete picture: 60+ runs, 100% pass vs 0-50% baselines. Mechanism is "analysis activation" (behavioral mode shift). Dual pathways (write OR read). Workflow hierarchy: reward shaping (0%) < text skills (0%) < hard workflow (100%). |
| [KE-047](../../entries/KE-047-agent-harness-architecture-convergence.md) | Harness Architecture Convergence: 10 structural subsystems including tool registry, context assembly, lifecycle hooks. Snapshot isolation (+22pp), on-demand knowledge loading. Context drift dominant failure at 34%. |
| [KE-049](../../entries/KE-049-agent-environment-interface-formalization-ceiling.md) | Interface Formalization Ceiling: schema-first tool APIs reduce interface misuse but have zero impact on semantic misuse and zero task success improvement (DD-543). Agent HTTP behavioral signatures compress to 1-2 requests (DD-566). |
| [KE-056](../../entries/KE-056-constraint-hierarchy-workaround-availability.md) | Constraint Hierarchy: L5 action-space > L4 mechanical (100%) > L3 experiential (67%) > L2 binding (0%) > L1 text (0%). Workaround availability is the dominant variable. |
| [KE-059](../../entries/KE-059-fewshot-breaks-text-rule-binary.md) | ★★★★ Few-Shot Breaks Text-Rule Binary: Worked examples produce +2.3 score improvement and 100% analysis creation on judgment tasks where text rules = 0%. Checklists (+2.0) and echo-back (+1.3) also effective. First evidence of intermediate skill delivery methods between L1 text (0%) and L5 workflow (100%). |
| [KE-128](../../entries/KE-128-phase0-discovery-structural-intervention-fm13.md) | ★★★★ Phase 0 Discovery — Structural Intervention for FM-1.3: Mandatory directory-discovery pre-phase producing `nav-map.md` eliminates exhaustive reading (+100pp, N=3+3). Skills teach knowledge but not confidence to skip files; Phase 0 changes information state before task begins. 3rd validated agent-specific structural guard. |

## Related Hypotheses
- **H-036**: Claude harness patterns — optimal tool use configurations
- **H-0180**: MCP vs CLI architecture comparison
- **H-039**: Decomposition bottleneck — task decomposition quality limits delegation
- **H-091**: Skill delivery methods between text rules and workflow enforcement — few-shot, checklists, echo-back are intermediate mechanisms (P(H)=0.75)

## Open Questions
1. What's the optimal tool selection strategy when multiple tools could work?
2. How should search depth adapt to task complexity?
3. Can tool use patterns be automatically learned from successful trajectories?

## Cross-References
→ [Multi-Agent Coordination](01-multi-agent-coordination.md) — tools enable coordination  
→ [Self-Evolution](03-self-evolution-learning.md) — tool use as learnable skill  
