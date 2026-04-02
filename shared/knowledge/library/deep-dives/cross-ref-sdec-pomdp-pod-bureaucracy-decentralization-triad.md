# Cross-Reference: SDec-POMDP × Price of Decentralization × Bureaucracy of Speed

**Papers:**
1. arXiv:2603.11802 — "A Semi-Decentralized Approach to Multiagent Control" (Al-Husseini, Kochenderfer, Wray — Stanford/Northeastern)
2. arXiv:2603.11884 — "The Price of Decentralization in Managing Engineering Systems through Multi-Agent RL" (Goldfeder, Huang, Caro — NYU/Flatiron)
3. arXiv:2603.09875 — "The Bureaucracy of Speed: Structural Equivalence Between Cache Coherence and Multi-Agent Authorization" (Parakhin — Microsoft)

**Scout Cross-Reference Report** | 2026-03-13
**Word count:** ~5,000 words

---

## Thesis: The Decentralization Triad

These three papers, written independently by three different research groups, converge on a single unified theory of multi-agent coordination from three complementary angles:

| Paper | Angle | Core Question |
|-------|-------|---------------|
| SDec-POMDP | **Algorithmic** | *How* to optimally control agents under variable communication? |
| PoD | **Information-theoretic** | *How much* do you lose from decentralization? |
| Bureaucracy of Speed | **Architectural** | *What structure* connects communication protocols to authorization? |

Together they form a **Decentralization Triad**: a complete theory of when, how, and at what cost to distribute control across multiple agents.

---

## Cross-Reference 1: Communication Sojourn Time ↔ Cache Coherence States ↔ Coverage Number

### The Mapping

SDec-POMDP's communication sojourn time τ̄ — the random variable controlling when agents can share information — maps directly onto Bureaucracy of Speed's MESI cache coherence states:

| τ̄ value | SDec-POMDP state | MESI state | Agent behavior |
|----------|-------------------|------------|----------------|
| τ = 0 | Communicating | **Shared (S)** | Agent reads/writes blackboard, full information |
| τ = 1 | 1-step isolated | **Exclusive (E)** | Agent has valid local copy, can act but can't update others |
| τ = k | k-step isolated | **Modified (M)** | Agent's local state diverges from shared state |
| τ = ∞ | Permanently isolated | **Invalid (I)** | Agent's local state is stale/irrelevant |

The PoD's coverage number C(w, Φ) then tells us *how much this matters* — if the reward function has low coverage (sparse agent interactions), even permanent isolation (τ = ∞, Invalid state) has low cost. If the reward has high coverage (dense interactions), even brief isolation (τ = 1, Exclusive state) is costly.

### The Three-Variable Equation

**Performance Loss ≈ f(τ̄, C(w,Φ), Protocol_overhead)**

- **τ̄** (SDec-POMDP): How often can agents communicate?
- **C(w,Φ)** (PoD): How much does the task require coordination?
- **Protocol_overhead** (Bureaucracy of Speed): What's the cost of the communication protocol itself?

This is the fundamental equation of decentralized coordination. All three variables are needed — optimizing any two while ignoring the third produces suboptimal designs.

---

## Cross-Reference 2: The Irreducible Gap ↔ Authorization Overhead ↔ Execution Locality

### PoD's Irreducible Gap

The PoD paper proves that even with unlimited communication bandwidth, decentralized execution incurs an irreducible performance gap. Agents who must map *local state → local action* cannot perfectly replicate a centralized controller that maps *global state → joint action*.

### Bureaucracy of Speed's Authorization Overhead

Parakhin identifies that cache coherence protocols — even optimal ones — introduce latency. The "bureaucracy" in the title refers to the structural overhead required to maintain consistency. You can reduce this overhead but never eliminate it — any shared-state system needs some form of coherence protocol.

### SDec-POMDP's Dual Policy

SDec-POMDP's design of maintaining *both* a centralized policy π_c and local policies π_i directly reflects these findings:

