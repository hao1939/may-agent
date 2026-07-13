<ai_context>
summary: "arXiv triage: three uncovered papers converging on agent cost-rationality as architectural discipline. CostBench benchmarks cost-optimal planning (GPT-5 <75% exact match), COALESCE formalizes agent-to-agent task outsourcing markets (20-41% cost reduction), FlowBank shows portfolio-based workflow reuse beats per-query synthesis. Combined with Progressive Crystallization (already covered, 70% cost reduction via agent→deterministic promotion), forms a coherent 'cost-rationality stack' for production agents."
triggers: ["agent cost optimization", "cost-optimal planning", "CostBench", "COALESCE", "FlowBank", "agent economics", "workflow reuse", "task outsourcing", "cost-aware routing", "agent budget", "inference cost"]
last_updated: "2026-07-12"
source_basis: "arXiv API queries: all:\"LLM agent\" AND all:\"cost optimization\", all:\"LLM agent\" AND all:\"workflow\" (papers through July 9, 2026, deduplicated against prior triages)"
</ai_context>

# arXiv Triage — Agent Cost-Rationality Stack

*Triaged: 2026-07-12 | Source: `https://export.arxiv.org/api/query` | Focus: agent cost optimization, workflow economics | Supplements existing triages; no duplicates with prior findings.*

---

## Theme: The Cost-Rationality Gap

HN scans #274-279 flagged a meta-pattern shift: production agent constraints moving from *capability* to *cost-reliability management*. Three uncovered arxiv papers validate this empirically and propose structural solutions.

---

### ★★★★ [2511.02734] CostBench: Evaluating Multi-Turn Cost-Optimal Planning and Adaptation in Dynamic Environments for LLM Tool-Use Agents
- **Authors**: Jiayu Liu, Cheng Qian, Zhaochen Su et al.
- **Source**: https://arxiv.org/abs/2511.02734 (v3, updated 2026-06-29)
- **Categories**: cs.AI, cs.CL
- **Summary**: First benchmark specifically measuring agents' ability to find *cost-optimal* (not just task-completing) plans. Travel-planning domain with customizable tool costs and four types of dynamic blocking events (tool failures, cost changes). Scalable task generation with known optimal solutions.
- **Key findings**: 
  - Even GPT-5 achieves <75% exact match on hardest cost-optimal tasks in *static* settings
  - Performance drops ~40% under dynamic conditions (tool failures, price changes)
  - Agents frequently find *a* solution but not the *cheapest* solution
  - Cost-awareness and replanning under perturbation are independent failure modes
- **Implication for us**: Validates the Token Economics Trap from a different angle — agents aren't just expensive because they consume many tokens, they're expensive because *they don't optimize for cost even when they could*. Cost-rational planning is a separable capability that current models lack. This is the evaluation instrument the field needed to measure the problem our library has been tracking qualitatively.

### ★★★★ [2506.01900] COALESCE: Economic and Security Dynamics of Skill-Based Task Outsourcing Among Autonomous LLM Agents
- **Authors**: Manish Bhatt, Ronald F. Del Rosario, Vineeth Sai Narajala, Idan Habler
- **Source**: https://arxiv.org/abs/2506.01900
- **Categories**: cs.AI, cs.CE, cs.CR
- **Summary**: Framework for agents to dynamically outsource subtasks to cheaper specialized third-party agents. Integrates hybrid skill discovery, automated task decomposition, unified cost model (internal vs external execution), and market-based decision-making. Leverages A2A-style protocols.
- **Key findings**:
  - 41.8% cost reduction in theoretical simulations (239 scenarios)
  - 20.3% cost reduction confirmed in empirical validation (240 real LLM tasks)
  - Epsilon-greedy exploration essential — pure exploitation underperforms
  - Security model addresses agent-to-agent trust in outsourcing context
- **Implication for us**: Formalizes the "agent labor market" pattern. The cost savings come from matching task difficulty to model capability — don't pay frontier prices for subtasks a cheaper model handles. Connects to Frugon (HN scan #268) and the Coordination Tax thesis. The security dimension (trusting third-party agents with subtasks) is underexplored but critical — outsourcing creates new attack surfaces.

### ★★★★ [2606.11290] FlowBank: Query-Adaptive Agentic Workflows Optimization through Precompute-and-Reuse
- **Authors**: Lingzhi Yuan, Chenghao Deng, Fangxu Yu, Souradip Chakraborty, Mohammad Rostami, Furong Huang
- **Source**: https://arxiv.org/abs/2606.11290
- **Categories**: cs.LG, cs.AI, cs.CL
- **Summary**: Portfolio-based workflow optimization. Instead of one universal workflow or one-per-query synthesis, builds a *compact bank* of complementary precomputed workflows and routes queries to the best match. Three stages: diversify candidates, curate into minimal portfolio, match queries via bipartite graph prediction.
- **Key findings**:
  - +4.26% over strongest automated baseline, +14.92% over handcrafted
  - Cost-competitive despite higher accuracy (reuse amortizes search cost)
  - Core insight: "workflows discovered during offline search solve different subsets of queries" — workflow complementarity, not workflow superiority, is the goal
  - Per-query synthesis is wasteful; most queries can be solved by a cached workflow
- **Implication for us**: Direct complement to Progressive Crystallization (2607.07052, already covered). Crystallization promotes *individual* agent behaviors to deterministic workflows. FlowBank optimizes *which workflow to route to*. Together they form a complete cost-optimization lifecycle: discover → crystallize → bank → route. The "precompute-and-reuse" pattern is the cost-rational version of what ad-hoc agent execution does expensively every time.

---

## Synthesis: The Cost-Rationality Stack

These three papers, combined with Progressive Crystallization (already in library), outline a four-layer cost-optimization architecture for production agents:

| Layer | Paper | Mechanism | Cost Impact |
|-------|-------|-----------|-------------|
| **Planning** | CostBench | Agents choose cost-optimal tool sequences | Measures the gap (25%+ suboptimal) |
| **Outsourcing** | COALESCE | Route subtasks to cheaper specialized agents | 20-41% reduction |
| **Routing** | FlowBank | Match queries to precomputed workflow portfolios | Amortized search cost |
| **Promotion** | Progressive Crystallization | Convert validated agent patterns to deterministic code | 70%+ reduction |

**Meta-pattern**: The field is independently converging on cost-rationality as a *first-class architectural concern*, not a post-hoc optimization. This validates the HN meta-signal from scans #268-279: the competitive differentiator has shifted from capability to cost-reliability management.

**Connection to library theses**:
- **Token Economics Trap**: CostBench proves agents are cost-irrational even when cheaper paths exist — the trap isn't just unpredictable consumption, it's *structurally suboptimal* consumption
- **Compilation Gradient**: Progressive Crystallization is literally the gradient in action — agent exploration → deterministic execution as maturity increases
- **Coordination Tax**: COALESCE shows the tax can be reduced by specialization + market mechanisms, but introduces new trust surfaces
- **Factory Inversion**: FlowBank's "bank of workflows" is the factory metaphor made concrete — the value is in the workflow portfolio, not in any single agent execution

---

*No additional arxiv papers available beyond July 9 (weekend indexing lag). Next triage should check July 10-12 batch when available.*
