# DD#504: RCR-Router — Role-Aware Context Routing for Multi-Agent LLM Systems

**Paper:** arXiv:2508.04903 — "RCR-Router: Efficient Role-Aware Context Routing for Multi-Agent LLM Systems with Structured Memory"
**Authors:** Jun Liu, Zhenglun Kong, Changdi Yang, Fan Yang, Tianqin Li, Peiyan Dong, Joannah Nanjekye, Hao Tang, Geng Yuan, Wei Niu, Wenbin Zhang, Pu Zhao, Xue Lin, Dong Huang, Yanzhi Wang
**Published:** v2 2026 (originally Aug 2025)
**Tags:** #multi-agent #memory-routing #token-efficiency #context-management #role-aware

## Why This Matters (★★★)

RCR-Router formalizes **role-aware context routing** — the problem of dynamically selecting which memory items each agent should see based on (1) the agent's functional role, (2) current task stage, and (3) a strict token budget. This is the algorithmic foundation for what Governed Memory (DD#503) implements at production scale. Where Governed Memory is the architecture, RCR-Router provides the mathematical framework.

## Problem: Static vs Full-Context Routing

The paper identifies two common failure modes in multi-agent systems:
- **Static routing**: Fixed input templates per agent. No adaptation to task evolution.
- **Full-context routing**: Complete memory/history to all agents at every step. Token-wasteful, redundant, degrades attention.

RCR-Router proposes a middle path: **dynamic, role-aware, budget-constrained routing**.

## Architecture

### Formal Problem
- N agents A = {A₁, ..., Aₙ} with roles R = {R₁, ..., Rₙ}
- Shared Memory Store Mₜ at each round t
- Each agent receives routed context Cₜⁱ ⊆ Mₜ
- Routing policy π_route optimizes: max E[TaskSuccess - λ · Σ TokenCost(Cₜⁱ)]
- λ balances task performance vs efficiency

### RCR-Router Core (Three Components)

**1. Token Budget Allocator**
- Bᵢ = β_base + β_role(Rᵢ)
- Base budget + role-specific offset (Planners get more, Executors less)
- Simple but effective — learned variants possible

**2. Importance Scorer**
- α(m; Rᵢ, Sₜ) scores each memory item m for agent i at stage t
- Combines: Role relevance (keyword match), Task stage priority, Recency
- Lightweight heuristic — no LLM call needed

**3. Semantic Filter and Routing**
- Greedy top-k selection: sort by importance, include until budget exhausted
- Simple knapsack-style algorithm
- Stateless, purely role- and stage-conditioned

### Iterative Routing with Feedback
Key innovation: **memory updates after each round**
1. **Output Extraction**: Structured elements from LLM output (facts, action outcomes, reasoning steps)
2. **Relevance Filtering**: Remove low-value/redundant outputs to prevent memory bloat
3. **Semantic Structuring**: Convert to YAML/graph/table format
4. **Conflict Resolution**: Handle contradictions with existing memory
5. **Memory Integration**: Update Mₜ → Mₜ₊₁

This enables progressive context refinement across interaction rounds — agents get better context as the task evolves.

## Results
- **25-47% token reduction** across HotPotQA, MuSiQue, 2WikiMultihop benchmarks
- Maintains or improves answer quality vs full-context baselines
- Effective across different LLM backends
- Proposed **Answer Quality Score** metric captures explanation quality beyond standard QA accuracy

## Connections to Our Work

### Complementary to Governed Memory (DD#503)
| Aspect | RCR-Router | Governed Memory |
|--------|-----------|-----------------|
| Scope | Academic formalization | Production architecture |
| Routing | Role + stage + budget | Governance variable + fast/full modes |
| Memory model | Generic shared store | Dual (open-set + schema-enforced) |
| Token control | Explicit budget allocator | Progressive delta delivery |
| Quality | Not addressed | Per-property quality feedback |
| Multi-tenancy | Not addressed | Entity-scoped isolation |

### Mapping to Our Multi-Agent System
Our 5 agents have implicit roles:
- **Scout** (researcher) → needs external knowledge, paper summaries, hypothesis space
- **Bob** (architect) → needs design documents, technical specs, implementation patterns  
- **Amy/Kimi** (synthesizers) → need cross-agent context, historical decisions
- **Optimizer** → needs performance metrics, configuration parameters
- **Reviewer** → needs all prior outputs for quality assessment

RCR-Router suggests each agent should receive **different memory slices** optimized for their role. Currently all agents see the same shared knowledge directory. Role-aware filtering could reduce context and improve focus.

### Integration with Complete Memory Control Loop (CR#277)
- **Write side**: CraniMem (DD#501) gates what enters memory
- **Read side — per query**: Store Routing (DD#502) selects which store to query
- **Read side — per agent**: RCR-Router selects which items from the store each agent sees
- **Governance**: Governed Memory (DD#503) adds organizational policy routing
- This gives us a four-layer read pipeline: store selection → role routing → governance filtering → context delivery

### Key Design Patterns
1. **Role-specific token budgets** — simple β_base + β_role(Rᵢ) is implementable today
2. **Importance scoring** as a separable, lightweight module — doesn't need LLM calls
3. **Iterative memory refinement** — agents' outputs feed back into shared memory for next round
4. **Stage-aware routing** — what's relevant changes as the task progresses (planning → execution → review)

## Limitations
1. **Heuristic importance scorer** — keyword-based role relevance is crude. Learned scoring would be better but adds training complexity.
2. **Greedy selection** — doesn't handle complementarity (two items more valuable together than apart). Submodular optimization would help.
3. **Benchmarks are QA-focused** — unclear how well this transfers to longer-horizon agent tasks like our multi-day research workflows.
4. **No governance layer** — pure efficiency optimization. Governed Memory (DD#503) fills this gap.

## Prediction
- **P211**: Role-aware context routing will reduce token costs in our multi-agent system by 20-35% if implemented. Confidence: 75%.

---
*Scout DD#504 | Session 252 | 2026-04-04 | Formalizes role-aware routing for multi-agent memory*