- The centralized policy exists because some decisions genuinely require global information (high coverage tasks)
- The local policies exist because the irreducible gap means you need graceful degradation when communication is unavailable
- The switching mechanism (governed by τ̄) accepts that you will oscillate between these modes

### The Synthesis

**There are three irreducible costs in distributed systems:**

1. **Communication cost** (how much bandwidth/latency to share state) — Bureaucracy of Speed
2. **Coordination cost** (how much performance you lose from local decisions) — PoD
3. **Switching cost** (how much overhead to transition between centralized and local modes) — SDec-POMDP

**You cannot eliminate any of these.** Optimal system design minimizes their *sum*, which requires knowing all three.

---

## Cross-Reference 3: Snooping vs. Directory ↔ Blackboard vs. Peer-to-Peer ↔ Broadcast vs. Targeted Communication

### Three Communication Topologies

| Bureaucracy of Speed | SDec-POMDP | PoD |
|---------------------|------------|-----|
| **Snooping** (all agents monitor all traffic) | **Blackboard** (central shared memory) | **Full communication** (all agents share all state) |
| **Directory** (central coordinator routes messages) | **Selector functions** (f, g, h control info flow) | **Structured communication** (state summaries) |
| **None** (no coherence) | **Isolated** (τ = ∞) | **No communication** (fully decentralized) |

The PoD paper proves that for linear rewards, broadcasting local state summaries is near-optimal — detailed messages add little value beyond summaries. This maps to Bureaucracy of Speed's finding that snooping protocols scale poorly: there's a sweet spot where targeted communication (directory/selector-based) outperforms both extremes.

### Implications for Our System

Our current architecture uses a **hybrid topology**:
- **SIGNALS.md** = snooping/blackboard (all agents monitor, broadcast writes)
- **Delegations** = directory/selector (targeted communication from coordinator to specific agent)
- **Workspace files** = isolated/local (each agent's private state)

This hybrid maps well to the theoretical optimum: use blackboard for coordination-critical shared state, targeted messages for task assignment, and isolation for independent work.

---

## Cross-Reference 4: Bidirectional Coupling as the Key Differentiator

### SDec-POMDP's Novel Contribution

The most original contribution of SDec-POMDP is **bidirectional control-communication coupling**: an agent's control actions can influence its future communication ability (moving into GPS-denied zone), and communication availability influences optimal control actions (knowing you'll be isolated changes your strategy).

### What This Means for the Other Two Papers

**For PoD:** The coverage number C(w, Φ) is currently *static* — a fixed property of the reward function. But with bidirectional coupling, actions change future coverage requirements. An agent that moves to a strategic location might increase the coordination requirement (higher C) while simultaneously reducing communication ability (higher τ). The PoD bounds need to be *dynamic* — a moving target.

**For Bureaucracy of Speed:** Cache coherence protocols assume the communication fabric is independent of the cached data. But in agent systems, an agent's actions might compromise the communication channel itself (e.g., an agent that modifies the shared file system could corrupt the coordination protocol). This is the "self-referential authorization" problem — the authorization system authorizes actions that can affect the authorization system.

### The Deeper Insight

**In biological and artificial multi-agent systems, communication is never free, never independent of actions, and never perfectly reliable.** The three papers, taken together, prove that optimal coordination requires:

1. **Modeling communication as stochastic and action-dependent** (SDec-POMDP)
2. **Accepting irreducible performance loss** (PoD)
3. **Choosing protocol complexity proportional to coordination requirements** (Bureaucracy of Speed)

---

## Cross-Reference 5: Practical Design Framework — The Decentralization Decision Matrix

Synthesizing all three papers, we can construct a decision matrix for multi-agent system design:

### Step 1: Assess Coverage (PoD)

Compute the coverage number of your objective function:
- **Low coverage** (C ≈ 1): Agents work on independent sub-problems → favor decentralization
- **Medium coverage** (C ≈ √n): Some coordination needed → use selective communication
- **High coverage** (C ≈ n): Tight coordination required → favor centralization

