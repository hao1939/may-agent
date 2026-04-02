# CR#182: The Compute Budget Problem — Six Layers of Where to Think

**Cross-Reference Synthesis #182**
**Date:** 2026-03-16
**Author:** Scout
**Rating:** ★★★★★ CRITICAL
**Type:** Meta-Synthesis (6 DDs → unified framework)
**Connected DDs:** DD#287, DD#290, DD#291, DD#300, DD#333, DD#339

---

## The Core Discovery

Six independently published papers from the Monday March 16 batch each solve a different facet of the same fundamental problem: **given a fixed compute budget, how should an AI agent allocate reasoning effort across space, time, depth, and model tiers?** None references any of the others. None frames itself as solving a "budget allocation" problem. Yet together, they reveal a complete six-layer stack for compute-efficient agent operation.

**The unifying thesis:** Agent intelligence is not about having more compute — it's about having better compute allocation policies. Every gain in these papers comes not from larger models or more training, but from smarter decisions about WHERE to think.

---

## The Six Layers

### Layer 1: Token-Level Allocation (DD#333 — BAVT)
**Granularity:** Individual visual/text tokens within a single forward pass
**Mechanism:** Visual Importance Predictor (VIP) scores spatial regions, allocates more tokens to task-relevant areas, fewer to backgrounds
**Budget signal:** Learned importance scores → differentiable top-k sampling
**Key result:** 30-50% token reduction with maintained or improved accuracy
**Decision unit:** "Should this pixel region get 2 tokens or 20?"

### Layer 2: Step-Level Allocation (DD#291 — ReBalance)
**Granularity:** Individual reasoning steps within a chain-of-thought
**Mechanism:** Confidence variance detects overthinking (oscillation) vs. underthinking (premature commitment), applies steering vectors to redirect reasoning
**Budget signal:** Real-time stepwise confidence + confidence variance
**Key result:** Simultaneous accuracy improvement AND token reduction (training-free)
**Decision unit:** "Should this reasoning step explore further or commit?"

### Layer 3: Action-Level Allocation (DD#300 — AVR)
**Granularity:** Individual agent actions (GUI clicks, tool calls)
**Mechanism:** Difficulty estimation + confidence probing → threshold-based routing to cheapest adequate model
**Budget signal:** Per-action difficulty score + small-model confidence
**Key result:** 78% inference cost reduction within 2pp of large-model baseline
**Decision unit:** "Does this action need a big model or a small one?"

### Layer 4: Tool-Level Allocation (DD#287 — ToolTree)
**Granularity:** Tool invocation sequences across a multi-step plan
**Mechanism:** MCTS with dual-feedback (pre-execution predictive + post-execution actual) and bidirectional pruning (forward pruning of unpromising branches, backward pruning of dead-end subtrees)
**Budget signal:** UCT score combining exploitation (Q values) and exploration (prior-augmented), schema-filtered action space
**Key result:** ~10% average gain over SOTA with highest efficiency
**Decision unit:** "Which tool sequence is worth exploring next?"

### Layer 5: Strategy-Level Allocation (DD#290 — AI Planning Framework)
**Granularity:** The entire planning paradigm for a task
**Mechanism:** Taxonomy mapping agent architectures to classical planning: Step-by-Step → BFS (breadth-first, cautious), Tree Search → Best-First (informed), Full-Plan → DFS (depth-first, committed)
**Budget signal:** Task type + failure mode analysis (context drift for BFS, decomposition errors for DFS)
**Key result:** Step-by-Step: 38% success (human-aligned trajectories); Full-Plan: 89% element accuracy — neither dominates
**Decision unit:** "Should this task be planned incrementally or upfront?"

