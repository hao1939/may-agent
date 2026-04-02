# Cross-Reference Synthesis: The Multi-Agent Coordination Spectrum
## From Self-Organization to Formal Protocols — What Works, When, and Why

**Scout Research Program | 2026-03-14**
**Papers Integrated:**
1. SelfOrg — Stochastic Self-Organization in MAS (arXiv:2510.00685, ICLR 2026)
2. CoHet — GNN-Driven Intrinsic Rewards for Heterogeneous MARL (arXiv:2408.06503, AAMAS 2025)
3. TEP — Textual Equilibrium Propagation for Compound AI (arXiv:2601.21064, ICLR 2026)
4. CSRO — Code-Space Response Oracles for Multi-Agent Policies (arXiv:2603.10098)
5. RQRE — Strategically Robust MARL (arXiv:2603.09208)
6. Chow–Liu Ordering — Information-Theoretic Agent Chain Optimization (arXiv:2603.09835)
7. EPOCH — Agentic Protocol for Multi-Round Optimization (arXiv:2603.09049)
8. One Supervisor, Many Modalities — Adaptive Tool Orchestration (arXiv:2603.11545)

**Also cross-referenced with existing syntheses:**
- Agentic Hives (2603.00130) — Equilibrium indeterminacy
- Can AI Agents Agree? (2603.01213) — Byzantine consensus failure
- LM Teams as Distributed Systems (2603.12229) — Distributed systems framework
- OpenMOSS — Self-organizing agent platform

---

## Executive Summary

Eight orphan papers, each studying a different approach to multi-agent coordination, converge on a unified insight:

> **Multi-agent coordination is not a single problem with a single solution, but a spectrum with fundamentally different approaches suited to different operational regimes. The critical insight is the Coordination-Autonomy Tradeoff: as agents become more autonomous and capable, the coordination mechanism must shift from centralized orchestration toward emergent self-organization — but self-organization introduces equilibrium indeterminacy that can only be tamed through formal protocol constraints. The optimal architecture lives at a specific point on this spectrum determined by three factors: agent heterogeneity, task decomposability, and adversarial pressure.**

### The Five Core Results

1. **The Coordination Spectrum has four distinct regimes** — each with different failure modes, scaling properties, and optimal use cases. No single approach dominates.

2. **Self-organization works but is fragile** — SelfOrg and CoHet demonstrate that emergent coordination can match or beat centralized approaches, but Agentic Hives proves this is inherently indeterminate (multiple equilibria, endogenous cycling).

3. **Information-theoretic ordering matters enormously** — Chow–Liu ordering provides 4-8% accuracy improvement over positional ordering in chain-of-agents, proving that inter-agent information routing is a first-order design parameter.

4. **Formal protocols enable auditability but constrain adaptability** — EPOCH's multi-round protocol and One Supervisor's typed interfaces provide reproducibility and traceability, but sacrifice the emergent flexibility of self-organizing approaches.

5. **Game-theoretic robustness requires relaxing optimality** — RQRE and CSRO demonstrate that moving from Nash equilibrium to quantal/bounded-rationality solutions produces smoother, more learnable, and more robust coordination — echoing our Intelligence Paradox finding that "less optimal" agents often produce better system-level outcomes.

---

## 1. The Four Coordination Regimes

Cross-referencing all eight papers reveals four distinct regimes along the coordination spectrum:

### Regime 1: Centralized Orchestration
**Representative:** One Supervisor (2603.11545), EPOCH (2603.09049)
**Architecture:** Single coordinator dispatches tasks to worker agents

| Property | Value |
|----------|-------|
| **Topology** | Star/hub-and-spoke |
| **Agent autonomy** | Low — agents execute assigned tasks |
| **Coordination overhead** | Low per-agent, concentrated at coordinator |
| **Failure mode** | Single point of failure at coordinator |
| **Scalability** | Linear until coordinator saturates |
| **Best for** | Well-decomposable tasks, heterogeneous tools, production reliability |

**Key insight from One Supervisor:** Centralized orchestration achieves 72% reduction in time-to-answer and 85% reduction in rework — but requires typed tool interfaces and zero-loss state transitions. The Supervisor itself becomes the critical bottleneck.

