# Cross-Reference Synthesis: The Coordination Failure Taxonomy
## A Unified Model of Why Multi-Agent LLM Coordination Fails — and the Three Paths That Work
### Scout Cross-Reference #16 | 2026-04-03

---

## Papers Synthesized (10 Deep-Dives)

| # | Paper | Key Contribution | Failure Mode Revealed |
|---|-------|-------------------|-----------------------|
| 1 | **DPBench** (2602.13255) — Hasan, BusiReddyGari | Dining Philosophers for LLMs (17 models) | Convergent reasoning → deadlock; communication worsens coordination |
| 2 | **Silo-Bench** (2603.01045) — Zhang et al. | 30 algorithmic tasks, 1,620 experiments | Communication-Reasoning Gap: agents share info but can't integrate it |
| 3 | **Teams Hold Experts Back** (2602.01011) — Stanford | Self-organizing LLM teams vs. individual experts | Integrative compromise: teams average away correctness |
| 4 | **Hanabi** (2601.18077) — Singh et al. | 17 LLMs on cooperative incomplete-info game | Theory-of-Mind collapse; egocentric hinting; convention mismatch |
| 5 | **ToM/Internal Beliefs** (2603.00142) — Kostka, Chudziak | BDI architecture + ASP verification for coordination | ToM only helps strong models; weak models get confused by their own ToM |
| 6 | **Coordination Gap** (2603.05789) — Papadopoulos, Psannis | Alternation metrics for temporal coordination | Q-learning achieves worse coordination than random; metrics are misleading |
| 7 | **EmCoop** (2603.00349) — CMU | Embodied cooperation benchmark + MAEIL process model | Synchronization barriers dominate embodied coordination failures |
| 8 | **LM Teams as Distributed Systems** (2603.12229) — Princeton/Cambridge | Amdahl's Law + CAP theorem for LLM teams | Decentralized teams routinely slower than single agents; O(n²) comms overhead |
| 9 | **WideSeek-R1** (2602.04634) — Tsinghua/MSRA | MARL-trained width scaling (4B ≈ 671B) | Untrained width scaling peaks then declines; MARL training is necessary for scaling |
| 10 | **Hybrid Human-Agent** (2603.11834) — Monash | Evolutionary game theory for human-AI coordination | Free-riding dynamics in hybrid populations; cooperation requires intrinsic rewards |
| 11 | **Emotional Modulation** (2603.09963) — SIANI | Affect-modulated swarm decision-making | Emotional snowball effects can hijack collective decisions toward inferior options |

---

## The Core Insight: Five Root Causes, One Unified Failure Model

These 11 papers, produced independently across 15+ institutions, all describe multi-agent coordination failures. Despite diverse settings (card games, dining philosophers, coding tasks, energy markets, embodied worlds), **every observed failure traces to exactly five root causes** that compose and amplify each other:

```
                    ┌─────────────────────────────┐
                    │   COORDINATION FAILURE       │
                    │   (observed as: deadlock,     │
                    │    low performance, slower    │
                    │    than single-agent)         │
                    └──────────┬──────────────────┘
                               │
              ┌────────┬───────┼────────┬──────────┐
              ▼        ▼       ▼        ▼          ▼
         ┌────────┐┌───────┐┌──────┐┌────────┐┌─────────┐
         │CONVER- ││INTEGR-││ ToM  ││ COMMS  ││ SCALE   │
         │GENT    ││ATION  ││FAIL- ││ OVER-  ││ ANTI-   │
         │REASON- ││FAIL-  ││URE   ││ HEAD   ││ SCALING │
         │ING     ││URE    ││      ││        ││         │
         └────────┘└───────┘└──────┘└────────┘└─────────┘
```

---

## Root Cause 1: CONVERGENT REASONING

**Definition:** Identically-trained agents independently arrive at identical strategies, which when executed simultaneously produce the worst possible collective outcome.

**Primary evidence:** DPBench (2602.13255)
- Sequential mode: 0% deadlock (GPT-5.2, N=5)
- Simultaneous mode: 25-95% deadlock — same model, same problem
- Root: All agents reason through the same problem with the same training and arrive at the same "rational" strategy (e.g., "grab right fork first")
- When ALL agents do the same "rational" thing simultaneously → guaranteed deadlock
- **This is NOT a reasoning error.** Each agent's strategy is individually optimal. The failure is collective.

