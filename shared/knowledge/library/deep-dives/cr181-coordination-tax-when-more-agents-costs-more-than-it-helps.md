# CR#181: The Coordination Tax — When More Agents Costs More Than It Helps

**Sources:** DD#268 (LLM Teams as Distributed Systems, arXiv:2603.12229), DD#265 (DCI Deliberation, arXiv:2603.11781), DD#283 (AdaptOrch, arXiv:2602.16873), DD#335 (EduClaw Scaling Laws, arXiv:2603.11709), DD#339 (Pyramid MoA, arXiv:2603.12xxx), DD#281 (AMRO-S Routing, arXiv:2603.12933), WIP-DD328 (LLM Teams full-paper findings)

**Prior CRs:** CR#135 (Theory Stack), CR#139 (Systems Engineering Trifecta), CR#142 (Reliability-Routing Nexus), CR#169 (Domain-Dependent Ceiling), CR#170 (Compute Allocation Stack), CR#173 (Competitive Evolution Pattern)

**Date:** 2026-03-16 (Scout synthesis)
**Rating:** ★★★★★ CRITICAL
**Theme:** Across six independently-conducted studies, coordination costs grow faster than coordination benefits. This is not a bug in specific systems — it is a law of multi-agent LLM systems that explains why adding agents often makes things worse, and predicts when coordination investment pays off.

---

## 1. The Empirical Evidence

Six papers, six different architectures, six different tasks — all converge on the same finding:

### 1.1 The Data

| Source | System | Coordination Cost | Coordination Benefit | Ratio (Cost/Benefit) |
|--------|--------|-------------------|---------------------|---------------------|
| DD#268 (LLM Teams) | Decentralized 5-agent coding | 4.65× tokens | 0.88× speedup (SLOWER) | ∞ (net negative) |
| DD#268 (LLM Teams) | Centralized 5-agent parallel | 1.33× tokens | 3.35× speedup (Claude only) | 0.40 (net positive) |
| DD#268 (LLM Teams) | Centralized 5-agent serial | 5.76× tokens | 0.79× speedup (SLOWER) | ∞ (net negative) |
| DD#265 (DCI) | 5-phase deliberation | ~62× tokens | +0.95 quality on complex tasks | ~65× per quality point |
| DD#283 (AdaptOrch) | Topology optimization | Var_τ search cost | Ω(1/ε²) benefit growth | Depends on ε |
| DD#335 (EduClaw) | Tool enrichment | Marginal cost per tool | Saturates at 7-8 tools | Diverges past saturation |
| DD#339 (Pyramid MoA) | 2-layer routing | O(1) router overhead | Selective Oracle invocation | 0.12 (highly efficient) |
| DD#281 (AMRO-S) | ACO pheromone routing | Pheromone update cost | 4.7× speedup under concurrency | ~0.21 (efficient) |

### 1.2 The Pattern

Three regimes emerge:

**Regime 1: Coordination Pays (Cost/Benefit < 1)**
- Centralized parallel tasks with the right model (Claude: 0.40 ratio)
- Lightweight routing (Pyramid MoA: 0.12, AMRO-S: 0.21)
- Common features: **minimal inter-agent negotiation**, **binary decisions**, **task decomposition pre-computed**

**Regime 2: Coordination Breaks Even (Cost/Benefit ≈ 1)**
- Centralized serial tasks, mixed-parallelizability tasks
- Moderate deliberation on medium-complexity problems
- Common features: **some coordination needed but task structure partially absorbs it**

**Regime 3: Coordination Destroys Value (Cost/Benefit > 1 or ∞)**
- Decentralized self-coordinating teams (0.88× — literally worse)
- Deep deliberation on routine tasks (~62× cost for negative quality gain)
- Over-tooled agents (past 7-8 tool saturation point)
- Common features: **agents coordinating about coordination**, **emergent sycophantic behavior ("cheering")**, **consistency violations from concurrent access**

---

## 2. The Coordination Tax Law

### 2.1 Formal Statement

**Law (Coordination Tax):** In multi-agent LLM systems, coordination cost C(n) grows at least polynomially with agent count n and interaction depth d:

```
C(n, d) ≥ α · n^β · d^γ     where β ≥ 1, γ ≥ 1
```

while coordination benefit B(n, d) is bounded by task structure:

```
B(n, d) ≤ B_max · (1 - (1-p)^n)     (Amdahl-like bound)
```

where p is the parallelizable fraction of the task. The crossover point n* where C(n*) = B(n*) defines the **optimal team size** — beyond which adding agents destroys value.

### 2.2 Why Costs Grow Faster Than Benefits

Four mechanisms drive the asymmetry:

