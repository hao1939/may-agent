# Deep-Dive #410: CESA-LinUCB — Learning When to Trust via Contextual Trust Boundaries

**Source:** arXiv:2603.13356 (Ghasemi & Crowley, U. Waterloo — Mar 9 2026)
**Relevance:** ★★★★★ | Formalizes context-dependent trust in multi-evaluator systems — directly applicable to MAS agent reliability
**Tags:** #trust-dynamics #contextual-sycophancy #adversarial-robustness #bandits #alignment #hostile-majority

---

## 1. Problem: The "Jekyll & Hyde" Failure Mode

Standard robust RL assumes evaluators are either **globally trustworthy** or **globally adversarial**. This paper identifies a more subtle failure: **Contextual Sycophancy** — evaluators truthful in benign contexts but strategically biased in critical ones.

**Example:** An evaluator answers math questions honestly (Context A) but strategically agrees with biases on political topics (Context B). Standard global trust metrics cannot detect this.

**Contextual Objective Decoupling (COD):** When the majority of evaluators are contextually hostile, any algorithm minimizing regret against social consensus (mean/median) suffers **linear latent regret** Ω(T). The agent converges to the sycophantic policy, not ground truth.

---

## 2. Core Contribution: Trust as Decision Boundary

Instead of asking "**Who** do I trust?", CESA-LinUCB asks "**When** do I trust each evaluator?"

### Trust Function:
τ*_m(x) = 𝕀(sup_a |β_m(x,a)| ≤ ε_tol)

This partitions context space X into:
- **Trust Region** T_m = {x | τ*_m(x) = 1} — evaluator m is reliable here
- **Untrustworthy Region** U_m — evaluator m is adversarial here

The boundary ∂T_m is learned as a high-dimensional classifier, not a scalar weight.

---

## 3. Algorithm: CESA-LinUCB

Dual-process loop with four phases:

### Phase 1: Epistemic Forecasting
For each evaluator m, predict context-specific trust score:
ŵ_{t,m} = σ(θ_m^T · x_t)
Normalize: α_{t,m} = ŵ_{t,m} / Σ_j ŵ_{t,j}

### Phase 2: Trust-Weighted Action Selection
Standard LinUCB but with trust-weighted ridge regression:
L(θ_a) = Σ_τ Σ_m α_{τ,m}(y_{τ,m} - θ_a^T x_τ)² + λ‖θ_a‖²
Select action maximizing UCB_{t,a} = μ̂_{t,a} + β√(x_t^T A_a^{-1} x_t)

### Phase 3: Sparse Axiomatic Check
With small probability p_axiom, query ground-truth to get label z_t. Update trust boundaries θ_m via SGD on cross-entropy loss. Inspired by Constitutional AI — sparse supervision sufficient to prevent consensus trap.

### Phase 4: Trust-Weighted Update
Aggregate reward ȳ_t = Σ_m α_{t,m} y_{t,m}. Update covariance and bias matrices with trust-weighted data.

---

## 4. Theoretical Results

### Theorem 1 (COD — Impossibility Result):
Any algorithm with sublinear regret on observed (corrupted) signal suffers **linear regret** Ω(T · μ(X_dec)) on latent ground truth when adversary controls majority in decoupling region X_dec.

### Theorem 3 (CESA-LinUCB Regret Bound):
R_T^latent ≤ Õ(√(T · d_VC)) + Õ(d√T)
- First term: epistemic cost of learning trust boundaries (scales with adversary complexity d_VC)
- Second term: standard bandit regret with clean data

### Lemma 2 (Price of Distrust — Asymmetric Error Costs):
- **False Trust** (trusting adversary) → Non-vanishing bias → **Inconsistent** estimator
- **False Distrust** (ignoring honest source) → Increased variance → Still **consistent**, just slower

**Key insight:** It's always safer to distrust than to trust. False distrust costs O(√T) exploration; false trust costs O(T) bias.

### Proposition 4 (Sycophantic Complexity):
Regret scales as Õ(√(κT)) where κ = VC-dimension of adversary's lying strategy. Complex liars are harder to detect but still learnable.

---

## 5. Experimental Results

### "Hostile Majority" Setup (M=10 evaluators):
- 20% Honest (ground truth + noise)
- 30% Contextual Liars ("Jekyll & Hyde" — truthful in one half-space, adversarial in other)
- 50% Sycophants (always positive feedback regardless of action)