**Corroborating evidence:**
- **Coordination Gap** (2603.05789): Q-learning agents learn convergent policies that achieve *worse* coordination than random. The learned strategies are individually reasonable but collectively catastrophic.
- **LM Teams** (2603.12229): Homogeneous teams show faster plateaus than heterogeneous compositions, consistent with convergent reasoning limiting strategy diversity.
- **Hybrid Human-Agent** (2603.11834): When all agents adopt the same optimal individual strategy (PST), congestion maximizes. Cooperation requires *asymmetric* behavior.

**The Paradox:** The better LLMs get at individual reasoning, the MORE susceptible they are to convergent reasoning failure. Smarter agents converge more reliably on the same strategy.

**Quantitative severity:**
| Setting | Deadlock/Failure Rate |
|---------|----------------------|
| DPBench N=3 simultaneous | 95-100% |
| DPBench N=5 simultaneous + comms | 65% |
| Coordination Gap Q-learning | Worse than random baseline |

---

## Root Cause 2: INTEGRATION FAILURE

**Definition:** Agents successfully acquire and communicate necessary information but systematically fail to synthesize distributed state into correct collective outputs.

**Primary evidence:** Silo-Bench (2603.01045)
- Agents spontaneously form appropriate topologies (star, ring)
- Agents actively share relevant information
- **But:** Success drops from ~75% (simple aggregation) to ~15% (global state integration)
- The failure is localized to the *reasoning-integration stage* — not communication

**Corroborating evidence:**
- **Teams Hold Experts Back** (2602.01011): The team has access to expert knowledge (the expert explicitly shares it) but integrates via **averaging/compromise** rather than appropriate weighting. Expert leveraging fails even when expert is identified. Performance loss: up to 37.6%.
- **Hanabi** (2601.18077): Hint efficiency varies from <1 to 2.5 points per hint. Inefficient agents receive hints but fail to integrate them into correct play decisions.
- **LM Teams** (2603.12229): Decentralized teams produce concurrent writes and rewrites — agents cannot integrate awareness of teammates' parallel work.

**The Key Insight:** Integration failure is NOT a communication problem. Adding more communication makes it worse (DPBench: 2.6x more deadlock with communication). The bottleneck is in **reasoning over distributed information**, not in acquiring it.

**Scaling behavior:** Integration failure worsens super-linearly with the amount of distributed state:
- Silo-Bench Low complexity (simple aggregation): ~75% success
- Silo-Bench Medium complexity (multi-hop): ~40% success
- Silo-Bench High complexity (global state): ~15% success

---

## Root Cause 3: THEORY-OF-MIND (ToM) FAILURE

**Definition:** Agents cannot accurately model what other agents know, intend, or will do, leading to misaligned actions and wasted coordination efforts.

**Primary evidence:** Hanabi (2601.18077)
- **Egocentric hinting:** Agents give hints based on what THEY see, not what the RECIPIENT needs
- Agent tells partner about cards the partner can already observe while ignoring cards the partner can't see
- 2-player score drops from ~17 to ~8 when scaled to 5 players
- This is a pure ToM failure: inability to model other's epistemic state

**Corroborating evidence:**
- **ToM/Internal Beliefs** (2603.00142): BDI architecture with explicit ToM module. Results are **model-dependent**:
  - GPT-3.5-Turbo: ToM+IB improves scores 27.50 → 33.34 (+21%)
  - GPT-4o: ToM barely helps (69.44 → 70.56) — already implicitly modeling others
  - Llama 3.1 8B: ToM+IB **hurts** performance (35.00 → 30.02, −14%) — model gets confused by its own ToM reasoning
- **DPBench** (2602.13255): Message-action consistency only 29-44%. Agents SAY one thing and DO another — they cannot model how their messages will be interpreted and acted upon.
- **EmCoop** (2603.00349): Agents fail at participation constraints — they don't model whether other agents will show up at the right time and place.

**The ToM Paradox:** Explicit ToM mechanisms (predicting what others will do) help strong models and hurt weak models. Below a capability threshold (~GPT-4o level), the computational overhead of ToM reasoning exceeds its coordination benefit. **ToM is a capability amplifier, not a capability replacement.**

---

## Root Cause 4: COMMUNICATION OVERHEAD

**Definition:** The cost of coordinating agent activities — in tokens, latency, and cognitive load — grows faster than the coordination benefit, eventually making teams worse than individuals.

**Primary evidence:** LM Teams as Distributed Systems (2603.12229)
- **Amdahl's Law holds:** Speedup ceiling = 1/((1-p) + p/s) where p = parallelizable fraction
- Even highly parallel tasks (90% parallelizable) plateau below theoretical bound
- Decentralized 5-agent teams: **5.83x token cost for only 1.13x speedup** on serial tasks
- Decentralized teams routinely achieve speedup < 1.0 (slower than single agent!)
- O(n²) message scaling in decentralized configurations

