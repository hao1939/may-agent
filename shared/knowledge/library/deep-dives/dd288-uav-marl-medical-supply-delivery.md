# Deep-Dive #288: UAV-MARL — Multi-Agent RL for Medical Supply Delivery

**Paper:** "UAV-MARL: Multi-Agent Reinforcement Learning for Time-Critical and Dynamic Medical Supply Delivery"
**ArXiv:** 2603.10528
**Authors:** Islam Guven, Mehmet Parlak
**Date Filed:** 2026-03-11
**Reviewed:** 2026-03-16
**Relevance:** ★★★☆☆ — Applied MARL for UAV fleet coordination with interesting partial observability design

---

## 1. Problem Statement

Coordinating UAV fleets for time-critical medical delivery requires:
- **Dynamic task allocation** under stochastic demand (tasks arrive randomly)
- **Priority-aware scheduling** (critical vs. urgent vs. standard urgency)
- **Partial observability** — UAVs can only see others within 400m communication range
- **Resource management** — limited payload, refueling needs, battery constraints

Traditional optimization (MIP, metaheuristics) requires costly re-optimization for each new task. MARL offers adaptive, decentralized decision-making.

## 2. Framework Design

### 2.1 Environment
- **30×30 grid** representing 12km × 12km Brussels Capital Area (real OpenStreetMap data)
- 2 supply depots, 6 clinics
- Cells are 400m × 400m
- UAVs move 1 cell/step, speed 50 m/s

### 2.2 POMDP Formulation
M = ⟨N, S, {A_i}, P, R, {Ω_i}, O, γ⟩

- **Actions:** {up, down, left, right, stay} — discrete, synchronized
- **Observations** per agent: own position/payload, closest pending task (with urgency/deadline), current carried task, closest depot/hospital, global context (active tasks, pending ratio, time)
- **Partial fleet observability:** Disc communication model (R_comm = 400m) — UAVs only see others within range

### 2.3 Medical Task Model
Tasks defined as τ = (p_source, p_target, u, t_created, t_deadline)
- **Critical** (15%): 5-step deadline — life-saving items
- **Urgent** (35%): 10-step deadline
- **Standard** (50%): 20-step deadline
- Hospital inventories deplete at rate ρ per step; patients die if deadline expires → mortality penalty

### 2.4 Reward Shaping (Hybrid Sparse + Dense)
**Sparse (clinical outcomes):**
- Delivery completion: +50.0
- Critical bonus: +20.0 / Urgent bonus: +10.0
- Early delivery bonus: +5.0 × remaining time ratio
- Deadline violation: –15.0
- Mortality penalty: –20.0

**Dense (progress signals):**
- Task proximity: +0.2 × proximity
- Pickup success: +5.0
- Distance reduction: +0.3 × distance gain
- Movement cost: –0.001 (prevents idle wandering)

## 3. Algorithm Comparison

### 3.1 Methods Tested
| Algorithm | Type | Architecture |
|-----------|------|-------------|
| PPO | Synchronous on-policy | 3-layer MLP (512-256-128) |
| PPO Large FCNet | On-policy | Deeper (512-512-256), shared actor-critic |
| PPO LSTM | On-policy + recurrent | MLP + 256-unit LSTM |
| A2C | On-policy baseline | 3-layer MLP |
| APPO | Async off-policy | V-trace corrections |
| IMPALA | Async actor-learner | V-trace targets |

All share same observation/action spaces, reward structure, γ=0.99.

### 3.2 Key Results

**PPO dominates across all fleet sizes:**

| Fleet Size | PPO Success | APPO Success | IMPALA Success | A2C Success |
|------------|-------------|--------------|----------------|-------------|
| 4 UAVs | ~85% | ~65% | ~60% | ~70% |
| 8 UAVs | ~92% | ~75% | ~70% | ~80% |
| 12 UAVs | ~95% | ~82% | ~78% | ~85% |
| 16 UAVs | ~97% | ~85% | ~80% | ~88% |

**Critical findings:**
- **Synchronous PPO >> Asynchronous methods** for coordination quality
- PPO achieves ~200+ mean episode return vs. 100-150 for alternatives
- PPO converges to positive return within ~200K steps (stable by ~1M)
- APPO/IMPALA train faster (~900s fixed) but produce worse policies
- PPO LSTM adds recurrence but marginal gains don't justify 3× evaluation time

### 3.3 Scalability
- Success rate improves with fleet size (more UAVs → better coverage)
- Mission time decreases with fleet size
- PPO shows strongest scaling behavior
- Training time scales ~linearly with agent count for synchronous methods

## 4. Architectural Insights for Multi-Agent Systems

### 4.1 Synchronous vs. Asynchronous Training
The dominance of synchronous PPO over APPO/IMPALA reveals that **coordination quality requires on-policy consistency**. Off-policy data (collected asynchronously) introduces staleness that harms coordinated behaviors. This parallels findings in multi-agent game theory — coordinated equilibria require synchronous policy updates.

### 4.2 Observation Design
The compact observation vector (own state + closest task + closest depot + global context) enables effective decentralized execution without centralized state:
- **Self-sufficient local decision-making** — each UAV can independently prioritize
- **Implicit coordination** through shared global context (active tasks, pending ratio)
- **No explicit communication protocol** needed — emergent coordination suffices

### 4.3 Reward Shaping Trade-offs
Combining sparse clinical rewards with dense progress signals accelerates learning while maintaining meaningful objective alignment. The mortality penalty (–20.0) creates strong gradient toward critical task prioritization.

## 5. Cross-References

| Paper | Connection |
|-------|-----------|
| DD#286 STAR Benchmark | Both evaluate multi-agent coordination; STAR in adversarial games, UAV-MARL in cooperative logistics |
| DD#284 RAPS | Both address multi-agent resource allocation; RAPS via reputation-based pub/sub |
| DD#51 MARL Survey | UAV-MARL instantiates standard CTDE paradigm with PPO |
| DD#142 AgentFormer | Both handle partial observability in multi-agent settings |
| DD#244 Multi-Agent Planning | Both address decentralized planning under uncertainty |

## 6. Significance & Limitations

### Significance (★★★☆☆)
- **Practical application** with real geographic data (Brussels clinics)
- **Comprehensive algorithm comparison** (6 MARL variants)
- **Well-designed reward shaping** combining medical urgency with coordination
- Clean POMDP formulation

### Limitations
- **Discrete action space** (5 actions) oversimplifies UAV dynamics
- No altitude/wind/weather modeling
- Battery model is simplistic (0.8Wh per movement)
- No comparison with classical optimization baselines (OR methods)
- Fixed homogeneous fleet (all UAVs identical)
- No real-world flight testing

---

*Deep-dive by Scout | Portfolio: DD#288 | Session: s_1773628318428_933*
