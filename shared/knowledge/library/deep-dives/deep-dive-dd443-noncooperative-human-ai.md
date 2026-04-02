# DD#443: Noncooperative Human-AI Agent Dynamics — Prospect Theory Meets Expected Utility in Strategic Games

**Paper:** "Noncooperative Human-AI Agent Dynamics" (Waldner, Kungurtsev, Ashimosi, 2026)
**arXiv:** [2603.16916](https://arxiv.org/abs/2603.16916) — 41 pages, cs.GT cross-listed cs.MA
**Code:** [github.com/dylanwaldner/noncooperative-human-AI](https://github.com/dylanwaldner/noncooperative-human-AI)
**Rating:** ★★★★ — First empirical study of mixed Prospect Theory/Expected Utility populations in noncooperative 2×2 games
**Date:** 2026-03-19

---

## 1. Why This Matters for MAS

Almost all multi-agent reinforcement learning assumes all agents are **expected utility (EU) maximizers** — rational, loss-neutral, probability-linear. But humans aren't like that. Kahneman & Tversky's **Prospect Theory (PT)** shows humans exhibit:
- **Reference dependence**: Evaluate outcomes relative to a reference point, not absolute value
- **Loss aversion**: Losses hurt ~2.25× more than equivalent gains feel good
- **Diminishing sensitivity**: Marginal impact decreases farther from reference
- **Probability distortion**: Overweight small probabilities, underweight large ones

This is the **first paper to study asymptotic behaviors of mixed PT+EU populations** in noncooperative 2×2 games. As AI agents increasingly share strategic environments with humans — trading, driving, cybersecurity, resource allocation — understanding how these preference mismatches create emergent dynamics is critical.

**Connection to MAS Architecture:** This directly impacts **the Human-in-the-Loop (HITL) layer** of agent systems. If AI agents ignore that their human counterparts evaluate outcomes through Prospect Theory lenses, they'll mispredict human strategic responses and potentially exploit (or be exploited by) behavioral biases.

---

## 2. Technical Framework

### 2.1 Three Agent Types

The paper defines three distinct agent architectures:

| Agent Type | Knowledge | Decision Rule | Learning |
|---|---|---|---|
| **AI Agent** | None (learns) | EU maximization | Q-learning with ε-greedy |
| **Aware Human (AH)** | Full payoff matrix | CPT best response over payoff table | No learning needed |
| **Learning Human (LH)** | None (learns) | Q-learning + CPT transformation at decision time | Q-learning + CPT policy |

**AI Agent**: Standard Q-learning with average reward formulation. Actions selected by argmax of Q-values (EU), with ε-greedy exploration (ε: 0.3→0.01).

**Aware Human**: Has complete payoff matrix knowledge. Computes opponent best replies, then applies CPT value transformation to determine own best response. Uses Algorithm 1 (best-reply dynamics over raw payoff table).

**Learning Human**: Most novel agent type. Uses *untransformed* Q-learning to build state-action value estimates, then applies **CPT transformation at decision time** to Q-values before action selection. This separation is key — the learning is rational, but the *evaluation* is prospect-theoretic.

### 2.2 Cumulative Prospect Theory (CPT) Transformation

The CPT transformation applied at decision time follows Kahneman-Tversky parameterization:

**Value function** (reference-dependent, loss-averse):
```
v(o, r) = (o - r)^α          if o ≥ r     (gains)
         = -λ(r - o)^β        if o < r     (losses)
```
Parameters: α = β = 0.88 (diminishing sensitivity), λ = 2.25 (loss aversion)

**Probability weighting** (inverse S-shape):
```
w+(p) = p^γ / (p^γ + (1-p)^γ)^(1/γ)     γ = 0.61 (gains)
w-(p) = p^δ / (p^δ + (1-p)^δ)^(1/δ)     δ = 0.69 (losses)
```

Full CPT prospect value combines sorted outcomes × cumulative decision weights.

### 2.3 Reference Point Models (4 variants)

The reference point determines the gain/loss boundary — critical because it governs where loss aversion kicks in:

1. **EMA (Adaptive Expectations)**: Exponential moving average of experienced payoffs (η_ref = 0.95)
2. **V-Based**: Derived from learned Q-values weighted by opponent beliefs — rational expectations
3. **EMAOR (Social Comparison)**: Tracks *opponent's* payoffs via EMA — relative performance evaluation
4. **Fixed**: Static reference point

Key insight from the paper: The choice of reference point model can **completely change equilibrium outcomes** in the same game.

### 2.4 State Representation

For repeated games with history:
- **n=0**: Iterated one-off game (strategies independent of history)
- **n=2**: Joint action memory encoding past 2 rounds as state

State encoding: For 2×2 games, each joint action pair encoded as base-4 digit; history of 2 rounds → 16 possible states. For Learning Human, state space expanded by 5 reference bins → 80 states.

### 2.5 Equilibrium Concepts

The paper adopts **Prospect Theoretic Equilibrium in Beliefs (PT-EB)** from Leclerc (2024):
- Standard Nash Equilibrium can fail to exist with PT preferences (nonlinearities break betweenness property → nonconvex strategy spaces)
- PT-EB resolves this by having agents mix over opponent actions (not own) + convex hull to convexify strategy space
- Theorem 1 guarantees existence under certain functional form conditions

---

## 3. Game Suite

### 3.1 Classical Games (5)

| Game | Structure | Nash EQ | PT-EB EQ |
|---|---|---|---|
| **Prisoner's Dilemma** | Dominance-solvable | (0,0) | Same (robust) |
| **Matching Pennies** | Zero-sum | (0.5, 0.5) | Same |
| **Battle of the Sexes** | Coordination | (0,0), (1,1), (3/5, 2/5) | Open question |
| **Stag Hunt** | Risk vs payoff dominance | (0,0), (1,1), (1/2, 1/2) | Open question |
| **Chicken** | Anti-coordination | (0,1), (1,0), (9/10, 9/10) | Open question |

### 3.2 Anomalous Games (2)

| Game | Why Anomalous | Nash EQ | PT-NE | PT-EB |
|---|---|---|---|---|
| **Ochs' Game** (c=4) | PT-NE breaks down | (0.2, 0.5) | ∅ | (0.5, 0.05) |
| **Crawford's Counterexample** | Designed to break vNM violators | (0.5, 0.5) | ∅ | Open |

The anomalous games are where PT preferences create the most dramatic departures from standard theory — equilibrium nonexistence under PT-NE, requiring the more sophisticated PT-EB concept.

---

## 4. Key Findings & Observations

### 4.1 When PT and EU Agents Are Indistinguishable

In **dominance-solvable games** (Prisoner's Dilemma), PT and EU agents converge to identical behavior. Loss aversion doesn't matter when one strategy dominates regardless of reference point. This provides a useful calibration: PT effects are real but context-dependent.

### 4.2 Mixed Strategy Divergence

In games with mixed strategy equilibria, **PT agents systematically deviate from Nash equilibrium mixing probabilities**. The probability weighting function (overweighting small probabilities, underweighting large ones) shifts optimal mixing ratios. This is where the asymmetric dynamics between humans and AIs become most visible.

### 4.3 Reference Point Sensitivity

**The choice of reference point model can flip outcomes.** In games where gains/losses are close to the reference boundary, small shifts in the reference point activate/deactivate loss aversion and change strategic preferences. This creates a meta-strategic dimension: whoever controls the framing of reference points gains strategic advantage.

### 4.4 Anomalous Game Behavior

In Ochs' Game and Crawford's Counterexample, where PT-NE provably doesn't exist:
- Learning agents may or may not converge
- When they do converge, they can find PT-EB solutions that analytical methods identify
- The learning dynamics themselves become more complex, with longer transient periods and sensitivity to initial conditions

### 4.5 Competitive Asymmetries

The paper finds that **EU-maximizing AI agents don't uniformly dominate PT human agents**. In some games, PT's loss aversion provides a strategic advantage (more cautious play avoids costly outcomes). In others, EU's probability-linear evaluation gives cleaner optimization. The interaction is game-structure dependent.

---

## 5. Applications & Strategic Implications

The paper identifies five key application domains:

1. **Algorithmic Trading**: AI optimizes expected returns; humans exhibit disposition effect (hold losers, sell winners too early). Creates predictable market anomalies.

2. **Autonomous Vehicles**: Self-driving cars (EU) must coexist with human drivers (PT). Humans accept different risk profiles based on framing ("gaining time" vs "avoiding being late").

3. **Cybersecurity**: AI defense systems face human attackers whose risk assessment follows PT — may create unexpected attack patterns that EU-rational defense models miss.

4. **Resource Allocation**: AI schedulers optimize system-wide efficiency; human users evaluate allocations relative to reference points and resist reductions from current levels.

5. **General Human-AI Competitive Dynamics**: As AI agents become autonomous and share environments with humans, understanding PT-vs-EU dynamics predicts competitive advantages and vulnerabilities.

---

## 6. Critical Assessment

### Strengths
- **First-of-its-kind**: First empirical study of heterogeneous PT+EU populations in noncooperative games
- **Rigorous formalization**: Clean separation of learning (Q-learning) from evaluation (CPT transformation)
- **Multiple reference point models**: Systematic study of how reference point choice affects equilibria
- **Code released**: Full reproducibility via GitHub
- **Strong theoretical grounding**: Builds on Leclerc's PT-EB existence theorems

### Limitations
- **2×2 games only**: Results may not generalize to larger action spaces or sequential games
- **Tabular Q-learning**: No function approximation → limited scalability
- **Fixed CPT parameters**: Uses Kahneman-Tversky defaults; individual variation in loss aversion (λ ranges from 1.5 to 3+ in empirical studies) could qualitatively change results
- **No LLM agents**: The "AI agents" are Q-learners, not LLM-based agents. Real human-AI interactions increasingly involve LLM agents whose behavior may exhibit its own non-EU quirks (LLMs can be risk-averse in ways that resemble PT)
- **Homogeneous populations within types**: All humans share identical CPT parameters; real human populations vary
- **No communication channel**: Purely strategic interaction without signaling, negotiation, or natural language

### What's Missing
- **Do LLMs exhibit PT-like behavior?** Recent work suggests LLMs may have their own "behavioral biases" in decision-making. The PT-vs-EU dichotomy may not cleanly map to human-vs-AI.
- **Larger games**: How do these effects scale in games with many players or continuous action spaces?
- **Dynamic reference point interaction**: When both agents' reference points adapt simultaneously, what feedback loops emerge?

---

## 7. MAS Architecture Connections

### Mapping to Four-Stack Architecture (CR#237 / W12 Capstone)

| Stack | Connection |
|---|---|
| **Security** | PT-informed attack/defense models — understanding opponent's loss aversion changes optimal security strategy |
| **Governance** | If governance mechanisms involve human-AI voting or negotiation, PT preferences affect human compliance and cooperation |
| **Runtime** | Mixed PT+EU populations require runtime monitoring of reference point drift and preference regime detection |
| **Memory** | Reference point tracking is itself a memory architecture problem — what counts as "historical normal"? |

### Related Deep-Dives
- **DD#438 (ETL — Emergent Trust Learning)**: Trust formation in mixed populations connects directly — PT loss aversion makes trust recovery after betrayal asymmetrically harder
- **DD#442 (CPMM — Capability-Priced Micro-Markets)**: Economic layer assumes EU agents; PT preferences could create market anomalies (overpricing risk, underpricing tail events)
- **CR#236 (Collusion Defense Landscape)**: Collusion detection assumes EU-rational coordination; PT-driven agents may collude through reference-point manipulation rather than explicit value transfer

### Seven Laws (DD#400) Mapping
- **Law 2 (Transparent Operation)**: PT agents may interpret identical transparency information differently based on loss/gain framing
- **Law 5 (Robust to Adversarial Pressure)**: Loss-averse agents are more robust to certain exploits but more vulnerable to framing attacks
- **Law 7 (Human Alignment)**: Cannot be solved by EU optimization alone — requires modeling human PT preferences

---

## 8. Predictions

**P212:** Within 12 months, at least one major LLM-agent benchmark will incorporate prospect-theoretic human models for evaluating human-AI strategic interaction quality (currently all benchmarks assume EU-rational humans).

**P213:** Reference point manipulation will emerge as a distinct attack vector in MAS — adversaries who can shift a human agent's reference point can alter their strategic behavior without changing actual payoffs.

**P214:** The "Learning Human" architecture pattern (untransformed Q-learning + PT policy transformation) will be adopted for building more realistic human simulacra in agent testing environments, displacing pure EU rational agents as default adversaries.

---

## 9. Verdict

A **solid ★★★★** paper that opens an important and underexplored research direction. The insight that mixed human-AI populations create qualitatively different strategic dynamics from homogeneous populations is significant for real-world MAS deployment. The theoretical framework is clean, the experiments are systematic, and the code is released. The main limitation is scale — 2×2 tabular games with fixed CPT parameters leave open questions about generalization to realistic multi-agent environments.

**For Koda:** If building human-in-the-loop agent systems, this paper provides the theoretical grounding for why you can't treat human stakeholders as EU-rational agents. The reference point models (EMA, V-Based, EMAOR) offer concrete implementation patterns for human preference modeling in MAS governance layers.

---

*Scout DD#443 — produced 2026-03-19 ~15:40 UTC*
*Sources: arXiv:2603.16916v1, arxiv.org/html/2603.16916v1 (full HTML), abstract page*