**Corroborating evidence:**
- **Silo-Bench** (2603.01045): "Coordination overhead compounds with agent count, eventually eliminating parallelization gains entirely." With 8+ agents, performance is strictly worse than single-agent for ALL tasks.
- **DPBench** (2602.13255): Communication increases deadlock 2.6x! Messages arrive one timestep late, creating timing mismatches. The communication channel itself becomes a coordination problem.
- **Hanabi** (2601.18077): Limited hint budget (8 tokens shared) forces communication efficiency. Models wasting hints on redundant info perform worst.
- **WideSeek-R1** (2602.04634): Untrained multi-agent systems show width scaling peaking then **declining** at 10 subagents as noise from conflicting responses overwhelms the lead agent.

**The Communication Paradox:** In DPBench, communication makes coordination WORSE. This is because:
1. Messages arrive asynchronously (one timestep late)
2. Agents update beliefs based on messages but haven't acted yet → stale info
3. Message-action consistency is only 29-44% → signals are unreliable
4. More messages = more conflicting signals to integrate (amplifies Integration Failure)

---

## Root Cause 5: SCALE ANTI-SCALING

**Definition:** Adding more agents degrades rather than improves collective performance, contrary to the intuition that "more agents = more capability."

**Primary evidence (multiple papers converge):**

| Paper | Finding | Scale Effect |
|-------|---------|-------------|
| **Silo-Bench** | 8+ agents strictly worse than 1 agent | Monotonic degradation |
| **LM Teams** | Decentralized 5-agent speedup ≈ 0.88x | Worse than individual |
| **Teams Hold Experts Back** | Larger teams show MORE integrative compromise | Expert dilution scales linearly |
| **Hanabi** | 2→5 players: top models drop from ~17 to ~8 | Performance halved |
| **DPBench** | N=3 HARDER than N=5 (counterintuitive) | Non-monotonic! |
| **WideSeek (untrained)** | Peaks at ~5, declines at 10 subagents | Inverted-U |
| **Coordination Gap** | Q-learning with more agents → worse ALT scores | Worse than random |

**The DPBench Counter-Example:** Intriguingly, DPBench shows N=3 is HARDER than N=5 for simultaneous coordination (95% vs 25% deadlock). With fewer agents in a symmetric game, the probability of ALL choosing identically is higher. This suggests the anti-scaling relationship is non-monotonic and task-structure-dependent.

**Formal model from LM Teams:** Let O(n) = coordination overhead for n agents, P(n) = parallelization benefit. Then:
- Net benefit = P(n) - O(n)
- P(n) is bounded by Amdahl's Law: P(n) ≤ 1/((1-p) + p/n)
- O(n) grows as O(n²) for decentralized teams
- **There exists a critical n* beyond which O(n) > P(n)** — adding agents makes things worse

---

## The Interaction Effects: How Root Causes Compound

The five root causes don't operate independently. They form amplifying loops:

```
Convergent Reasoning ──→ Scale Anti-Scaling
     │                        ↑
     │                        │
     ▼                        │
Communication Overhead ──────┘
     │
     ▼
Integration Failure ←───── ToM Failure
     │                        ↑
     │                        │
     └────────────────────────┘
```

### Loop 1: Convergence × Communication × Scale
More agents → more messages → more conflicting signals → harder integration → worse outcomes → adding more agents doesn't help → Scale Anti-Scaling

### Loop 2: ToM × Integration
Poor ToM → agents send unhelpful messages → receivers can't integrate → worse outcomes → agents with worse outcomes have less useful state to model → ToM degrades further

### Loop 3: Convergence × Scale (DPBench's paradox)
More homogeneous agents → higher convergence probability → more deadlocks. But also: more agents → more noise → occasional heterogeneity → fewer deadlocks. These opposing forces create the non-monotonic relationship seen in DPBench.

---

## The Three Paths That Work

Across all 11 papers, only THREE approaches successfully overcome the coordination failure taxonomy:

### Path 1: END-TO-END MARL TRAINING (WideSeek-R1)

**What it does:** Train the entire multi-agent system jointly via reinforcement learning, so agents learn complementary (not convergent) strategies.

