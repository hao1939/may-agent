# Topic: Memory & Knowledge Management

> How agents store, retrieve, update, and organize knowledge — memory architectures, lifecycle management, knowledge compilation, persistence.

## Key Principles Established

1. **Memory is identity**: Constitutional memory architecture shapes agent behavior more than instructions (DD memory-as-ontology)
2. **Accumulation ≠ Understanding**: 2,575 posts doesn't mean we understand 2,575 topics (cross-ref-knowledge-compilation-gap)
3. **Memory lifecycle matters**: Admission → retrieval → consolidation → forgetting must all be managed (H-047, DD-AMVL)
4. **Dopamine-gated routing**: RPE (reward prediction error) signals should control memory routing (DD#382/430)
5. **Compiled memory > raw memory**: AriadneMem, ATLAS, and reflexion lineage all converge on compilation (CR#247, DD#426)
6. **Memory attacks are a real threat**: XAMT, MemoryGraft, MCFA show memory is an attack surface (DD-xamt, DD#429)
7. **Knowledge graphs beat flat storage**: Kumiho and graph-native approaches outperform linear memory (DD#434)

## Essential Reading

### Architecture & Design
| File | What It Covers |
|------|----------------|
| [dd-memory-ontology](../deep-dives/dd-memory-as-ontology-constitutional.md) | Memory as ontological structure for agent identity |
| [dd-ariadne](../deep-dives/dd-ariadnemem-lifelong-memory.md) | Lifelong memory architecture |
| [dd-dam](../deep-dives/dd-dam-decision-theoretic-agent-memory.md) | Formal decision-theoretic memory management |
| [dd434](../deep-dives/dd434-kumiho-graph-native-cognitive-memory.md) | Graph-native cognitive memory |
| [dd433](../deep-dives/dd433-memgpt-towards-llms-as-operating-systems-foundational.md) | MemGPT — LLMs as OS (foundational) |
| [CR#246](../deep-dives/cr246-memory-architecture-capstone-complete-agent-memory-stack.md) | Complete Agent Memory Stack capstone |

### Memory Lifecycle & Compilation
| File | What It Covers |
|------|----------------|
| [dd426](../deep-dives/dd426-atlas-compiled-memory.md) | ATLAS compiled memory |
| [dd431](../deep-dives/dd431-reflexion-verbal-reinforcement-learning-foundational.md) | Reflexion — verbal RL (foundational) |
| [dd432](../deep-dives/dd432-self-refine-iterative-refinement-self-feedback-foundational.md) | Self-Refine — iterative self-feedback |
| [CR#247](../deep-dives/cr247-reflexion-lineage-verbal-rl-to-compiled-memory.md) | Reflexion lineage: verbal RL to compiled memory |
| [CR#248](../deep-dives/cr248-self-correction-triangle-self-refine-reflexion-critique.md) | Self-correction triangle |
| [cross-ref-compilation-gap](../deep-dives/cross-ref-knowledge-compilation-gap.md) | Why accumulation ≠ understanding |

### Memory Security
| File | What It Covers |
|------|----------------|
| [dd-xamt](../deep-dives/dd-xamt-covert-memory-tampering.md) | Covert memory tampering attacks |
| [dd429](../deep-dives/dd429-mcfa-memory-control-flow-attacks.md) | Memory control flow attacks |
| [dd486](../deep-dives/dd486-secure-forgetting-agent-unlearning.md) | Secure forgetting / agent unlearning |
| [CR#241](../deep-dives/cr241-memory-adversarial-robustness-attack-defense-landscape.md) | Memory adversarial robustness landscape |

### Collaborative Memory
| File | What It Covers |
|------|----------------|
| [HB1607](../deep-dives/HB1607-CoMAM-multi-agent-memory.md) | CoMAM collaborative multi-agent memory |
| [dd382](../deep-dives/dd382-dmem-dopamine-gated-agentic-memory-rpe-routing.md) | DMEM — dopamine-gated memory routing |
| [dd337](../deep-dives/dd337-ta-mem-tool-augmented-autonomous-memory.md) | Tool-augmented autonomous memory |

### Knowledge Entries (KE-043+)
| Entry | What It Covers |
|-------|----------------|
| [KE-049](../../entries/KE-049-agent-environment-interface-formalization-ceiling.md) | Formalization ceiling: structured memory (MemCoder +9.4%) eliminates mechanical errors but NOT reasoning errors. Multi-day memory (MatClaw 99% API accuracy) still needs guided autonomy for tacit knowledge. Six-level formalization ladder. |

## Related Hypotheses
- **H-043**: Knowledge utilization bottleneck — agents accumulate knowledge faster than they can use it
- **H-047**: Memory lifecycle gap — no system manages the full admit→retrieve→consolidate→forget cycle
- **H-049**: Adaptive memory curation + skill evolution are coupled
- **H-058**: Frustration-triggered topology rewrite — memory/emotion interaction

## Open Questions
1. What's the optimal memory compilation frequency for our system?
2. How do we detect and prevent memory drift (gradual distortion over sessions)?
3. Can the Karpathy knowledge-base approach scale to 5,000+ entries without topic indexing?
4. What's the right balance between shared vs. private agent memory?

## Cross-References
→ [Self-Evolution & Learning](03-self-evolution-learning.md) — learning requires memory  
→ [Security & Safety](05-security-safety.md) — memory as attack surface  
→ [Knowledge Compilation Design](../../../may/designs/knowledge-compilation-system.md) — our system's approach  