**Key insight from EPOCH:** Protocol-level orchestration (explicit role separation between planning, implementation, evaluation) provides auditability and reproducibility. The tradeoff: rigidity. EPOCH's four-role structure (Orchestrator, Investigator, Implementer, Evaluator) can't adapt mid-round to unexpected discoveries.

**Connection to LM Teams as Distributed Systems (2603.12229):** This regime maps to strongly consistent distributed systems — high coordination cost but guaranteed convergence. The CAP theorem applies: centralized orchestration sacrifices availability (system halts if coordinator fails) for consistency.

### Regime 2: Structured Decentralization
**Representative:** Chow–Liu Ordering (2603.09835), CoHet (2408.06503)
**Architecture:** Decentralized agents with structured communication topology

| Property | Value |
|----------|-------|
| **Topology** | Tree/chain (Chow–Liu) or GNN graph (CoHet) |
| **Agent autonomy** | Medium — agents operate independently but routing is structured |
| **Coordination overhead** | O(n²) for topology construction, O(n) for execution |
| **Failure mode** | Information loss at routing bottlenecks |
| **Scalability** | Good — parallelizable within topology |
| **Best for** | Long-context reasoning, heterogeneous agent capabilities, tasks with information dependencies |

**Key insight from Chow–Liu:** The ordering in which agents process and pass information determines 4-8% of task accuracy. This is a HUGE effect — comparable to switching model sizes. Information-theoretic routing (maximum mutual information spanning tree) is provably better than positional or random ordering.

**Key insight from CoHet:** Coordination can emerge from prediction alignment rather than explicit consensus. When agents learn to predict each other's next observations, they become mutually predictable — and this predictability IS coordination. CoHet's intrinsic reward mechanism (negative prediction error) creates dense coordination signals even when environmental rewards are sparse.

**Fundamental principle:** Structured decentralization works when you can compute the optimal topology before execution. This requires knowing (or estimating) inter-agent information dependencies in advance.

### Regime 3: Emergent Self-Organization
**Representative:** SelfOrg (2510.00685), OpenMOSS (with Patrol role)
**Architecture:** No pre-determined topology — agents self-organize based on runtime signals

| Property | Value |
|----------|-------|
| **Topology** | Dynamic DAG constructed per-query (SelfOrg) |
| **Agent autonomy** | High — agents assess their own contributions |
| **Coordination overhead** | O(N) per round (Shapley approximation) |
| **Failure mode** | Equilibrium indeterminacy, sensitivity to initialization |
| **Scalability** | Excellent — adding agents is cheap |
| **Best for** | Tasks where optimal structure is unknown, diverse agent pools, rapid adaptation |

**Key insight from SelfOrg:** Because LLMs are inherently stochastic, two runs of the same query produce different response distributions. Therefore, the optimal communication topology must be conditioned on actual responses, not pre-determined. SelfOrg's Shapley-value-based DAG construction achieves this — but at the cost of reproducibility.

**Critical limitation from Agentic Hives (2603.00130):** Self-organizing systems have multiple equilibria (Result 2: Indeterminacy) and can exhibit endogenous cycling (Result 3) even without external perturbation. The same agents with the same task may produce radically different organizational structures across runs. This makes self-organization fundamentally unsuitable for safety-critical applications where reproducibility is required.

**OpenMOSS hybrid approach:** Combines centralized coordination (Planner) with self-healing (Patrol role), achieving production reliability through a compromise: structure is centrally defined but execution is decentralized. The Patrol agent adds a monitoring layer that catches failures the self-organizing system would otherwise cycle through indefinitely.

### Regime 4: Game-Theoretic Equilibrium
**Representative:** RQRE-OVI (2603.09208), CSRO (2603.10098), TEP (2601.21064)
**Architecture:** Agents treated as strategic actors; coordination defined as equilibrium

| Property | Value |
|----------|-------|
| **Topology** | Defined by game structure (general-sum Markov game) |
| **Agent autonomy** | Full — agents optimize own objectives |
| **Coordination overhead** | High — computing equilibria is expensive |
| **Failure mode** | Equilibrium instability, computational intractability |
| **Scalability** | Poor for exact solutions, better with approximations |
| **Best for** | Adversarial/competitive settings, robust policy design, formal guarantees |

**Key insight from RQRE:** Nash equilibrium — the standard solution concept — is computationally intractable, non-unique, and brittle. Small perturbations cause discontinuous jumps. RQRE replaces Nash with a smoother solution concept combining bounded rationality (softmax responses) and risk sensitivity (worst-case evaluation). This yields unique, Lipschitz-continuous equilibria that are actually learnable.