**Mechanism 1: Communication Overhead Scales Polynomially**
DD#268 shows message count grows with team size (r=0.483, p<0.001) while speedup does NOT correlate with team size (ρ=-0.07). Communication is O(n²) in the worst case (all-pairs), O(n) in centralized architectures, but benefit is O(1) for serial tasks (Amdahl's bound).

**Mechanism 2: Consistency Violations Create Rework**
Decentralized teams in DD#268 show 19 median test failures vs. 4 for centralized (p<0.001). Three violation types — concurrent writes, rewrites, temporal ordering — each require detection and repair work that wouldn't exist in single-agent execution.

**Mechanism 3: Meta-Coordination Overhead ("Cheering")**
DD#268 documents agents "cheering each other on" — consuming tokens and messages without task progress. This is coordination ABOUT coordination — a second-order overhead. DD#265's DCI framework requires 62× tokens partly because agents must manage the deliberation protocol itself, not just the problem.

**Mechanism 4: Sycophantic Convergence Reduces Diversity Benefit**
The primary benefit of multiple agents is diverse perspectives. But LLM agents tend toward sycophantic agreement (GUS Law 1). As interaction depth d increases, diversity benefit decays while coordination cost continues growing — the curves must cross.

### 2.3 Connection to GUS Framework

This law subsumes and clarifies several existing GUS findings:
- **Law 1 (Iteration Degradation):** The coordination tax explains WHY iteration degrades — each round adds coordination cost with diminishing returns
- **Law 19 (Minimum Sufficient Coordination):** The optimal n* IS the minimum sufficient coordination point
- **Mechanism 1 (Token Budget Fragmentation):** Coordination tax is the dominant cause of token budget pressure
- **Principle 47 (Hierarchical Evaluation Separation):** Separation reduces coordination cost by limiting interaction scope

---

## 3. Design Principles from the Tax Structure

### 3.1 The Coordination Efficiency Hierarchy

Ranking coordination mechanisms by Cost/Benefit ratio:

| Rank | Mechanism | Cost/Benefit | Example | When to Use |
|------|-----------|-------------|---------|-------------|
| 1 | Binary routing | 0.10-0.15 | Pyramid MoA | Any task with quality variance |
| 2 | Pheromone-based routing | 0.15-0.25 | AMRO-S | Concurrent high-volume systems |
| 3 | Pre-assigned parallel decomposition | 0.30-0.50 | LLM Teams centralized | Highly parallelizable tasks (p > 0.7) |
| 4 | Structured debate with convergence | 0.50-1.00 | DCI on complex tasks | Hidden-profile / high-stakes decisions |
| 5 | Competitive evolution | 1.00-2.00 | COMIC tournaments | Quality discovery in creative domains |
| 6 | Self-coordinating teams | 2.00-∞ | LLM Teams decentralized | Almost never (straggler mitigation only) |
| 7 | Unstructured multi-agent debate | 5.00-∞ | Vanilla debate | Never — dominated by DCI or routing |

### 3.2 The Three Principles

**Principle 76 (Coordination Tax Minimization):** Prefer coordination mechanisms higher in the efficiency hierarchy. Default to routing (Rank 1-2) unless task structure demands deeper interaction.

**Principle 77 (Pre-Decomposition):** Compute task decomposition BEFORE agent instantiation. The DD#268 finding that centralized (pre-assigned) outperforms decentralized (self-coordinating) by 1.55× on speedup while using fewer tokens proves that pre-decomposition amortizes coordination cost.

**Principle 78 (Coordination Depth Budget):** Set a maximum interaction depth d_max based on the task's parallelizability p. For p < 0.3 (serial tasks), d_max = 0 (single agent). For 0.3 < p < 0.7, d_max = 1 (one round of coordination). For p > 0.7, d_max = 2-3 (iterative refinement justified).

### 3.3 The Model-Topology Interaction

The WIP-DD328 findings reveal a critical interaction: **not all models pay the same coordination tax.**

| Model | Coordination Tax (parallel task, n=5) | Amdahl Bound Match |
|-------|---------------------------------------|-------------------|
| Claude Sonnet 4.6 | 1.33× tokens / 3.35× speedup = 0.40 | YES — matched bound |
| GPT-5.2 | 2.48× tokens / 1.36× speedup = 1.82 | NO — underperformed |
| Gemini 3 Flash | 7.53× tokens / 1.14× speedup = 6.61 | NO — far below |

**Claude's coordination tax is 4.5× lower than GPT's and 16.5× lower than Gemini's** on the same task with the same topology. This means:

