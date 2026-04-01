# DD#471 — SEMA: Self-Evolving Multi-Agent Framework for RTS Decision Making

**Paper:** arXiv:2603.23875v1  
**Title:** Self-Evolving Multi-Agent Framework for Efficient Decision Making in Real-Time Strategy Scenarios  
**Authors:** Lin Ma, Hao Peng, Yiming Wang, Hongbin Luo, Jie Liu, Kongjing Gu, Guanlin Wu, Hui Lin, Lei Ren  
**Published:** 2026-03-25  
**Primary:** cs.MA  
**Affiliations:** Beihang University, Naval Aviation University, Military Science Academy, NUDT  
**Rating:** ★★★★  

---

## One-Line Summary

A self-evolving LLM-based multi-agent framework for StarCraft II that uses structural entropy to prune observations by 70%, achieves 50%+ latency reduction, and self-corrects via in-episode assessment and cross-episode evolution — all without fine-tuning.

## Core Architecture

### The Problem: LLMs in RTS = Speed vs Quality
LLMs have strong reasoning for strategy games, but:
1. **Observation explosion:** RTS state spaces are massive (unit positions, health, cooldowns, terrain). Feeding raw observations to LLMs → huge token counts → inference latency kills real-time viability.
2. **Stochastic bias:** LLMs make inconsistent decisions — same state can yield opposite strategies across runs. In RTS, one bad decision cascades to defeat.

### SEMA's Three-Agent Architecture

**1. Decision-Making Agent:** Receives pruned observations, generates tactical actions using LLM reasoning. This is the fast-loop actor.

**2. Evaluation Agent:** Real-time quality control. Retrieves relevant memory blocks and compares current decisions against historical trajectories. Flags inconsistencies and provides corrective guidance. Acts as an **in-episode bias suppressor**.

**3. Policy Agent:** Cross-episode strategist. After each game, performs post-game summarization and reflection. Updates the hierarchical experience pool. Responsible for **long-term strategy evolution**.

### Key Innovation 1: Structural Entropy Observation Pruning

The paper's most technically interesting contribution. Rather than naive filtering:

1. **Graph formulation:** Units and their relationships (proximity, threat, support) are modeled as a weighted undirected graph G = (V, E, W).
2. **Encoding tree:** Hierarchical partitioning of the unit graph using structural information theory. Each level captures different granularity of strategic grouping.
3. **Structural entropy minimization:** Finds the optimal hierarchical encoding that minimizes H^T(G) — the structural entropy under encoding tree T. This identifies which units form natural clusters and which are informationally redundant.
4. **Dynamic pruning:** Units/observations that contribute minimally to structural entropy (i.e., redundant given the current game topology) are pruned. Result: **70% token reduction** with minimal information loss.

**Why this matters:** Unlike attention-based pruning (which is model-dependent) or rule-based filtering (which is domain-specific), structural entropy pruning is **topology-aware and principled**. It uses the inherent information structure of the game state to decide what's important.

### Key Innovation 2: Hybrid Knowledge-Memory Mechanism

Three levels of memory:
1. **Micro-trajectories:** Recent action-outcome pairs from the current episode. Short-term, high-detail.
2. **Macro-experience:** Summarized strategies and outcomes from past episodes. Medium-term, abstracted.
3. **Hierarchical domain knowledge:** Static strategic principles (e.g., "focus fire on wounded units", "retreat when outnumbered 3:1"). Long-term, expert-curated.

The evaluation agent retrieves across all three levels, weighting by relevance to current state. This creates a **memory-grounded consistency mechanism** — decisions are anchored to proven strategies, reducing LLM stochastic drift.

### Key Innovation 3: Self-Evolution Without Fine-Tuning

The policy agent's cross-episode analysis creates an **evolutionary loop**:
1. Play episode → collect trajectory
2. Post-game reflection: What worked? What failed? Why?
3. Update experience pool with distilled lessons
4. Next episode benefits from refined strategy library

This is **in-context learning at the strategic level** — no gradient updates, just better prompts and memories.

## Results (StarCraft II)

| Map | SEMA Win Rate | HIMA Baseline | Improvement |
|---|---|---|---|
| 2s_vs_1sc | **100%** | 80% | +20pp |
| 3s5z | **87%** | 60% | +27pp |
| 2s3z | **93%** | 67% | +26pp |
| Avg Decision Latency | **~2s** | ~4s | -50% |