### Layer 6: Tier-Level Allocation (DD#339 — Pyramid MoA)
**Granularity:** Which model tier (ensemble of SLMs vs. single large Oracle) handles the query
**Mechanism:** Probabilistic anytime computation — XGBoost router predicts P_fail for cheap ensemble, escalates to expensive Oracle only when P_fail > threshold
**Budget signal:** Router confidence + generalized escalation rule: P_fail > C_esc/U_correct + (1 - P_oracle)
**Key result:** Formal necessary-and-sufficient condition for monotonic quality improvement with compute depth
**Decision unit:** "Should this query go to the 8B ensemble or the 70B Oracle?"

---

## The Stack Composition Principle

These six layers are NOT alternatives — they are **nested**. A fully optimized agent would operate all six simultaneously:

```
Query arrives
  └→ L6 (Pyramid): Route to SLM ensemble or Oracle
       └→ L5 (Planning): Choose BFS/DFS/Best-First strategy
            └→ L4 (ToolTree): Search tool-use trajectories via MCTS
                 └→ L3 (AVR): Route each action to cheapest adequate model
                      └→ L2 (ReBalance): Steer each reasoning step via confidence
                           └→ L1 (BAVT): Allocate tokens within each forward pass
```

**The Composition Multiplier:** If each layer independently achieves a 30-50% compute reduction (conservative across these papers), a fully composed stack would achieve:

```
Compound savings ≈ 1 - (0.6)^6 ≈ 95.3% reduction
```

This is almost certainly overly optimistic (layers interact, diminishing returns apply), but even a 3-layer composition (L1 + L3 + L6) would yield ~78% savings — consistent with the AVR paper's standalone result.

---

## Three Cross-Layer Interactions

### 1. The Confidence Propagation Problem
Layer 2 (ReBalance) uses stepwise confidence to steer reasoning. Layer 3 (AVR) uses confidence to route actions. Layer 6 (Pyramid) uses router confidence to escalate. **But confidence at each layer is computed independently.** A reasoning step's confidence should inform whether the action it selects needs a big model (L3), and vice versa. Currently, no system propagates confidence signals across layers.

**Prediction (CBP-1):** A system that propagates confidence signals top-down (L6→L3→L2) will outperform independent-confidence systems by 15-25% on cost-efficiency Pareto frontiers, because early high-confidence routing at L6 eliminates the need for expensive confidence probing at L3.

### 2. The Budget Interference Effect
Layer 1 (BAVT) reduces tokens per forward pass. Layer 2 (ReBalance) reduces reasoning steps per chain. But aggressive token reduction at L1 may INCREASE confidence variance at L2 (less information per step → less stable reasoning), triggering MORE reasoning steps — negating the L1 savings.

**Prediction (CBP-2):** There exists a Pareto-optimal L1-L2 joint budget where total compute is minimized. This optimum is NOT at either layer's independent optimum. Specifically, L1 should maintain higher token budgets for steps that L2 identifies as high-variance (underthinking-prone).

### 3. The Planning-Routing Mismatch
Layer 5 (Planning Framework) selects BFS vs. DFS strategy. Layer 6 (Pyramid) routes to SLM vs. Oracle. But BFS strategies generate MANY intermediate states (breadth exploration), each requiring a routing decision at L6. DFS strategies generate FEWER but DEEPER states. The routing policy at L6 should be **conditioned on the planning strategy at L5**: BFS queries should have LOWER escalation thresholds (each query is cheaper but there are more of them), while DFS queries should have HIGHER escalation thresholds (each is expensive but there are fewer).

**Prediction (CBP-3):** A planning-aware router (L5-conditioned L6) will achieve 20-30% better cost-accuracy trade-offs than a planning-agnostic router, because it can co-optimize the number of routing decisions with the depth of each decision.

---

## The Missing Layer: L0 — Attention Allocation

None of these papers addresses the most fundamental budget decision: **what to attend to in the input**. Before token allocation (L1), before reasoning steps (L2), before tool selection (L4), the agent must decide what parts of its context are worth processing. This is the attention mechanism itself — and it's currently unbudgeted.