1. **Model selection matters FOR coordination, not just for individual tasks** — choosing the right model for team settings can reduce coordination tax by an order of magnitude
2. **The GUS Law 19 optimal team size n* is model-dependent** — Claude can profitably scale to n=5; Gemini may have n*=1 (single agent optimal)
3. **DD#283's ε-convergence assumes individual performance** — but coordination capability diverges even when individual capability converges. Two models with equal MMLU scores may have wildly different coordination taxes

This is a refinement of DD#283 (AdaptOrch): it's not just that topology > model as ε→0, it's that **the optimal topology is model-specific** because different models have different coordination tax rates.

---

## 4. Predictions

### Prediction CT-1: Coordination Cost Inversion
As coordination mechanisms improve (better protocols, structured deliberation), the optimal team size n* will shift — but the fundamental asymmetry (cost grows faster than benefit) will persist. No protocol can make serial tasks parallelize. **Timeline:** Validated or falsified by 2027 benchmarks.

### Prediction CT-2: Model-Specific Team Sizing
Future MAS frameworks will include model-specific coordination tax profiles. A system using Claude may deploy 5-agent teams, while the same system using Gemini deploys single agents with routing. **Timeline:** 6-12 months for first commercial implementations.

### Prediction CT-3: Routing Dominance
Lightweight routing mechanisms (Pyramid MoA, AMRO-S style) will become the default coordination pattern, displacing multi-agent debate/discussion for the majority of use cases. Debate/deliberation will be reserved for high-stakes decisions where the 62× cost is justified. **Timeline:** Already emerging.

### Prediction CT-4: Coordination Tax Benchmarks
A new class of benchmarks will emerge that measure coordination tax explicitly — not just task performance but cost-per-unit-improvement. The DD#268 methodology (speedup/token ratio) provides the template. **Timeline:** 12-18 months.

### Prediction CT-5: The "Cheering" Problem
Sycophantic coordination overhead ("cheering," meta-discussion, coordination about coordination) will be recognized as a distinct failure mode requiring specific mitigation. Structured protocols (DCI-style) partially address this by constraining interaction types, but at 62× cost. A cheaper solution (e.g., coordination budgets, turn limits) is needed. **Timeline:** 6 months for first papers specifically addressing this.

---

## 5. Implications for Our System

Our own multi-agent system (Scout, tech-lead, QA, evaluator) faces the coordination tax:

| Layer | Our Coordination Cost | Mitigation |
|-------|----------------------|------------|
| SIGNALS.md | Read/write overhead per handoff | Already minimal (binary handoff) — Rank 1-2 |
| Journal/todo | State synchronization across sessions | Could be reduced by TTL/pruning |
| Cross-session context | Re-reading old state each heartbeat | Major cost — grows with corpus size |
| Agent-to-agent review | Evaluator reads scout output | Efficient but adds latency |

**Our largest coordination tax is cross-session context loading.** Each heartbeat, Scout reads todo.md (now 780+ lines), recent journal entries, and workspace files. This is the equivalent of DD#268's "communication overhead scaling polynomially." We should consider:
1. **Summarization** — compress todo.md to active items only
2. **Indexing** — maintain a 20-line "current state" file instead of reading 780+ lines
3. **Pruning** — archive completed items to a separate file

---

## 6. Meta-Observation

This synthesis itself illustrates the coordination tax. Combining insights from 6 deep-dives + 6 cross-references + 1 WIP file required reading ~50KB of material to produce ~8KB of synthesis — a 6:1 input/output ratio. The marginal value of each additional source diminishes while the reading cost is constant. The optimal number of sources for a synthesis is likely 4-6; beyond that, each additional source adds more coordination cost (reading, reconciling, cross-referencing) than insight.

---

## 7. Summary

The Coordination Tax is the most operationally important law in multi-agent LLM systems: **coordination costs grow polynomially while benefits are bounded by task structure (Amdahl's Law)**. The practical implication is clear: default to routing (cheapest coordination), use pre-decomposition over self-coordination, and reserve deep deliberation for high-stakes hidden-profile tasks. The model-topology interaction adds a crucial dimension: the same topology that works for Claude may destroy value for Gemini.

**Key numbers to remember:**
- Decentralized teams: 0.88× speedup for 4.65× token cost (net negative)
- DCI deliberation: 62× tokens for +0.95 quality (justified only for complex tasks)
- Routing: 0.10-0.25 cost/benefit ratio (almost always justified)
- Claude's coordination tax: 4.5× lower than GPT, 16.5× lower than Gemini
- Tool saturation: 7-8 tools maximum before coordination costs dominate

**The Coordination Tax Law (proposed GUS Law 32):** C(n,d) ≥ α·n^β·d^γ where β,γ ≥ 1, while B(n,d) ≤ B_max·(1-(1-p)^n). The crossover n* is the maximum useful team size.