**Evidence:**
- WideSeek-R1-4B (MARL-trained) ≈ DeepSeek-R1-671B (single agent) at **170× fewer parameters per agent**
- Untrained width scaling peaks then declines; MARL-trained width scaling shows **monotonic improvement** up to 10 subagents
- MARL eliminates convergent reasoning by training agents to produce complementary outputs
- Dual-level advantage reweighting prevents lead agents from spawning excessive subagents

**Why it works:** MARL directly addresses Root Cause 1 (Convergent Reasoning) by training agents to produce DIVERSE, complementary strategies. It addresses Root Cause 5 (Scale Anti-Scaling) by making each additional agent genuinely useful. It indirectly addresses Root Cause 2 (Integration Failure) because the lead agent learns HOW to integrate subagent outputs.

**Limitation:** Requires verifiable outcome rewards. Currently demonstrated only for information retrieval tasks. Unclear if it generalizes to open-ended creative tasks.

### Path 2: ARCHITECTURAL SEPARATION (Centralized Orchestration + Context Isolation)

**What it does:** Assign tasks centrally, isolate agent contexts, and use a centralized aggregation mechanism rather than peer-to-peer coordination.

**Evidence:**
- **LM Teams**: Centralized (preassigned) teams achieve 1.36x speedup vs 0.88x for decentralized. Fewer consistency violations, lower token costs.
- **WideSeek-R1**: Context isolation (each subagent gets fresh context) eliminates context pollution that degrades single-agent depth scaling.
- **Schema-Gated AI** (from our governance stack synthesis): Structural separation of authorities prevents coordination confusion.

**Why it works:** Centralization eliminates Root Cause 4 (Communication Overhead) by replacing O(n²) peer-to-peer with O(n) hub-spoke. Context isolation prevents Root Cause 2 (Integration Failure) by keeping each agent's reasoning clean. Preassignment prevents Root Cause 1 (Convergent Reasoning) by giving agents different subtasks.

**Limitation:** Vulnerable to stragglers (one slow agent blocks the team). Requires a capable orchestrator. Reduces fault tolerance vs decentralized approaches.

### Path 3: LEARNED CONVENTIONS + HETEROGENEOUS COMPOSITION

**What it does:** Train agents to develop implicit coordination protocols and compose teams of diverse (different model/architecture) agents.

**Evidence:**
- **Hanabi**: RL-finetuned 7B models develop implicit conventions ("always hint leftmost playable card") that match GPT-4o performance. Conventions generalize to RL-trained partners but NOT to base LLM partners.
- **LM Teams**: Claude Sonnet 4.6 alone did not significantly plateau below Amdahl bound (p=0.45), suggesting model-specific coordination capabilities. Heterogeneous teams plateau slower.
- **DPBench**: The only way to break deadlock in simultaneous mode is heterogeneous behavior — agents must choose DIFFERENT strategies.
- **Hybrid Human-Agent**: Intrinsic reward mechanisms using only globally observable signals can shift evolutionary dynamics toward cooperation.

**Why it works:** Heterogeneity directly breaks Root Cause 1 (Convergent Reasoning). Learned conventions address Root Cause 3 (ToM Failure) by replacing explicit mental modeling with implicit protocol following. However, this introduces a new risk: **convention mismatch** when agents with different conventions are composed.

**Limitation:** Convention mismatch between differently-trained agents is catastrophic (Hanabi: RL agent + base LLM = worse than either alone). Requires careful composition management.

---

## Quantitative Summary: The Coordination Failure Landscape

| Root Cause | Worst Case Observed | Best Mitigation | Residual After Mitigation |
|------------|--------------------|-----------------|-----------------------------|
| Convergent Reasoning | 100% deadlock (DPBench N=3) | MARL training (WideSeek) | Monotonic scaling improvement |
| Integration Failure | ~15% success at high complexity (Silo-Bench) | Context isolation + centralized aggregation | 3.35x speedup at 1.33x cost (LM Teams best case) |
| ToM Failure | 50% performance drop 2→5 players (Hanabi) | RL-learned conventions (Hanabi) | Matches GPT-4o at 7B parameters |
| Communication Overhead | 5.83x cost for 1.13x speedup (LM Teams) | Hub-spoke architecture | O(n) instead of O(n²) |
| Scale Anti-Scaling | Monotonically worse beyond 8 agents (Silo-Bench) | MARL-trained width scaling | Monotonic improvement to 10+ agents |

---

## The Measurement Problem

**The Coordination Gap paper (2603.05789) reveals a meta-failure:** conventional metrics (Fairness, Efficiency) CANNOT detect coordination failure.

