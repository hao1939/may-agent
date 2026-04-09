# Topic: Agent Design Patterns & Practical Architecture

> Patterns that work in practice — harness engineering, delegation, session management, error handling, vibe coding.

## Key Principles Established

1. **Harness > Model**: The engineering around the LLM matters more than the LLM itself (DD#481, system experience)
2. **Delegation asymmetry**: Delegating tasks has non-obvious quality costs (H-006, H-014)
3. **Session fragility**: Agent sessions are inherently fragile and need crash recovery (H-034)
4. **Sprint contracts**: Bounded commitment periods improve reliability (H-045)
5. **Decision topology matters**: How decisions flow through the system determines output quality (H-041, H-042)
6. **Vibe coding works for prototyping**: But needs systematic testing for production (SYNTH-005)

## Essential Reading

### Architecture Patterns
| File | What It Covers |
|------|----------------|
| [HB-0052](../posts/HB-0052-claude-multiagent-paradigms.md) | Claude subagent vs. team paradigms |
| [dd484](../deep-dives/dd484-orgagent-company-hierarchy-mas.md) | ★★★★★ 3-layer organizational pattern |
| [dd485](../deep-dives/dd485-cascade-scoped-communication-replanning.md) | ★★★★★ Scoped communication pattern |
| [dd255](../deep-dives/dd255-anthropic-measuring-agent-autonomy.md) | ★★★★★ Measuring agent autonomy in practice |

### Practical Patterns from Our System
| File | What It Covers |
|------|----------------|
| [H-036](../../hypotheses/H-036-claude-harness-patterns.md) | Claude harness patterns |
| [H-037](../../hypotheses/H-037-patrol-pattern.md) | Patrol pattern for monitoring |
| [H-045](../../hypotheses/H-045-sprint-contract-pattern.md) | Sprint contract pattern |
| [H-046](../../hypotheses/H-046-coupled-resource-channels.md) | Coupled resource channels |

### Human-AI Interaction
| File | What It Covers |
|------|----------------|
| [dd256](../deep-dives/dd256-anthropic-disempowerment-patterns.md) | Disempowerment patterns in LLM usage |
| [dd257](../deep-dives/dd257-anthropic-assistant-axis.md) | The assistant axis — LLM character |
| [SYNTH-005](../posts/SYNTH-005-vibe-coding-evolution.md) | Vibe coding evolution synthesis |

### Knowledge Entries (KE-043+)
| Entry | What It Covers |
|-------|----------------|
| [KE-047](../../entries/KE-047-agent-harness-architecture-convergence.md) | ★★★★★ Agent Harness Convergence: four independent implementations converge on 10 subsystems. Six irreducible core: agent loop, tool registry, context assembly, context reduction, state persistence, delegation. 1:1 mapping to software engineering patterns. Context drift dominant failure at 34%. |
| [KE-049](../../entries/KE-049-agent-environment-interface-formalization-ceiling.md) | Formalization Ceiling: structured interfaces eliminate mechanical errors but NOT reasoning errors. Six-level formalization ladder (L0 raw text → L6 co-evolutionary memory). Ceiling between L2 and L3. Practical pattern: formalize structure, externalize judgment. |
| [KE-050](../../entries/KE-050-robustness-architecture-nexus.md) | Robustness-Architecture Nexus: agents collapse 30-70% under minor perturbations. Robustness Stack ordering: Topology > Harness > Evaluation > Model — inverts common assumption. Self-optimizing MAS pattern: automated topology search with constitutional bounds. |
| [KE-075](../../entries/KE-075-client-side-pipeline-optimization-model-selection.md) | Client-Side Pipeline Optimization: 13-32× cost gap between best/worst model assignments at matched accuracy. Bandit algorithms (Arm Elimination) find near-optimal combinations with 24-67% less evaluation budget. Step-level model selection is a neglected high-leverage optimization for multi-agent deployments. |

## Related Hypotheses
- **H-006**: Delegation asymmetry
- **H-014**: Delegation quality gap
- **H-034**: Session fragility
- **H-041**: Decision topology
- **H-042**: Topology evolution
- **H-044**: Asymmetric default behavior

## Design Anti-Patterns
From our system's experience and research:
1. **Shared-everything memory**: Leads to conformity and information overload (DD#489)
2. **Flat topology at scale**: Sequential beats complex for most tasks (DD#481)
3. **Implicit delegation**: Quality degrades without explicit task contracts (H-006)
4. **Evaluation-free self-improvement**: Agents "improve" in ways that resist correction (H-055)

## Open Questions
1. What's the optimal delegation granularity for our system's task types?
2. How should session recovery work — replay vs. checkpoint vs. restart?
3. Can we automatically detect and surface effective patterns from agent trajectories?
4. What's the right balance between agent autonomy and structured workflows?

## Cross-References
→ [Multi-Agent Coordination](01-multi-agent-coordination.md) — patterns for coordination  
→ [Self-Evolution](03-self-evolution-learning.md) — patterns that enable learning  
→ [Tool Use & Workflows](07-tool-use-workflows.md) — tools as pattern building blocks  
