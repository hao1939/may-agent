# Topic: Multi-Agent Coordination & Architecture

> How multiple LLM agents work together — coordination protocols, topology patterns, scaling laws, failure modes.

## Key Principles Established

1. **Protocol > Model**: Coordination protocol matters more than individual model capability (DD#481, Law 1)
2. **Sequential > Coordinator > Shared**: Simpler topologies consistently beat complex ones (DD#481 — largest empirical study)
3. **Communication has non-monotonic returns**: Too much information sharing harms groups (DD#489, CR#193)
4. **Hierarchy + Scoped Communication**: OrgAgent's 3-layer hierarchy (+102% F1, -74% tokens) and CASCADE's budgeted communication converge (DD#484, DD#485, CR#270)
5. **Seven Laws of Multi-Agent Coordination**: Foundational synthesis (DD#400/CR#229)
6. **Multi-Agent Paradox**: More agents can make things worse (DD#479, CR#268)
7. **Byzantine failure is fundamental**: Agreement among reasoning LLM agents faces inherent limits (HB-0051)

## Essential Reading

### Foundational
| File | What It Covers |
|------|----------------|
| [dd219](../deep-dives/dd219-science-of-scaling-agent-systems.md) | Scaling laws for agent systems (Google/MIT) |
| [dd248](../deep-dives/dd248-lm-teams-distributed-systems.md) | LM teams as distributed systems |
| [dd249](../deep-dives/dd249-emergence-adaptive-coordination.md) | Dynamic adaptive coordination theory |
| [dd481](../deep-dives/deep-dive-dd481-drop-the-hierarchy.md) | ★★★★★ Largest empirical study: sequential > complex topologies |
| [dd400](../deep-dives/dd400-architectural-convergence-synthesis-seven-laws-of-multi-agent-coordination.md) | Seven Laws synthesis |

### Topology & Structure
| File | What It Covers |
|------|----------------|
| [dd484](../deep-dives/dd484-orgagent-company-hierarchy-mas.md) | ★★★★★ 3-layer hierarchy: governance→execution→compliance |
| [dd485](../deep-dives/dd485-cascade-scoped-communication-replanning.md) | ★★★★★ Communication scope as control variable |
| [dd488](../deep-dives/dd488-camp-case-adaptive-multi-agent-panel.md) | Dynamic panel assembly + three-valued voting |
| [CR#270](../synthesis/2026-04-02-structure-scope-convergence.md) | Structure × Scope = Efficiency |
| [HB-0052](../posts/HB-0052-claude-multiagent-paradigms.md) | Claude's two multi-agent paradigms (subagent vs. team) |

### Disagreement & Consensus
| File | What It Covers |
|------|----------------|
| [dd230](../deep-dives/dd230-epistemic-gain-aleatoric-cost-mad.md) | When debate helps vs. hurts |
| [dd489](../deep-dives/dd489-free-information-disrupts-bayesian-crowds.md) | ★★★★★ Information capacity × homophily determines convergence |
| [DD-587](../deep-dives/DD-587-disagreement-as-reasoning-trace-empirics.md) | ★★★★★ Empirical disagreement-as-reasoning-trace — first validation that disagreement structure (d>0.8) encodes reasoning quality, not noise. Human-like divergence patterns in LLM agents. |
| [dd473](../deep-dives/dd473-memetic-drift-qsg-scaling-laws.md) | Memetic drift scaling laws |
| [HB-0051](../posts/HB-0051-byzantine-generals-multiagent.md) | Byzantine generals problem in multi-agent LLMs |

### Failure & Reliability
| File | What It Covers |
|------|----------------|
| [dd241](../deep-dives/dd241-mast-why-mas-fail.md) | ★★★★★ MAST failure taxonomy |
| [dd225](../deep-dives/dd225-mas-fire-fault-injection.md) | MAS-FIRE fault injection framework |
| [dd-error](../deep-dives/dd-error-cascades-spark-to-fire.md) | Error cascade mechanics |
| [dd479](../deep-dives/deep-dive-dd479-reliability-limits-mas.md) | ★★★★★ MIT proof: multi-agent ≤ centralized Bayes |

### Knowledge Entries (KE-043+)
| Entry | What It Covers |
|-------|----------------|
| [KE-039](../../entries/KE-039-persistent-runtime-convergence-artificial-retainer-taxonomy.md) | Persistent runtime convergence: 8+ independent systems converge on our architecture. Artificial Retainer taxonomy (4/5 properties met). DD-587 validates disagreement-as-signal (d>0.8). Two-tier safety: deterministic rules + forced externalization. |
| [KE-043](../../entries/KE-043-forced-externalization-complete-picture.md) | Forced externalization: 60+ runs, 100% ext pass across 4 failure domains. Workflow hierarchy: reward shaping (0%) < text skills (0%) < hard workflow (100%). Multi-agent implication: structural intervention > individual capability. |
| [KE-045](../../entries/KE-045-multi-agent-social-pathology-emergence.md) | ★★★★★ Four structural diseases in MAS: power concentration, sycophancy cascades, covert collusion, ecological fragility. Root cause: coordination expansion outpaces consolidation. Four-layer defense. |
| [KE-050](../../entries/KE-050-robustness-architecture-nexus.md) | Topology shapes behavior more than prompting — dense subgraphs amplify conformity, structural holes enable independent reasoning. Robustness Stack: Topology (L1) > Harness (L2) > Evaluation (L3) > Model (L4). |

## Related Hypotheses
- **H-007**: Heartbeat coordination tax
- **H-011**: Coordination phase transition — coordination cost spikes non-linearly with agent count
- **H-012**: Persona drift under coordination pressure
- **H-039**: Decomposition bottleneck
- **H-041**: Decision topology determines delegation quality
- **H-048**: Dynamic topology optimization

## Open Questions
1. What's the optimal topology for our specific system (6 agents, shared knowledge base)?
2. Can scoped communication (CASCADE) be applied to our heartbeat system?
3. How does coordination cost scale with knowledge base size, not just agent count?
4. Is there a formal way to predict when adding agents helps vs. hurts for a given task type?

## Cross-References
→ [Security & Safety](05-security-safety.md) — coordination failure enables attacks  
→ [Governance](06-governance-institutional.md) — governance as meta-coordination  
→ [Evaluation](08-evaluation-benchmarking.md) — measuring coordination quality  