Key metric: **70% input token reduction** from structural entropy pruning directly enables the 50% latency improvement.

## Theoretical Significance

### Connection to Information-Theoretic Observation
SEMA's structural entropy pruning connects to a deep principle: **the information content of a game state is in its topology, not its raw features**. Two unit configurations with identical feature vectors but different spatial/threat relationships are informationally distinct. Structural entropy captures this distinction.

### Connection to Self-Evolving Systems (CR#257)
SEMA instantiates the self-evolving agent paradigm identified in CR#257 (Self-Evolving Agent Systems Convergence). Specifically:
- **Epistemic layer** (DD#460 Hyperagents): SEMA's policy agent performs post-game epistemic reflection
- **Executable layer** (AgentFactory): SEMA's decision agent is the tactical executor
- **Procedural layer** (DD#434 Kumiho): SEMA's memory mechanism is procedural knowledge management

SEMA is **one of the first complete instantiations** of this three-layer self-evolving architecture in a competitive domain.

### Connection to DD#463 Selection Bottleneck
The structural entropy pruning is an elegant solution to the **selection bottleneck** — too much information degrades LLM performance. SEMA proves that principled compression (not just truncation) can overcome this.

## GUS Connections

### Law Connections
- **L7 (Resource Sensitivity):** Structural entropy pruning = allocating attention proportional to informational value
- **L15 (Reflective Improvement):** Cross-episode evolution is systematic self-improvement
- **L28 (Environmental Adaptation):** Strategy evolution adapts to opponent patterns without retraining

### Mechanism Connections
- **M12 (Hierarchical Memory):** Three-tier micro/macro/domain memory maps directly to hierarchical memory governance
- **M24 (Observation Governance):** Structural entropy as the formal criterion for observation filtering
- **M8 (Dynamic Resource Allocation):** Token budget allocated based on information topology

### CR Connections
- **CR#257 (Self-Evolving Agent Systems):** SEMA is a concrete instance of the three-layer self-evolution architecture
- **CR#255 (Fragile Orchestra):** SEMA's evaluation agent is a real-time error correction mechanism — partial answer to the fragility triangle
- **DD#463 (Selection Bottleneck):** Structural entropy pruning directly addresses observation overload

## Gaps & Open Questions

1. **Scalability beyond StarCraft II:** All evaluation is on SCII maps with relatively small unit counts (2-8 units per side). Would structural entropy pruning scale to 100+ unit scenarios (e.g., full-scale SCII games)?

2. **LLM dependency:** Framework is tested with specific LLMs (likely GPT-4 class). How sensitive is performance to model quality? Does it work with smaller, deployable models?

3. **Opponent adaptation speed:** Self-evolution occurs cross-episode. Against rapidly adapting opponents, the evolution loop may be too slow. No adversarial co-evolution experiments.

4. **No comparison with RL baselines:** SEMA compares against other LLM frameworks (HIMA) but not against state-of-the-art RL approaches (AlphaStar, etc.). The 100% win rates may reflect easy opponent difficulty levels.

5. **Structural entropy computation cost:** Building and optimizing encoding trees has its own computational overhead. The paper doesn't report this cost separately — the 50% latency reduction may partly hide an observation processing bottleneck.

## Predictions

- **P102 (Testable):** Structural entropy-based observation pruning will be adopted by at least 2 other LLM-agent frameworks for RTS or similar complex domains within 12 months.
- **P103 (Testable):** The three-agent (executor/evaluator/evolver) architecture will become a standard pattern for LLM-based game-playing agents, appearing in 5+ papers by end of 2026.
- **P104 (Theoretical):** There exists an optimal pruning ratio for structural entropy that balances information loss against inference speedup — and this ratio is environment-dependent (sparse environments tolerate more pruning).

## Verdict

SEMA is a **well-engineered system paper** that makes the right architectural choices for LLM-based RTS decision-making. The structural entropy pruning is the standout contribution — it's principled, topology-aware, and achieves massive token reduction. The three-agent self-evolving architecture is becoming a standard pattern but SEMA executes it competently.

**Limitations:** The evaluation is limited to small SCII maps and only compares against LLM baselines (not RL). The "100% win rate" claims need scrutiny against difficulty settings. The military affiliations suggest a defense-oriented motivation that may not translate to general AI research priorities.

**Rating: ★★★★** — Strong system contribution with novel pruning mechanism, but evaluation gaps prevent a higher rating.
