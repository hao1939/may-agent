# Deep Dive: The Coordination Gap — Alternation Metrics for Temporal Dynamics in Multi-Agent Battle of the Exes

**Paper:** arXiv:2603.05789v2 (10 Mar 2026)
**Authors:** Nikolaos Al. Papadopoulos, Konstantinos E. Psannis (University of Macedonia, Thessaloniki)
**Venue:** Mathematical Social Sciences
**Code:** https://github.com/dentros/Alternation

## TL;DR
Traditional fairness and efficiency metrics are **temporally blind** — they cannot distinguish structured turn-taking from monopolistic or random access patterns in multi-agent coordination. The authors propose 6 novel Alternation (ALT) metrics that explicitly capture temporal coordination quality, and show that Q-learning agents achieve **worse coordination than random baselines** despite reporting high traditional metrics (Fairness > 0.90, Efficiency > 0.82).

## Core Problem: Measurement Failure in Multi-Agent Coordination

The paper formalizes a critical gap: **high aggregate payoffs can coexist with poor temporal coordination**, and conventional metrics severely mischaracterize emergent dynamics. This is demonstrated through a Multi-Agent Battle of the Exes (MBoE) game — a coordination game where optimal collective behavior requires periodic turn-taking.

### The Measurement Failure
- Random policies achieve **Efficiency ≈ 0.82** and **Fairness ≈ 0.97** in 2-agent systems
- Even with 5 agents, random policies maintain **Efficiency ≥ 0.532** and **Fairness ≥ 0.927**
- These values would normally be interpreted as "successful coordination"
- But there is **zero learned coordination** — it's pure chance!

## Key Contributions

### 1. Multi-Agent BoE Formalization
- Formalizes the Battle of the Exes as a **Markov game** for n ≥ 2 agents
- Agents compete for exclusive access to a high-reward terminal state
- If exactly 1 agent arrives: r_high (100); if 1 < k < n arrive: r_low; if all n arrive: 0
- Optimal collective behavior = **periodic turn-taking** across all n agents

### 2. Perfect Alternation (PA) Reference Regime
- Defines PA: each of n agents reaches highest-payoff state exactly once per n-episode block
- Serves as calibration benchmark (ALT = 1.0 under PA)
- PA is Pareto-optimal under strict rotation

### 3. Six ALT Metrics (Tolerant → Strict)
| Metric | Formula | Character |
|--------|---------|-----------|
| **FALT** (Fractional) | f_j / τ_j | Most tolerant; unique winners / terminal occurrences |
| **qFALT** (Quadratic) | (FALT)² | Quadratic penalty on FALT |
| **EALT** (Exclusive) | w_j · f_j / n² | Emphasizes exclusivity (single winners) |
| **qEALT** (Quadratic Exclusive) | (EALT)² | Stricter exclusivity |
| **CALT** (Complete) | Primary metric; explicitly penalizes ties |
| **AALT** (Absolute) | g_j / τ_j | Strictest; only agents with exactly 1 exclusive win |

All metrics: bounded [0,1], = 1 under PA, degrade monotonically under monopolization/ties.

### 4. Random Baseline as Null Process
Establishes random policies as **statistical null hypothesis** for coordination:
- **Coordination Score** = (ALT_observed − ALT_random) / (ALT_perfect − ALT_random) × 100
- **Relative Change** = (ALT_observed − ALT_random) / ALT_random × 100
- Negative scores = worse than random

### 5. Devastating Results for Q-Learning

| Agents | Random CALT | Q-Learning CALT | Coordination Score |
|--------|-------------|-----------------|-------------------|
| 2 | 0.486 | ~0.45 | **Negative** |
| 3 | 0.359 | ~0.14 | **Negative** |
| 5 | 0.243 | Lower | **Negative** |
| 8 | 0.147 | Lower | **Negative** |
| 10 | 0.111 | Lower | **Negative** |

**All coordination scores are negative** — Q-learning performs WORSE than chance across all agent counts!

### 6. Anti-Coordination During Learning
- CALT values **decrease during training** as epsilon decays
- Convergence to deterministic policies **interferes with alternation**
- Traditional efficiency follows different trend — doesn't track CALT
- Exploration (high epsilon) actually produces better coordination than exploitation

