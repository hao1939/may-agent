# DD#415: REDEREF — Training-Free Probabilistic Control for Multi-Agent LLM Routing

*Filed by Scout, 2026-03-17. DD#415. Cross-listed cs.CL/cs.AI/cs.MA paper.*

## Paper
- **Title:** Training-Free Agentic AI: Probabilistic Control and Coordination in Multi-Agent LLM Systems
- **Authors:** Mohammad Parsa Hosseini, Ankit Shah, Saiyra Qureshi, Alex Huang, Connie Miao, Wei Wei
- **arXiv:** 2603.13256 (submitted 2026-02-24)
- **Status:** Under review, 13 pages
- **Rating:** ★★★★☆ HIGH

## One-Line
Thompson sampling + Beta posteriors = 28% fewer tokens, 17% fewer agent calls, 19% faster time-to-success for multi-agent LLM routing — all training-free.

## Core Problem
Multi-agent LLM systems face three persistent bottlenecks: (1) dynamic task routing (static pipelines break when agents degrade), (2) credit assignment across long horizons (failures visible only after many turns), and (3) cold-start inefficiency (no prior evidence about agent competence for new tasks). Existing solutions (AutoGen scripted protocols, MoA ensembles, RL-based coordination) are either brittle, expensive, or sample-hungry.

## REDEREF Framework — Four Components

### 1. Belief-Guided Delegation via Thompson Sampling
- Each agent Aᵢ has unobserved competence θᵢ ∈ [0,1]
- Controller maintains Beta posterior: θᵢ ~ Beta(αᵢ, βᵢ)
- At each step, sample θ̂ᵢ from each agent's Beta posterior, select agent with highest sample
- Update: αᵢ += y (success), βᵢ += (1-y) (failure)
- **Key interpretation:** θᵢ models probability of *net-positive marginal contribution* at current recursion step, NOT independent solve probability — avoids counterfactual blame assignment

### 2. Calibrated Reflection via Judge
- Binary verdict E ∈ {success, failure} from judge J
- Two evidence channels: programmatic metrics (EM/F1, unit tests) for unambiguous cases + LLM adjudication for ambiguous cases
- Judge calibrated on small labeled set (~200 samples) to estimate FP/FN rates
- Binary feedback is deliberately chosen over scalar scores for robustness to miscalibration

### 3. Evidence-Based Selection (NOT Averaging)
- Candidates scored via programmatic + judge scores
- Optional bounded debate (≤2 refinement turns) among top candidates
- For structured outputs: atomic field extraction → competence-weighted voting using μᵢ = αᵢ/(αᵢ+βᵢ) as trust weights
- **Design choice:** Averaging dilutes strong answers with weak ones; selection preserves best candidate

### 4. Memory-Aware Priors for Cold-Start Mitigation
- Seed priors with similarity- and recency-weighted historical outcomes:
  - αᵢ ← α₀ + Σₘ K(x_d, x_m) · yₘ · w_{Δtₘ}
  - βᵢ ← β₀ + Σₘ K(x_d, x_m) · (1-yₘ) · w_{Δtₘ}
- K = cosine similarity over sentence embeddings, w = exponential temporal decay
- Biases posteriors toward agents that recently succeeded on similar tasks

## Recursive Re-Routing Loop
On failure: (i) update posterior with y=0, (ii) refine query with judge's critique, (iii) re-route via Thompson sampling. Termination conditions: success, depth limit D, budget exhaustion B, or plateau detection (no improvement over last k attempts).

**Cooldown mechanism:** After selection, agent gets cooldown period r — forces exploration of alternatives, prevents false-positive exploitation loop. Complements stochastic Thompson exploration with deterministic diversity.

## Theoretical Result

**Theorem 3.1 (Regret under noisy judge):**
R(T) = O(√(NT·log T) / δ)

where δ = 1 - ε_FP - ε_FN (discrimination margin).

**Insight:** Judge noise inflates regret by exactly 1/δ. Provides precise budget for investing in judge quality vs. accepting routing suboptimality. As δ→0 (uninformative judge), regret diverges; as δ→1 (perfect judge), recovers standard Thompson sampling bound.

## Experimental Results

### Setup
- 16 agents: 6 specialist RAG (biology, finance, law, medicine, EE, math) + 10 generalist conversational
- Split-knowledge benchmark: tasks require 4-6 agents, unsolvable by any single agent
- Baseline: Random Delegation (same recursive loop, uniform random agent selection)

### Key Numbers (Table 1)
| Metric | Random | REDEREF | Δ |
|--------|--------|---------|---|
| Success rate | 96.46% | 96.65% | ≈ matched |
| Token usage | 1.00× | **0.72×** | **-28%** |
| Agent calls | 1.00× | **0.83×** | **-17%** |
| Time-to-success | 1.00× | **0.81×** | **-19%** |

### Routing Behavior Ablation (Table 2)
- Without belief updates: 17.2% more bad-agent selections, 8.2% more wasted exploratory attempts (p<0.01)

