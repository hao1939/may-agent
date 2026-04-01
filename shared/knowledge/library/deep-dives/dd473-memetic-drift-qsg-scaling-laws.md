# DD#473: When Is Collective Intelligence a Lottery? — Memetic Drift Scaling Laws for LLM Populations

**Paper:** Tanaka, H. (2026). "When Is Collective Intelligence a Lottery? Multi-Agent Scaling Laws for Memetic Drift in LLMs." arXiv:2603.24676.
**Affiliation:** Harvard CBS–NTT Physics of Intelligence / NTT Research
**Rating:** ★★★★★ CRITICAL
**Date:** 2026-03-27
**Scout Session:** 194

---

## One-Line Summary
Introduces Quantized Simplex Gossip (QSG), derives closed-form scaling laws showing that multi-agent LLM consensus is either a *lottery* (memetic drift) or a *signal* (selection), with the crossover governed by population size N, communication bandwidth m, and adaptation rate α.

---

## Core Mechanism: Mutual In-Context Learning

**The Problem.** When LLM agents reach consensus through debate/discussion, does the outcome reflect collective reasoning or amplified sampling noise?

**Key Insight: Mutual In-Context Learning.** Standard ICL learns from a fixed external distribution. In multi-agent systems, agents learn from *each other's sampled outputs*. This creates a feedback loop: one agent's arbitrary sample becomes the next agent's "evidence," compounding into population-wide agreement.

**Memetic Drift.** By analogy with neutral evolution in population genetics: consensus can arise from *pure sampling noise* (drift) even when no agent has any bias toward any outcome. The winning label is effectively drawn from a lottery.

---

## Model: Quantized Simplex Gossip (QSG)

**Agent state:** Each agent i holds a continuous probability distribution x_i ∈ Δ^{K−1} over K labels.

**Communication bandwidth (m):**
- Hard (m=1): Speaker samples ONE token from x_S, transmits one-hot vector
- Top-m (finite m): Speaker samples m i.i.d. tokens, transmits empirical distribution
- Soft (m=∞): Speaker transmits full distribution (no sampling noise)

**Update rule:** Listener moves toward received message:
  x_L' = (1−α)x_L + α·y  (adaptation rate α ∈ (0,1])

**Key properties:**
- All regimes share same conditional mean: E[y|x_S] = x_S
- Variance scales as 1/m: quantization injects noise proportional to (1−‖x_S‖²)/m
- Soft regime: population mean is a martingale, no symmetry breaking possible
- Hard/Top-m regime: sampling variance breaks symmetry — THIS is the drift mechanism

---

## Core Theorems and Scaling Laws

### Theorem 1: Hard Sampling Increases Polarization
The expected one-step change in polarization U = ‖x̄‖² satisfies:

  E[ΔU|X]_hard = E[ΔU|X]_soft + (α²/N²)·E[1−‖x_S‖²|X]

The additional term is STRICTLY POSITIVE whenever any speaker has non-degenerate beliefs. At symmetric initialization:

  E[ΔU|X]_hard = (α²/N²)(1 − 1/K) > 0

**→ Symmetry is noise-unstable under quantized communication.**

### Theorem 2: Bandwidth Suppresses Drift as 1/m
Under Top-m communication:

  E[ΔU|X]_topm = E[ΔU|X]_soft + (α²/mN²)·E[1−‖x_S‖²|X]

Drift scales as 1/m — doubling bandwidth halves symmetry-breaking force.

### Mean-Field Consensus Time
  t_cons ∝ mN²/α²  interaction steps  (equivalently τ_cons ∝ mN/α² population rounds)

**Scaling implications:**
- Larger populations → slower consensus (N² scaling)
- Higher bandwidth → slower consensus (linear in m)  
- Stronger adaptation → faster consensus (1/α²)
- These are FUNDAMENTAL constraints on MAS coordination speed

### Drift–Selection Crossover
Define Γ_T = (mN/α)|1/T − 1| where T is an effective temperature.

- **Γ_T ≪ 1:** Drift-dominated. Winner is effectively random (lottery).
- **Γ_T ≫ 1:** Selection-dominated. Weak biases reliably amplified (signal).
- **Crossover at Γ_T ≈ 1:** Population size where weak bias becomes detectable.

Validated empirically: N=8 GPT-4o naming games show lottery behavior; N=800 consistently selects same winner (Cat over Dog).

---

## Why This Is Critical: Connection to DD#472 Conformity Paradox

**DD#472** (MAD-Spear) identified the **Conformity Paradox**: the same mechanism enabling MAS cooperation (conformity-to-majority) is exactly what makes adversarial attacks succeed. But it lacked the *mathematical mechanism* explaining WHY conformity propagates.

**QSG provides the missing mechanism:**

1. **Drift IS the attack surface.** In the neutral drift regime (Γ_T ≪ 1), an adversary's injected "opinion" is indistinguishable from any other agent's sample. The system literally cannot tell signal from noise.

2. **Small-N vulnerability.** MAD-Spear found 1/6 agents can compromise a system. QSG explains why: with N=6, t_cons ∝ 36/α² — consensus is fast and drift-dominated. The adversary's "vote" has weight proportional to 1/N = 17% of the population signal.

3. **Bandwidth as defense.** QSG predicts that increasing communication bandwidth m *suppresses drift*. This maps directly to a practical defense: instead of exchanging single answers (Hard, m=1), exchange distributions/confidence vectors (higher m). This makes adversarial injection harder because the attacker must match a higher-dimensional signal.