## Why Four Traditional Metrics Fail

| Metric | Blind To | Failure Mode |
|--------|----------|-------------|
| **Fairness** (min/max wins) | Intermediate agents, temporal order | Ignores all but 2 agents |
| **Efficiency** (total reward / max) | Who gets reward, when | Monopoly looks identical to rotation |
| **TT Fairness** (min/max terminal arrivals) | Collision vs. genuine turns | Ties inflate the count |
| **Reward Fairness** (min/max cumulative payoff) | Temporal structure | Only informative at (Eff=1, RF=1) corner |

**Combined** they still cannot distinguish: structured alternation vs. random access vs. subgroup monopoly

## Connections to Scout Portfolio

### Direct Connections
1. **VMAO (2603.11445)**: VMAO uses Plan-Execute-Verify-Replan but never checks *temporal coordination quality*. ALT metrics could detect if VMAO's task allocation creates monopolistic patterns.

2. **MoLT Dynamics (2603.03555)**: MoLT tracks emergent social phenomena — ALT metrics provide the missing measurement framework for temporal fairness in emergent group dynamics.

3. **DPBench (2602.13255)**: DPBench tests simultaneous coordination — the Coordination Gap paper shows DPBench's fairness metrics may be temporally blind too.

4. **NormCoRe (2603.11974)**: Norms in multi-agent AI require temporal fairness measurement. ALT metrics operationalize what "fair coordination norms" actually mean.

5. **Grand Unified Synthesis — Law 5 (Coordination Overhead Grows Superlinearly)**: This paper provides formal metrics proving the law — CALT drops from 0.486 → 0.111 as agents scale 2 → 10.

### Thematic Connections
- **Observation Collapse**: Traditional metrics create an "observation collapse" — everything looks coordinated when it isn't
- **Degradation Pattern 4 (Fairness Erosion)**: ALT metrics formally quantify this degradation
- **The Bureaucracy of Speed (2603.09875)**: Both papers reveal hidden costs in multi-agent coordination invisible to naive metrics

## Critical Assessment

### Strengths
- **Foundational measurement contribution**: Exposes a genuine blind spot in how the entire field evaluates multi-agent coordination
- **Rigorous formalization**: Six metrics with clear axioms, calibration, and null baselines
- **Devastating result**: Q-learning worse than random is a wake-up call for MARL evaluation
- **Scalability analysis**: Tests across n ∈ {2, 3, 5, 8, 10} agents

### Limitations
- Only tests Q-learning (tabular, independent) — doesn't test modern MARL algorithms (MAPPO, QMIX, etc.)
- BoE is a specific game structure — unclear if ALT metrics generalize to arbitrary coordination tasks
- No LLM-based agents tested — connection to LLM MAS is conceptual, not empirical
- Perfect Alternation may be too strict as a reference for real-world tasks where variable access is desirable

### Open Questions
- Do modern MARL algorithms (with communication) also fail on ALT metrics?
- Can ALT metrics be adapted for LLM-based multi-agent systems?
- What does CALT look like for VMAO-style orchestrated systems?
- Is there a "minimum viable alternation" threshold below which coordination is effectively random?

## Scout Rating: ★★★★☆ (HIGH VALUE)

**Why not 5 stars**: The paper uses classical MARL (Q-learning), not LLM agents, and the BoE game is relatively simple. But the **measurement insight is profound and generalizable**: if you're only measuring outcome-level fairness/efficiency in multi-agent systems, you're probably missing coordination failure.

## Key Takeaway for MAS Design

> **"High fairness metrics + high efficiency ≠ coordination."** Any multi-agent system evaluation that relies solely on aggregate outcome metrics may be hiding temporal coordination failure. ALT-style temporally-aware metrics are necessary to detect whether agents are genuinely coordinating or just getting lucky.

## Tags
`coordination-metrics` `temporal-fairness` `measurement-failure` `MARL` `turn-taking` `alternation` `game-theory` `Q-learning` `random-baseline` `coordination-gap`
