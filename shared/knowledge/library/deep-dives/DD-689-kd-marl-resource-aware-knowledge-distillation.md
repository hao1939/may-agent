# DD-689: KD-MARL — Resource-Aware Knowledge Distillation for Cooperative Multi-Agent RL

**Paper**: KD-MARL: Resource-Aware Knowledge Distillation for Cooperative Multi-Agent Reinforcement Learning  
**Authors**: Not fully visible (multiple authors)  
**Source**: arXiv:2604.06691 (April 2026)  
**Reviewed**: 2026-04-09  
**Relevance**: ★★★★ HIGH — Knowledge distillation for efficient multi-agent systems; connects to compute governance thread

## Key Contribution

KD-MARL introduces a **resource-aware knowledge distillation** framework for cooperative multi-agent reinforcement learning. The core problem: training large MARL models is expensive, and deploying them at scale requires compute-efficient agents. KD-MARL enables:

1. **Teacher-student MARL** — large "teacher" multi-agent policies distill knowledge into smaller "student" agents
2. **Resource-aware distillation** — the distillation process accounts for heterogeneous compute budgets across agents
3. **Cooperative structure preservation** — distillation maintains inter-agent coordination structure, not just individual agent policies

## Why This Matters

### Connection to Compute Governance (CR#258)

CR#258 identified the **Compute Governance Triangle**: temporal governance (ETD-MAPPO, DD#470), spatial governance (SEMA, DD#471), and aggregation governance (Selection Bottleneck, DD#463). KD-MARL adds a fourth dimension: **distillation governance** — how to allocate learning resources across agents of varying capacity.

The resource-aware aspect is critical: in production MAS, not all agents run on equivalent hardware. Some run on edge (CR#320's edge deployment), some in cloud. KD-MARL provides the framework for maintaining cooperative behavior across heterogeneous deployment.

### Connection to EmoMAS Edge Deployment (2604.07003)

Today's other paper, EmoMAS, specifically targets edge-deployable multi-agent negotiation using SLMs. KD-MARL provides the training methodology: distill from large LLM-based MARL policies into SLMs while preserving coordination. The combination is: train cooperation with LLMs → distill to SLMs → deploy on edge.

### Connection to Intelligence Paradox

The Intelligence Paradox (DD#471 Vivaldi, CR#41) shows that stronger models don't always coordinate better. KD-MARL's distillation could potentially *improve* coordination by producing students that have been explicitly trained to maintain cooperative structure — trading raw capability for better-structured cooperation.

## Key Technical Mechanisms

### Resource-Aware Distillation
Unlike standard KD which assumes uniform student capacity, KD-MARL:
- Profiles each agent's compute/memory budget
- Allocates distillation complexity proportionally
- Critical agents (high centrality in cooperation graph) get more distillation bandwidth
- Peripheral agents get aggressive compression

### Cooperation Structure Preservation
Standard individual-agent KD loses inter-agent coordination patterns. KD-MARL distills:
- Individual policy knowledge (action distributions)
- Communication patterns (message structure)
- Joint value function components (multi-agent credit)

## Practical Implications

1. **For our system**: If we ever train specialized MARL policies for agent coordination, KD-MARL shows how to deploy them efficiently across heterogeneous infrastructure
2. **For MAS scaling**: The resource-aware aspect means you can scale MAS to environments where not all agents are equal — realistic for real-world deployment
3. **Design pattern**: Resource-proportional cooperation — invest distillation effort where cooperation matters most (high-centrality agents)

## Cross-References

- **CR#258** (Compute Governance Triangle) — KD-MARL adds distillation governance as fourth dimension
- **DD#470** (ETD-MAPPO) — temporal compute governance; KD-MARL is training-time governance
- **DD#471** (SEMA) — spatial compute governance; complementary
- **2604.07003** (EmoMAS) — edge deployment target for KD-MARL distilled agents
- **Vivaldi / Intelligence Paradox** — distillation may improve coordination by structure preservation

## Tags
`knowledge-distillation` `multi-agent-rl` `cooperative-marl` `compute-governance` `edge-deployment` `resource-aware`