4. **The N² scaling reveals a fundamental security-efficiency tradeoff.** Faster consensus (small N, large α) = more vulnerable to drift/attack. Secure consensus (large N, small α) = quadratically more expensive.

---

## Connection to GUS Framework

### Validates/Extends
- **Law 18 (Trust Dynamics):** QSG's mutual in-context learning IS a trust update — each agent "trusts" the speaker's sample as evidence. The adaptation rate α is the trust parameter.
- **CR#252 Trust-Topology Duality:** QSG's well-mixed (complete graph) topology maximizes drift speed. Structured topologies would slow drift — confirming topology shapes trust dynamics.
- **CR#259 Circuit Breakers:** QSG's crossover parameter Γ_T provides a *quantitative trigger* for circuit breakers. If estimated Γ_T < threshold, the system is in lottery mode → halt and restructure.

### New Theoretical Contributions
- **Mechanism M37 (candidate): Memetic Drift** — In quantized multi-agent communication, sampling noise from message discretization creates a systematic polarization force proportional to (α²/mN²)(1−‖x̄‖²), driving neutral populations toward arbitrary consensus.
- **Law 38 (candidate): Consensus Speed-Security Tradeoff** — The time to consensus scales as mN²/α², establishing a fundamental constraint: faster coordination requires accepting higher drift vulnerability.
- **Principle P115 (candidate): Bandwidth Defense Principle** — Increasing communication bandwidth (exchanging distributions rather than point estimates) suppresses adversarial drift linearly in m, providing a first-principles defense against conformity attacks.

---

## Predictions

**P115: Bandwidth Defense.** Multi-agent debate systems that exchange confidence distributions (m > 1) will be significantly more robust to single-agent injection attacks than systems exchanging only final answers (m=1). Specifically, robustness should scale linearly with effective bandwidth m. Testable by comparing MAD-Spear attack success rates across communication protocols.

**P116: Critical Population Size.** For any multi-agent LLM system with measurable weak biases of magnitude ε, there exists a critical population size N* ≈ α/(mε) below which outcomes are dominated by stochastic drift (lottery) and above which biases are reliably amplified (signal). This predicts that small LLM committees (N < 10) used for evaluation/judging are operating in the lottery regime for all but the strongest biases.

**P117: Consensus Time Scaling.** In multi-agent debate/deliberation systems, the number of rounds to reach consensus will scale as N/α² (population rounds), meaning doubling the number of agents roughly doubles convergence time (not quadruples, because natural units are per-agent rounds). This is testable across debate frameworks like ChatEval, FORD, etc.

**P118: Drift Detection via Polarization Monitoring.** Monitoring the polarization observable U = ‖x̄‖² over time can distinguish drift-dominated consensus (exponential growth from 1/K toward 1) from selection-dominated consensus (faster, bias-directed growth). Systems in drift mode should show high run-to-run variance in the *identity* of the winner but similar *speed* of convergence.

---

## Gaps and Limitations

1. **Well-mixed assumption.** QSG assumes random pair selection (complete graph). Real MAS have structured topologies (hierarchical, modular). How does topology modify the scaling laws? (Connects to CR#252 Trust-Topology Duality.)

2. **Single referent.** QSG analyzes one naming game at a time. Real debates involve correlated multi-issue deliberation. How does coupling between issues affect drift?

3. **Homogeneous α.** All agents share the same adaptation rate. In practice, some agents are more "stubborn" (low α) or "impressionable" (high α). Heterogeneous α could create asymmetric power dynamics.

4. **No strategic agents.** QSG agents are honest but noisy. MAD-Spear's adversarial agents are *strategic* — they choose messages to maximize influence. The interaction between strategic injection and drift dynamics is unexplored.

5. **Pre-peer-review.** Single-author Harvard/NTT paper. Mathematical framework appears rigorous (clean proofs in appendix), empirical validation uses GPT-4o naming games. But the connection to full-scale debate/deliberation systems needs more empirical work.

---

## Key Quotes

> "When an LLM population reaches consensus, does that outcome reflect collective reasoning, systematic bias, or stochastic sampling?"

> "We reveal the mechanism by introducing a minimal model, Quantized Simplex Gossip (QSG), and trace the microscopic origin of this agreement to mutual in-context learning."

> "Under mutual in-context learning, an arbitrary early sample can be reused as evidence and amplified into population-wide agreement."

> "Without such a baseline [memetic drift], apparent collective intelligence may be hard to distinguish from amplified sampling noise."

---

## Cross-References
- **DD#472 MAD-Spear** — QSG provides mathematical foundation for WHY conformity attacks work
- **CR#259 MAS Circuit Breakers** — Γ_T crossover parameter as quantitative circuit-breaker trigger
- **CR#252 Trust-Topology Duality** — Topology shapes drift speed; well-mixed = maximum vulnerability
- **CR#253 Stochastic Cooperation Theory** — QSG's neutral evolution analogy extends stochastic cooperation framework
- **DD#463 Selection Bottleneck** — Aggregation methods are the "bandwidth" parameter m in QSG
- **DD#460 ZD Strategies** — ZD strategies assume rational strategic agents; QSG shows even NON-strategic agents create dangerous drift dynamics

---

*This paper fills the most critical theoretical gap in our understanding of multi-agent coordination: the mathematical mechanism by which conformity emerges from noise alone. Combined with DD#472's threat model, it provides a complete picture of the conformity paradox — and, crucially, points toward bandwidth-based defenses that could be integrated into the GUS framework.*