Recent work on sparse attention and context compression (DD#320 — ActTail) hints at this layer: heavy-tailed spectral properties determine which attention projections tolerate sparsity. A principled L0 would use task-conditioned attention masks before ANY downstream budget allocation occurs.

**This is the biggest open problem in the stack:** L0 is the only layer where budget allocation is currently handled by the architecture (fixed attention patterns) rather than by a learned policy.

---

## The Fundamental Trade-off: Exploration vs. Exploitation Across Layers

Every layer faces the same trade-off in different form:

| Layer | Exploration | Exploitation |
|-------|------------|-------------|
| L1 (Token) | Allocate tokens uniformly | Focus tokens on important regions |
| L2 (Step) | Explore alternative reasoning paths | Commit to current path |
| L3 (Action) | Route to large model (safer) | Route to small model (cheaper) |
| L4 (Tool) | Explore novel tool sequences | Exploit known-good tools |
| L5 (Strategy) | BFS (explore breadth) | DFS (exploit depth) |
| L6 (Tier) | Escalate to Oracle | Trust ensemble |

This is not coincidence. The compute budget problem IS the exploration-exploitation trade-off at different granularities. The UCB/UCT framework used by ToolTree (L4) is mathematically identical to the confidence-based steering in ReBalance (L2) — both balance Q-values (exploitation) against uncertainty estimates (exploration).

**Unifying formulation:** At every layer, the optimal budget policy maximizes:

```
π*(layer) = argmax_π [E[Quality(π)] - λ · Cost(π)]
```

where λ is the layer-specific cost sensitivity. The layers differ only in what "Quality" and "Cost" mean at their granularity.

---

## Implications for Our System

1. **We operate mainly at L5** (implicit BFS/DFS choices in how agents plan) with emerging L6 (May's routing layer). Layers L1-L4 are mostly unoptimized.

2. **Immediate opportunity:** Implement L2 (ReBalance-style confidence monitoring) in agent reasoning. This is training-free and could reduce reasoning token costs by 30-50% with no accuracy loss.

3. **Medium-term:** Add L3 (action-level routing) to tool calls. Simple confidence probing before expensive operations could save substantial cost.

4. **The attention budget (L0) is the long game.** Once sparse attention methods mature, this becomes the highest-leverage optimization point.

---

## Relationship to Prior CRs

- **CR#161 (Multi-Agent Coordination Stack):** Describes HOW agents coordinate; CR#182 describes WHERE they spend compute while coordinating
- **CR#177 (Self-Improvement Triangle):** Three-speed stack (diagnosis, evolution, optimization); CR#182's six layers are all "diagnosis" — deciding where to invest before investing
- **CR#148 (Evaluation as Optimization):** Semantic gradients for quality improvement; CR#182 shows that the budget for computing those gradients itself needs optimization
- **CR#181 (Coordination Tax):** Quantifies the cost of coordination overhead; CR#182 shows how each layer can reduce that cost through smarter allocation

---

## Falsifiable Predictions

1. **CBP-1 (Confidence Propagation):** Cross-layer confidence sharing (L6→L3→L2) yields 15-25% better cost-efficiency Pareto than independent confidence per layer
2. **CBP-2 (Budget Interference):** Joint L1-L2 optimization outperforms sequential optimization by ≥10% on total compute at matched accuracy
3. **CBP-3 (Planning-Routing Mismatch):** Planning-conditioned routing outperforms planning-agnostic routing by 20-30% on cost-accuracy metrics
4. **CBP-4 (Composition Floor):** A 3+ layer composition achieves ≥60% total compute reduction (multiplicative savings with interference penalty)
5. **CBP-5 (Universal UCB):** A single UCB-family policy can be instantiated at all six layers with layer-specific reward/cost definitions, outperforming layer-specific ad-hoc policies by ≥5%

---

*This synthesis connects 6 papers that independently optimize different granularities of the same compute allocation problem. Their convergence on exploration-exploitation trade-offs at different scales suggests a unified theory of agent compute budgeting is within reach.*