**Key insight from CSRO:** Replacing opaque neural response oracles with LLM-generated code policies makes game-theoretic solutions interpretable and verifiable. The equilibrium strategies become readable Python code rather than inscrutable weight matrices.

**Key insight from TEP:** Compound AI systems can be treated as energy-based models. Equilibrium propagation optimizes the entire system holistically, rather than optimizing individual components in isolation. This solves the "gradient discontinuity" problem at text interfaces — but requires treating the system as converging to a textual equilibrium.

**Connection to Can AI Agents Agree? (2603.01213):** Even in the simplest case (scalar consensus, all-cooperative agents), LLM groups cannot reliably reach agreement. This validates that formal game-theoretic tools are necessary — informal coordination mechanisms systematically fail.

---

## 2. The Coordination-Autonomy Tradeoff Curve

Plotting all eight approaches on a coordination overhead vs. agent autonomy curve reveals a fundamental tradeoff:

```
     High ┤ EPOCH           RQRE
          │ One Supervisor  TEP
Coord.    │        Chow-Liu
Overhead  │   CoHet
          │       SelfOrg
          │  OpenMOSS(Patrol)
     Low  ┤           CSRO
          └──────────────────────────────
          Low                        High
                Agent Autonomy
```

**The Pareto frontier:** Three approaches sit near the efficient frontier:
1. **Chow–Liu** — Low overhead, medium autonomy, strong theoretical guarantees
2. **SelfOrg** — Low overhead, high autonomy, but indeterminate
3. **RQRE** — High overhead, high autonomy, formal robustness guarantees

**The gap in the middle:** No approach simultaneously achieves low coordination overhead, high agent autonomy, AND formal guarantees. This is the open problem — the "coordination trilemma."

### The Coordination Trilemma

You can have at most two of:
1. **Low coordination overhead** (efficient communication)
2. **High agent autonomy** (agents self-direct)
3. **Formal convergence guarantees** (provable agreement/quality)

| Approach | Low Overhead | High Autonomy | Formal Guarantees |
|----------|-------------|--------------|-------------------|
| One Supervisor | ✓ | ✗ | ✓ |
| EPOCH | ✓ | ✗ | ✓ |
| Chow–Liu | ✓ | ✓ | ✗ (heuristic MI proxy) |
| CoHet | ✓ | ✓ | ✗ (approximate Shapley) |
| SelfOrg | ✓ | ✓ | ✗ (indeterminate) |
| TEP | ✗ | ✓ | ✓ |
| RQRE | ✗ | ✓ | ✓ |
| CSRO | ✓ | ✗ | ✓ (interpretable code) |

This trilemma is analogous to the CAP theorem in distributed systems: Consistency, Availability, Partition tolerance — pick two. Here: Efficiency, Autonomy, Guarantees — pick two.

---

## 3. When to Use Which Regime: A Decision Framework

Cross-referencing the eight papers' experimental results and failure modes produces a principled decision framework:

### Decision Variable 1: Agent Heterogeneity

| Heterogeneity | Best Regime | Why |
|--------------|-------------|-----|
| **Homogeneous** (same model) | Self-Organization | Shapley contributions are symmetric; self-organization efficiently discovers complementary roles |
| **Moderately heterogeneous** | Structured Decentralization | CoHet's GNN intrinsic rewards handle heterogeneity; Chow–Liu ordering adapts to different capabilities |
| **Highly heterogeneous** (different tools/modalities) | Centralized Orchestration | One Supervisor's typed interfaces are essential for heterogeneous tool integration |

### Decision Variable 2: Task Decomposability

| Decomposability | Best Regime | Why |
|-----------------|-------------|-----|
| **Fully decomposable** | Centralized (parallel dispatch) | EPOCH's role separation works cleanly |
| **Sequential dependencies** | Structured Decentralization | Chow–Liu ordering optimizes information flow |
| **Emergent/unknown structure** | Self-Organization | SelfOrg's query-conditioned DAG handles unknowns |
| **Adversarial/competitive** | Game-Theoretic | RQRE provides robustness guarantees |

### Decision Variable 3: Adversarial Pressure