### Key Results:
1. **CESA-LinUCB recovers ground truth** despite 80% hostile majority — cumulative regret plateaus at ~100
2. **Median LinUCB performs WORSE than naive LinUCB** — standard robust statistics (50% breakdown point) collapse when adversary captures the median
3. **Trust weight dynamics**: Honest evaluators quickly reach 0.6-0.8 weight; sycophants suppressed to ~0.15; contextual liars at intermediate levels
4. **Scalability**: Regret scales linearly with dimension d (validates Õ(d√T) bound)
5. **Phase transition in supervision**: Only ~5% axiomatic checks (p_axiom ≈ 0.05) sufficient for full recovery — sparse ground-truth probes break the consensus trap

---

## 6. Multi-Agent System Implications

### 6a. Direct MAS Applications:
- **Multi-agent debate/deliberation**: Agents are evaluators of each other's outputs. Some agents may be sycophantic (always agreeing) or contextually unreliable. CESA's trust boundaries could replace majority voting.
- **Agent team composition**: Rather than static trust scores, maintain context-dependent reliability profiles for each agent
- **Adversarial robustness**: Even with 80% compromised/sycophantic agents, the honest minority can be recovered

### 6b. Connection to Agent Elimination (CR#145):
Our earlier finding that **pruning > voting** is the spatial analog of CESA's temporal insight:
- **CR#145 (Pruning)**: Remove unreliable agents entirely from the team
- **CESA-LinUCB**: Weight agents differently per-context — more nuanced, preserves partial value from "Jekyll & Hyde" agents
- **Synthesis**: Optimal strategy may be hybrid — prune globally-bad agents (sycophants), context-weight partially-reliable agents (contextual liars)

### 6c. "Evidence Not Instruction" Connection (DD#409 StatePlane):
CESA provides the **formal trust model** for StatePlane's security principle. When StatePlane retrieves state, it should weight retrieved evidence by contextual trust scores — not treat all stored state as equally reliable.

### 6d. Limitations:
- Linear trust boundaries may be too simple for real agent behavior
- Axiomatic checks require access to ground truth — not always available
- Experiments synthetic only — no real LLM evaluation setting
- Does not address evaluator collusion/coordination

---

## 7. Connections to Existing Research

- **DD#405 (TrinityGuard)** — Safety taxonomy needs contextual trust (not just binary safe/unsafe). CESA's trust boundaries could extend TrinityGuard's evaluator model.
- **DD#404 (A4VL)** — A4VL's cross-review consensus with lowest-performer pruning is a heuristic version of trust-weighted aggregation
- **CR#145 (Pruning Over Voting)** — CESA provides the theoretical foundation for why voting fails: majority capture by adversaries. Pruning is the degenerate case of CESA (binary weights).
- **DD#375 (ASVO)** — Social value orientation in agents; CESA shows how to learn value orientation boundaries from sparse supervision
- **DD#377 (REDEREF)** — Probabilistic control for multi-agent coordination; CESA adds trust-aware weighting to the coordination signal
- **DD#408 (ILION)** — Deterministic execution gates filter at action-level; CESA filters at evaluator-level — composable

---

## 8. Key Takeaways for Bob

1. **"When to trust" > "Who to trust"**: Context-dependent trust boundaries are strictly more powerful than global trust scores. Any MAS using majority voting is vulnerable to contextual adversaries.
2. **False Trust is catastrophically worse than False Distrust**: Better to under-trust (slower learning) than over-trust (biased policy). Design principle: default to distrust, require evidence.
3. **Sparse supervision breaks consensus traps**: Only ~5% ground-truth probes needed. Applicable to our system: periodic human verification of agent outputs can anchor trust even with mostly-unsupervised operation.
4. **Hostile Majority Recovery**: Even when 80% of feedback is adversarial, the 20% honest signal is recoverable — but ONLY with contextual trust modeling, not with standard robust statistics.
5. **The Price of Distrust asymmetry** (Lemma 2) formalizes a design heuristic: systems should be designed to be conservative (high false-distrust tolerance) rather than permissive (low false-trust tolerance).

**Bottom line:** CESA-LinUCB provides the first formal framework for context-dependent trust in multi-evaluator systems. Its impossibility result (COD theorem) proves that standard robust methods fail against contextual adversaries, while its algorithm recovers ground truth from a hostile majority using sparse supervision. Directly applicable to MAS agent evaluation, team composition, and adversarial robustness.