### Specialization (H2)
- EE expert belief score: 0.50 → 0.84 over 55 tasks
- Rounds to expert selection: 8.11 → 6.86 (learns to route domain queries faster)

### Adaptability (H3) — Agent Impairment
- Biology agent systematically degraded after 50 tasks
- Belief score dropped ~50% (0.35 → 0.23)
- Agent contributions: 12 → 0 (complete reallocation)
- System output quality degraded modestly: 84.52 → 81.80 (graceful, not catastrophic)

## What Makes This Important

### 1. Training-Free Is the Right Constraint
The paper demonstrates that simple, interpretable probabilistic control achieves meaningful efficiency gains without any fine-tuning. This is critical for production deployment where retraining agent routers is impractical.

### 2. "Marginal Contribution" Interpretation of θᵢ
This is the paper's most subtle and important idea. Rather than modeling whether an agent can solve the task, θᵢ models whether *invoking* the agent at the current recursion step yields a net-positive *marginal contribution* given existing candidates. This sidesteps the intractable problem of counterfactual credit assignment in multi-agent settings.

### 3. Binary Feedback as Feature, Not Bug
Deliberately choosing binary over scalar feedback for robustness. The Beta-Bernoulli conjugate is resilient to moderate label noise — a principled choice when judge calibration is imperfect.

### 4. Cooldown + Thompson = Diversity
The deterministic cooldown mechanism prevents false-positive exploitation loops that pure Thompson sampling can't avoid. This hybrid deterministic-stochastic exploration is a clean design pattern.

## Limitations & Critiques

1. **Benchmark is synthetic:** Split-knowledge tasks are constructed to require multi-agent collaboration. Real-world tasks may have murkier boundaries between agent competences.
2. **Success rate already saturated:** With recursive retry achieving ~96% success regardless of routing, the efficiency gains (while significant) operate on the margin. On harder tasks where success isn't saturated, belief-guided routing might show much larger gains.
3. **Small agent pool (N=16):** Scalability to 100+ agent pools (common in enterprise settings) is untested. Thompson sampling's O(√N) regret suggests it should scale, but memory-aware priors might face embedding quality challenges.
4. **Sequential recursion latency:** No parallel candidate generation. In time-critical applications, the recursive loop adds latency.
5. **Judge dependency:** The entire system's quality rests on judge calibration. The regret bound makes this explicit (1/δ penalty), but practical judge calibration remains underexplored.

## Portfolio Connections

### Direct Connections
- **DD#411 (EnterpriseOps-Gym):** REDEREF's routing efficiency directly addresses the Planning-Execution Gap. The 37% best-model success rate in EnterpriseOps-Gym suggests belief-guided routing could significantly improve multi-step enterprise task completion.
- **DD#408 (ILION):** ILION's gates (validation, plausibility, information) could serve as REDEREF's programmatic judge, providing richer binary feedback than simple EM/F1.
- **DD#412 (SCCAL):** SCCAL's ORC topology metrics could detect when REDEREF's routing creates echo chambers (positive curvature) or bottlenecks (negative curvature), enabling topology-aware cooldown policies.
- **DD#378 (DOVA):** DOVA's deliberation-first paradigm complements REDEREF's reflection-driven re-routing — both use structured self-critique before committing to outputs.

### Thematic Connections  
- **DD#295 (AgentDrift):** REDEREF's adaptability test (H3) directly validates resilience to the kind of agent degradation AgentDrift warns about. The 1/δ regret bound provides theoretical backing for "how much drift can we tolerate?"
- **DD#413 (ASVO):** SVO-conditioned agent selection could enhance REDEREF's Thompson sampling — agents with cooperative SVO orientations might have systematically higher marginal contributions in collaborative tasks.
- **CR#75 (Ceiling Validation):** REDEREF's saturated success rate (96%) reveals a measurement ceiling — the interesting signal is in efficiency, not accuracy.

### Meta-Pattern: "Lightweight > Heavy" 
REDEREF joins a growing pattern in our portfolio: lightweight, interpretable mechanisms outperforming heavy RL/training-based approaches. See also: BAVT (DD#274), CESA-LinUCB (DD#409), and the general principle that Bayesian priors + online adaptation > end-to-end training for coordination.

## Actionable for Bob
- **Thompson sampling for agent routing** is immediately implementable in any multi-agent orchestrator
- **Binary feedback + Beta posteriors** = auditable decision trail for responsible deployment
- **Cooldown mechanism** is a simple but powerful design pattern against exploitation loops
- The **marginal contribution interpretation** is the key conceptual insight worth internalizing

## Key Equations
1. Thompson sampling: θ̂ᵢ ~ Beta(αᵢ, βᵢ), select i* = argmax θ̂ᵢ
2. Posterior update: αᵢ += y, βᵢ += (1-y) 
3. Memory-aware prior: αᵢ = α₀ + Σ K(x,xₘ)·yₘ·exp(-λΔt)
4. Regret bound: R(T) = O(√(NT·log T) / δ) where δ = 1 - ε_FP - ε_FN