| Adversarial Pressure | Best Regime | Why |
|---------------------|-------------|-----|
| **None** (cooperative) | Self-Organization or Structured Decentralization | Emergent coordination is efficient when no adversary |
| **Low** (benign faults) | Structured with Patrol | OpenMOSS pattern: centralized structure + monitoring |
| **High** (Byzantine agents) | Game-Theoretic | RQRE's risk-sensitive equilibrium accounts for adversarial perturbations |
| **Unknown** | Centralized with formal verification | EPOCH + CSRO's interpretable policies enable auditing |

### Combined Decision Matrix

| | Homogeneous | Heterogeneous | Highly Heterogeneous |
|---|---|---|---|
| **Decomposable + Cooperative** | SelfOrg | Chow–Liu | One Supervisor |
| **Decomposable + Adversarial** | RQRE | CoHet + RQRE | EPOCH + CSRO |
| **Non-decomposable + Cooperative** | TEP | SelfOrg | Structured + Patrol |
| **Non-decomposable + Adversarial** | RQRE + TEP | Game-Theoretic | Centralized + Formal Verification |

---

## 4. The Predictability Principle

A surprising finding emerges from cross-referencing CoHet, SelfOrg, and the Byzantine consensus paper: **coordination is fundamentally about mutual predictability, not agreement.**

### Traditional View: Coordination = Consensus
- Agents must agree on actions/values
- Consensus protocols (Paxos, Raft, BFT) ensure agreement
- But Can AI Agents Agree? (2603.01213) shows LLMs fail at even simple scalar consensus

### Emergent View: Coordination = Predictability
- CoHet: Agents coordinate by learning to predict each other's next observations
- SelfOrg: Agents self-organize based on contribution alignment (cosine similarity of responses)
- TEP: Equilibrium is when all components are locally optimal given neighbors' outputs — i.e., when each component correctly predicts the effect of its output on others

**The Predictability Principle:** An agent team is coordinated to the degree that each agent can predict the effects of its own actions on other agents' states. This is weaker than consensus (agents don't need to agree) but stronger than independence (agents must model each other).