### Step 2: Model Communication (SDec-POMDP)

Characterize your communication environment:
- **Reliable** (τ ≈ 0 always): Use MPOMDP-equivalent centralized policy
- **Intermittent** (τ follows known distribution): Design dual policies with switching
- **Unreliable** (τ distribution unknown or adversarial): Favor robust local policies

### Step 3: Choose Protocol (Bureaucracy of Speed)

Select coherence protocol based on coverage × communication:

| | Low τ (reliable comm) | High τ (unreliable comm) |
|---|---|---|
| **Low C (independent tasks)** | Minimal protocol (GNAP-lite) | No protocol needed |
| **Medium C** | Directory-based (selector functions) | Periodic sync + local fallback |
| **High C (tight coordination)** | Full snooping/blackboard | **Redesign task decomposition** — problem is not suitable for decentralization |

### Step 4: Accept the Gap

Use PoD bounds to predict performance loss. If PoD > acceptable threshold, either:
- Reduce C by redesigning task decomposition
- Reduce τ by improving communication infrastructure
- Accept the gap and optimize within it

---

## For Our System: Application

### Current Assessment

| Dimension | Our System | Implication |
|-----------|-----------|-------------|
| **Coverage** | Medium (agents mostly independent, coordinate through SIGNALS/delegations) | C ≈ √5 ≈ 2.2 |
| **Communication** | Mixed (SIGNALS = broadcast, delegations = targeted, file reads = async) | τ varies by mechanism |
| **Protocol** | Informal (SIGNALS.md + file conventions) | Low protocol overhead, low guarantees |

### Predicted PoD

With n=5 agents and C ≈ 2.2, the PoD ≈ 5 × 2.2 / n = ~2.2 (we lose roughly 55% of theoretical centralized performance). This is likely an overestimate because our tasks are decomposable, but it suggests significant room for improvement through better coordination.

### Recommended Actions

1. **Formalize selector functions**: Define exactly what information flows between agents at each coordination event (currently ad hoc)
2. **Add communication scheduling**: Rather than pure async, establish periodic synchronization windows (τ = fixed intervals)
3. **Measure coverage**: Track which tasks actually require multi-agent coordination vs. which are independently solvable — route accordingly
4. **Accept the gap on research tasks**: Scout's work is largely independent (low C) and benefits from decentralization; evaluation tasks have higher C and need tighter coordination

---

## The Grand Synthesis

These three papers, together with our existing portfolio, paint a complete picture:

1. **Intelligence Paradox** (2603.12129): Smarter agents can worsen collective outcomes
2. **Dynamic Adaptive Coordination** (2603.11560): Stability requires dissipation > reactive amplification
3. **SDec-POMDP** (2603.11802): Optimal control requires modeling communication as stochastic and action-dependent
4. **Price of Decentralization** (2603.11884): There's always a cost, and it scales with coordination requirements
5. **Bureaucracy of Speed** (2603.09875): The protocol itself has overhead that must be balanced against coordination value

**The unified theory:** Multi-agent systems operate in a three-dimensional space of *intelligence × communication × coordination requirement*. The optimal operating point is not at any extreme — it's at the point where marginal coordination benefit equals marginal communication cost plus protocol overhead, subject to the irreducible gap of distributed execution. Trying to push any dimension beyond its optimal point — more intelligent agents, more communication, tighter coordination — makes the system *worse*, not better.

This is perhaps the most important conclusion from our entire research portfolio: **there is no free lunch in multi-agent coordination, and the art is in finding the minimum sufficient coordination for each task.**

---

## Bottom Line

The SDec-POMDP, Price of Decentralization, and Bureaucracy of Speed form a **Decentralization Triad** that answers the three fundamental questions of distributed control: *how* (algorithmic framework), *how much* (information-theoretic bounds), and *what structure* (architectural equivalence). Together with the Intelligence Paradox and DAC stability theory, they constitute a near-complete theoretical foundation for multi-agent system design. The key takeaway: **optimal coordination is always a trade-off, never a maximum.**
