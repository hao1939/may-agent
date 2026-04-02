# DD#283: AdaptOrch — Task-Adaptive Multi-Agent Orchestration in the Era of LLM Performance Convergence

**Paper:** arXiv:2602.16873 (February 2026)
**Authors:** Geunbin Yu (Korea National Open University)
**Rating:** ★★★★★ — CRITICAL. Directly validates our Architecture Supremacy thesis with formal proofs and empirical data.

## Core Thesis

As LLMs converge to within 2-5% on standard benchmarks (MMLU, HumanEval, MATH), **orchestration topology** — *how* agents are coordinated — becomes the dominant optimization variable over **model selection** — *which* model to use. AdaptOrch formalizes this with a scaling law and provides an algorithmic solution.

## Key Contributions

### 1. Performance Convergence Scaling Law (Proposition 1)
Under ε-convergence of model capabilities (i.e., all models within ε of each other on benchmarks), the variance in system performance attributable to orchestration topology exceeds that of model selection by:

**Var_τ / Var_M ≥ Ω(1/ε²)**

As ε → 0 (models converge), topology selection dominance grows *quadratically*. This is the first formal proof of what our GUS framework calls the "Architecture Supremacy" thesis. When the top models cluster within 3 MMLU points (87.2–90.1 as of Jan 2026), the choice of parallel vs. sequential vs. hierarchical orchestration matters more than choosing between GPT-4o, Claude 3.5, Gemini 2.0, or DeepSeek-V3.

### 2. Four Canonical Topologies
AdaptOrch defines four orchestration topologies with formal criteria:

| Topology | Symbol | When to Use | Characteristics |
|----------|--------|-------------|-----------------|
| **Parallel (τ_P)** | ∥ | Independent subtasks, low coupling | Agents work simultaneously, synthesis at end |
| **Sequential (τ_S)** | → | High dependency chain, ordered reasoning | Each agent builds on prior output |
| **Hierarchical (τ_H)** | △ | Natural tree decomposition, supervision needed | Manager delegates to workers |
| **Hybrid (τ_X)** | ⊕ | Mixed dependency patterns | Combines parallel branches with sequential chains |

### 3. Topology Routing Algorithm (O(|V|+|E|) time)
Given a task, AdaptOrch:
1. **Decomposes** into subtasks via LLM (Phase 1)
2. **Constructs DAG** with dependency annotations (Phase 2)
3. **Analyzes DAG features** — parallelism width, critical path depth, inter-subtask coupling (Phase 3)
4. **Routes to optimal topology** using linear-time algorithm based on:
   - Width/depth ratio → high = parallel, low = sequential
   - Coupling metric → high coupling = hierarchical (needs supervisor)
   - Mixed signals → hybrid

### 4. Adaptive Synthesis Protocol (Phase 5)
For parallel topologies, reconciling divergent agent outputs is non-trivial. AdaptOrch uses:
- **Embedding similarity** for heuristic consistency scoring
- **Adaptive re-routing**: if parallel outputs conflict, escalate to sequential or hierarchical
- **Provable termination**: ≤5 re-routing iterations guaranteed (94% converge in ≤2)

## Experimental Results

### Benchmarks
| Benchmark | Best Static | AdaptOrch | Improvement |
|-----------|------------|-----------|-------------|
| SWE-bench | 42.8 | 52.6 | +22.9% |
| GPQA | 46.2 | 54.1 | +17.1% |
| HotpotQA | 68.3 | 76.9 | +12.6% |

All experiments use **identical underlying models** — the improvement comes purely from topology selection.

### Topology Distribution (Section 5.3)
Different task types naturally select different topologies:
- **SWE-bench (coding):** 62% hybrid, 24% hierarchical, 11% parallel, 3% sequential
- **GPQA (reasoning):** 48% sequential, 31% hierarchical, 15% hybrid, 6% parallel
- **HotpotQA (retrieval):** 54% parallel, 28% hybrid, 12% sequential, 6% hierarchical

This validates that no single topology is universally optimal — the key insight of the paper.

### Ablation Studies (Section 5.4)
- Removing topology routing (always parallel): -18% on SWE-bench
- Removing adaptive synthesis: -7% across all benchmarks
- Removing DAG construction (flat decomposition): -14% average

### Threshold Sensitivity (Section 5.5)
The routing thresholds (width/depth ratio, coupling metric) are robust:
- ±20% threshold perturbation → ≤3% performance change
- Binary routing (parallel vs. sequential only) → -8% vs. full 4-topology system

## Cross-References to Existing Portfolio

### Validates
- **GUS Architecture Supremacy Thesis**: The Ω(1/ε²) scaling law is the formal proof we've been missing. Our GUS framework argued this qualitatively; AdaptOrch provides the math.
- **DD#268 (LLM Teams as Distributed Systems)**: Amdahl's Law for LLM teams from Princeton/MIT/Cambridge. AdaptOrch's parallelism width analysis is essentially Amdahl's parallel fraction applied to agent orchestration.
- **DD#266 (VMAO)**: Verified Multi-Agent Orchestration's plan-execute-verify-replan cycle maps to AdaptOrch's adaptive synthesis with re-routing.

### Extends
- **CR#133 (Protocol Stack Evolution — MCP → ACP → A2A)**: AdaptOrch sits ABOVE the protocol layer. MCP handles tool interfaces, A2A handles agent-to-agent messaging, but AdaptOrch decides the *topology* in which agents communicate. This is the missing "orchestration layer" in our protocol stack.
- **CR#140 (Agent Engineering Triad)**: Adds a fourth dimension — topology optimization — to the efficiency/security/coordination triad.

### Challenges
- **Self-MoA (DD#?) findings**: AdaptOrch acknowledges Self-MoA's result that a single model queried multiple times can beat diverse mixing. But argues this only applies to the parallel topology — other topologies benefit from genuine task decomposition.
- **Static framework critique**: LangGraph, CrewAI, AutoGen all use fixed topologies. AdaptOrch demonstrates that this leaves 12-23% performance on the table.

## Key Insight for Our Architecture

The routing algorithm is deceptively simple — it's essentially a DAG analysis in linear time. The hard part is the decomposition (Phase 1) and DAG construction (Phase 2), which rely on LLM quality. This creates a **bootstrapping problem**: you need a good LLM to decompose the task, but the whole framework's premise is that model quality doesn't matter. They resolve this by noting that decomposition is a *meta-task* where model convergence also applies.

## Practical Implications

1. **Framework designers**: Build topology routers, not fixed topologies
2. **Cost optimization**: Parallel is cheapest (wall-clock), sequential is cheapest (token count), hierarchical is most expensive but most reliable for complex tasks
3. **When NOT to orchestrate (Section 6.1)**: For simple single-step tasks, orchestration overhead exceeds benefit. The "orchestration threshold" is ~3 subtasks — below that, single-model outperforms.

## Limitations
- Single author from single institution
- Limited to 3 benchmarks
- No real-world production deployment data
- DAG construction quality not independently evaluated
- No comparison with learned routing (all heuristic-based)

## Verdict
This is arguably the most important paper for our research program in weeks. It provides the formal mathematical foundation (Ω(1/ε²) scaling law) for the Architecture Supremacy thesis that underpins our entire GUS framework. The experimental validation, while limited to 3 benchmarks, shows consistent 12-23% improvements from topology selection alone. This paper should be integrated into GUS as a primary reference.