This principle resolves the apparent contradiction between CoHet's success (coordination without consensus) and the Byzantine consensus paper's failure (LLMs can't reach consensus): coordination and consensus are different things. LLMs are bad at consensus but can achieve coordination through predictability.

### Implications for Multi-Agent Architecture Design
1. **Don't optimize for agreement — optimize for mutual predictability**
2. **Use prediction error as a coordination signal** (CoHet's approach)
3. **Make agents legible** — each agent should make its reasoning transparent to help others predict its behavior
4. **Accept non-unique outcomes** — if all agents are mutually predictable, the system is coordinated even if different runs produce different outcomes

---

## 5. The Optimization Landscape for Compound Systems

TEP and RQRE reveal complementary insights about optimizing multi-agent systems:

### TEP's Energy-Based View
- The entire compound system has an "energy landscape"
- Equilibrium = energy minimum
- TEP uses equilibrium propagation (from neuroscience) to find minima
- **Key result:** Formal convergence guarantees exist under convexity assumptions
- **Key limitation:** Real compound systems are highly non-convex → multiple local minima

### RQRE's Game-Theoretic View
- Each agent is a strategic player in a Markov game
- Equilibrium = no agent benefits from unilateral deviation
- RQRE adds bounded rationality (agents make mistakes) + risk sensitivity (agents are cautious)
- **Key result:** Unique, smooth, Lipschitz-continuous equilibria
- **Key limitation:** Computational cost scales with number of agents and action space

### Synthesis: Two Sides of the Same Coin

TEP and RQRE are actually solving the same problem from different directions:
- TEP optimizes the system **holistically** (energy minimization over all components simultaneously)
- RQRE optimizes from the **agent perspective** (individual rational behavior under bounded rationality)
- Both converge to equilibrium concepts
- TEP works when components are cooperative; RQRE works when agents are potentially adversarial

**The unification:** A compound AI system can be viewed simultaneously as:
1. An energy-based system seeking minimum-energy configuration (TEP)
2. A game among strategic agents seeking equilibrium (RQRE)
3. A distributed system seeking consensus (LM Teams framework)

These three views are formally connected through variational principles: energy minimization ↔ Nash equilibrium ↔ maximum-entropy consensus. The choice of framework depends on which assumptions hold:
- **All cooperative, shared objective → TEP** (energy minimization)
- **Mixed incentives, strategic agents → RQRE** (game-theoretic equilibrium)
- **Fault-tolerant, Byzantine-resistant → Distributed systems** (consensus protocols)

---

## 6. The Interpretability–Robustness Bridge

CSRO provides a crucial missing link: making multi-agent coordination interpretable.

### The Problem
- Neural response oracles (traditional approach): Opaque, unverifiable
- Self-organizing systems: Emergent, unexplainable
- Game-theoretic equilibria: Mathematically defined but practically inscrutable

### CSRO's Solution
- LLM generates Python code implementing best-response strategies
- Code is readable, testable, formally verifiable
- Equilibrium strategies become auditable programs

### Cross-reference with EPOCH
EPOCH's explicit protocol roles (Orchestrator, Investigator, Implementer, Evaluator) provide process-level interpretability. Combined with CSRO's strategy-level interpretability, you get a fully transparent coordination system:
- **Process:** EPOCH makes the coordination protocol auditable
- **Strategy:** CSRO makes the agent strategies verifiable
- **State:** One Supervisor's typed interfaces make system state inspectable

### Safety Implication
Interpretable coordination is the missing piece for safe multi-agent deployment. Without it, we can't verify that agents are actually coordinating in the intended manner. CSRO + EPOCH provides a path toward "trustworthy coordination" — where every coordination decision is traceable to readable code and auditable protocol steps.

---

## 7. Open Problems

### 7.1 The Indeterminacy Problem
Agentic Hives (2603.00130) proves that self-organizing systems have multiple equilibria and can cycle endogenously. None of the eight papers fully solves this. RQRE ensures uniqueness for a given game formulation — but the game formulation itself introduces assumptions.

### 7.2 Scaling Beyond O(n²)
Chow–Liu and RQRE both require O(n²) pairwise computations. For systems with hundreds or thousands of agents, this becomes prohibitive. Approximate methods (SelfOrg's Shapley approximation) sacrifice guarantees for scalability.

### 7.3 Dynamic Regime Selection
No paper addresses how to dynamically switch between coordination regimes as conditions change. A system might start in a cooperative regime (self-organization) but encounter adversarial pressure that requires switching to game-theoretic coordination. This "regime switching" problem is unexplored.

### 7.4 The Bootstrap Problem
All structured approaches (Chow–Liu ordering, CoHet's GNN rewards, CSRO's code policies) require information about the task or other agents BEFORE coordination begins. But this information is often only available AFTER coordination starts. TEP addresses this through iterative convergence, but convergence speed is uncertain.

---

## 8. Connections to Grand Unified Synthesis

This coordination spectrum synthesis connects to our established framework at multiple points:

| Grand Synthesis Law | Connection |
|---|---|
| **Law 3: Coordination Overhead Scaling** | The Coordination Trilemma quantifies this: overhead is the price of guarantees + autonomy |
| **Intelligence Paradox** | RQRE's bounded rationality confirms: "less optimal" individual agents can produce better system outcomes by creating smoother coordination landscapes |
| **Price of Decentralization** | Validated: SelfOrg's decentralization comes at the cost of indeterminacy; centralized approaches trade PoD for single-point-of-failure |
| **Sycophantic Drift** | Agentic Hives' indeterminacy explains drift: sycophancy is one of multiple equilibria that self-organizing systems can settle into |
| **4D Attack Surface Model** | Game-theoretic regime (RQRE) provides formal robustness against adversarial dimensions; other regimes are vulnerable |

---

## Meta-Conclusion

The multi-agent coordination landscape in 2026 is remarkably fragmented — each paper proposes a different coordination mechanism without referencing the others. This synthesis reveals that they are studying different points on the same spectrum, and the choice between them is determined by operational context (heterogeneity × decomposability × adversarial pressure).

The most important takeaway: **there is no universal coordination mechanism for multi-agent systems.** The Coordination Trilemma ensures this is a fundamental impossibility, not a temporary limitation. System architects must explicitly choose their position on the spectrum and accept the associated tradeoffs.

The Predictability Principle offers a unifying thread: regardless of coordination mechanism, what makes agents coordinate is mutual predictability. The question is how that predictability is achieved — through centralized control (orchestration), structured routing (topology), emergent alignment (self-organization), or strategic reasoning (game theory).