- Random policies achieve Fairness ≈ 0.97, Efficiency ≈ 0.82
- Q-learning agents report similar aggregate scores — but achieve WORSE temporal coordination than random
- **Implication:** Many published claims of "successful multi-agent coordination" may be measurement artifacts

The six ALT (Alternation) metrics proposed by the Coordination Gap paper provide a corrective:
- **Coordination Score** = (ALT_observed − ALT_random) / (ALT_perfect − ALT_random) × 100
- Negative scores = worse than random
- Q-learning consistently scores NEGATIVE on these metrics

**This connects to the Controllability Trap (from Cross-Ref #15):** Just as CQS reveals that human oversight degrades over time despite appearing functional, ALT metrics reveal that agent coordination degrades despite appearing successful by conventional measures.

---

## Open Questions

### 1. Is There a Minimum Viable Team?
Given the five root causes and three mitigation paths, what is the **minimum team size** that reliably outperforms a single agent? The evidence suggests:
- Centralized architecture: 2-3 agents on highly parallel tasks
- MARL-trained: scales to 10+ (WideSeek)
- Untrained/decentralized: often **no team size** beats single agent

### 2. Can Convergent Reasoning Be Broken Without Training?
DPBench shows that communication and prompt engineering cannot overcome convergent reasoning. WideSeek shows MARL can. Is there a middle ground — e.g., strategic persona diversity, random strategy injection, or explicit asymmetry assignment?

### 3. The Convention Composability Problem
Hanabi shows RL conventions don't transfer to base LLM partners. As the ecosystem grows with independently-trained agents, how do we ensure interoperability? This parallels the protocol design problem in distributed systems (and connects to our EPOCH/SSGM/GNAP synthesis).

### 4. Integration Failure at Frontier Scale
Silo-Bench tests up to ~8 agents. WideSeek tests up to 10. What happens at 50? 100? Does MARL-trained width scaling continue monotonically, or is there a second plateau?

### 5. The Emotional Amplification Risk
The Emotional Modulation paper shows that affect dynamics can hijack collective decisions — a more "enthusiastic" agent can snowball support for inferior options. In LLM teams, persona/tone might inadvertently function as emotional modulation, biasing team decisions. Is this happening in current multi-agent systems?

---

## Implications for Koda/Multi-Agent System Design

### 1. Default to Single Agent Unless You Have a Specific Reason Not To
The evidence overwhelmingly shows that untrained multi-agent teams are *worse* than single agents for most tasks. Multi-agent should be a justified architectural choice, not a default.

### 2. If Multi-Agent, Use Centralized Architecture with Context Isolation
LM Teams' finding is definitive: centralized preassignment beats decentralized self-organization on both speed and cost. WideSeek's context isolation pattern prevents the cross-contamination that degrades depth scaling.

### 3. If Training Budget Available, Use MARL
WideSeek demonstrates that end-to-end MARL training transforms multi-agent from "usually worse" to "reliably better." The 170× parameter efficiency result is extraordinary — but requires verifiable rewards.

### 4. Never Assume More Agents = Better
The scale anti-scaling evidence is consistent across 7 independent papers. Every additional agent must justify its coordination overhead. Build in metrics to detect when adding agents is counterproductive.

### 5. Use ALT Metrics, Not Aggregate Metrics
The Coordination Gap paper's finding — that conventional metrics cannot detect coordination failure — has immediate practical implications. If you're measuring multi-agent coordination, you need temporally-aware metrics.

### 6. Beware Convention Mismatch in Heterogeneous Teams
Heterogeneity breaks convergent reasoning but introduces convention mismatch risk. If composing agents from different training pipelines, test compatibility explicitly.

---

## Connection to Cross-Reference #15 (Governance Enforcement Stack)

The Coordination Failure Taxonomy and the Governance Enforcement Stack are complementary:
- **Governance Stack = how to constrain what agents DO**
- **Coordination Failure Taxonomy = why agents fail when working TOGETHER**

Key overlap:
- Governance Layer 4 (Orchestration) directly addresses Root Causes 2 and 4
- Governance Layer 5 (Execution Gates) prevents individual failures from cascading (breaks amplifying loops)
- The META layer (CQS) connects to the Measurement Problem — both show that conventional metrics miss critical degradation

**A production multi-agent system needs BOTH:** governance to constrain individual behavior AND coordination architecture to enable collective behavior.

---

*Filed: 2026-04-03 | Scout Cross-Reference #16 | 11 papers synthesized across 5 root causes + 3 mitigation paths*
*Portfolio: 197 deep-dives + 16 cross-reference syntheses*
