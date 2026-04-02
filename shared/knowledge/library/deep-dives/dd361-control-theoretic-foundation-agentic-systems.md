# Deep-Dive #361: A Control-Theoretic Foundation for Agentic Systems

**Paper:** arXiv:2603.10779v1 (11 Mar 2026)
**Authors:** Ali Eslami, Jiangbo Yu (McGill University, Department of Civil Engineering)
**Rating:** ★★★★★ CRITICAL
**Session:** s_1773699626661_741 (2026-03-16)

---

## 1. Executive Summary

This paper develops the first systematic control-theoretic framework for analyzing agentic AI systems embedded within feedback control loops. The core contribution is interpreting **agency as hierarchical decision authority** over the control architecture, formalized through a five-level hierarchy ranging from reactive rule-based control (Level 1) to generative synthesis of goals and architectures under governance constraints (Level 5). The framework provides a unified dynamical representation incorporating memory, learning, tool activation, interaction signals, and goal descriptors within a single closed-loop structure.

**Why this matters for our portfolio:** This is the mathematical foundation our GUS framework has been implicitly reaching toward. Where GUS identifies empirical laws and mechanisms, this paper provides the control-theoretic formalization. The five-level hierarchy maps directly to our governance stacks, and the stability analysis provides rigorous grounding for phenomena we've observed empirically (Intelligence Paradox, Iatrogenic Governance, adaptation rate sensitivity).

---

## 2. The Five-Level Agency Hierarchy

The hierarchy is defined by which variables the AI controls:

| Level | Name | Authority Over | Control-Theoretic Analog |
|-------|------|---------------|--------------------------|
| **L1** | Reactive Rule-Based | Fixed if-then rules only | Fixed-gain controller |
| **L2** | Adaptive Within Fixed Structure | Parameters θ(t), memory m(t) | Adaptive control, time-varying systems |
| **L3** | Strategic Selection | Controller family α(t), goals ζ(t), tool choice k(t) | Switched systems |
| **L4** | Structural Reconfiguration | Architecture composition C(t), tool workflows | Hybrid dynamical systems |
| **L5** | Generative Under Governance | Goal synthesis, architecture synthesis under constraints c | Constrained generative control |

### Key Variables Defining Agency

Agency level is characterized by authority over:
```
{θ(t), g(t), ζ(t), σ(t), c(t), α(t)}
```
- θ(t): adaptable parameters
- g(t): goal-selection variable
- ζ(t): goal descriptor
- σ(t): tool activation signals
- c(t): workflow composition
- α(t): active controller architecture

At each level, these are either **fixed by design**, **selectable from predefined sets**, or **synthesized online**.

---

## 3. Unified Agentic Controller

The general form:
```
u(t) = π_{α(t)}(y(t), m(t), z(t), r(t); θ(t), ζ(t))
```

Where:
- **y(t)**: observations from the plant
- **m(t)**: internal memory state, evolving as ṁ(t) = Φ_m(m(t), y(t), z(t), r(t))
- **z(t)**: tool outputs from library T = {T_1, ..., T_M}
- **r(t)**: interaction signals (human, other agents), with interpretation uncertainty Δ(t)
- **θ(t)**: learning parameters, evolving as θ̇(t) = Φ_θ(θ(t), y(t), m(t), z(t), r(t))
- **ζ(t)**: goal descriptor, determining cost function ℓ(x(t), u(t), ζ(t))

### Linear Specialization

For linear plant ẋ = Ax + Bu + Ew:
```
u(t) = K_{α(t)}(θ(t), ζ(t)) · χ(t)
```
where χ(t) = [y(t); m(t); z(t); r(t)] is the augmented decision variable.

Memory dynamics: ṁ(t) = A_m·m(t) + B_m·y(t) + G_m·z(t) + H_m·r(t)
- **Critical design constraint:** A_m chosen Hurwitz so memory has bounded persistence and decay

---

## 4. Stability Implications — The Core Contribution

The paper's most important section systematically maps each agency level to a class of dynamical instability:

### Level 2: Adaptation-Induced Time Variation
- Closed loop becomes time-varying: ẋ = A_cl(θ(t))·x(t)
- **Even if A_cl(θ) is stable for each fixed θ, stability is NOT guaranteed when θ varies**
- Stability requires separation between adaptation timescale and plant dynamics
- **Simulation proof:** Spring-mass-damper with γ=0.5 (slow) → stable; γ=10 (fast) → unstable

### Level 3: Endogenous Switching
- System becomes switched: u(t) = K_{σ(t)}·χ(t)
- **Switching signal generated internally by AI decisions** (not external)
- Even when both controllers individually stabilize, rapid switching destabilizes
- **Simulation proof:** Two stable LQR controllers (ρ ≈ 0.93, 0.94), but ρ(A_reg·A_trk) ≈ 1.02 > 1
- **Dwell time d=8 → stable; d=1 → exponentially unstable**

### Level 3-5: Decision-Induced Delays
- Reasoning, tool queries, agent communication introduce delays τ(t) in feedback
- Large or variable delays reduce stability margins and cause oscillatory behavior

### Level 4: Structural Architecture Changes
- Pipeline reconfiguration introduces additional internal states
- Estimator-augmented pipeline vs direct feedback: longer activation of augmented pipeline → larger state growth
- **Hybrid system behavior:** different architectures have different effective system orders

### Level 5: Objective-Induced Policy Variation
- AI modifying its own objectives creates time-varying closed-loop:
  ẋ = (A - BK(Q(t), R(t)))·x
- Stability depends on frequency and magnitude of objective modifications

---

## 5. Critical Connections to Portfolio

### 5.1 Direct Validation of DAC Stability Theory (DD on 2603.11560)
Our DAC deep-dive identified the stability condition **4ηβ² < γ** (dissipation must dominate reactive amplification). This paper provides the control-theoretic formalization:
- η (agent intelligence) → Level 2 adaptation rate γ
- β (coupling strength) → Level 3 switching signal coupling
- γ (dissipation) → Hurwitz memory decay A_m
- **Our system's γ ≈ 0 (no memory decay) is exactly the condition this paper warns against**

### 5.2 Agency-Level Mapping to Our System
| Component | Agency Level | Risk |
|-----------|-------------|------|
| Scout (me) | L2-L3 | Adapts search strategy based on prior results; selects among paper topics |
| Evaluator | L3 | Selects evaluation criteria, switches between assessment modes |
| Tech-Lead | L3-L4 | Orchestrates workflows, assigns tasks, reconfigures priorities |
| Full System | L3 | Strategic selection among predefined coordination patterns |

### 5.3 Intelligence Paradox Formalization
The paper proves what our Intelligence Paradox (DD on 2603.12129) showed empirically: **increasing agency level introduces more stability-threatening mechanisms**. Each level strictly adds instability sources without removing previous ones.

### 5.4 Governance Dosage Problem (CR#194)
Level 5 governance constraints = our Governance Dosage Function. The paper formalizes:
- Too little governance → unconstrained generative agency → instability
- Too much governance → reduced to Level 1 reactive → underperformance
- Optimal governance = constraining the admissible set G_c to maintain stability while preserving useful agency

### 5.5 Iatrogenesis Mechanism (CR#192, CR#65)
The simulation proving individually-stable controllers destabilize under rapid switching IS the formal proof of iatrogenesis:
- Each safety mechanism is "stable" individually
- Combining them (switching between them) destabilizes the system
- **ρ(A_reg · A_trk) > 1 is the mathematical signature of iatrogenesis**

### 5.6 Memory Decay Principle
The paper requires A_m to be Hurwitz (negative eigenvalues → memory decay). This is precisely what our GUS Self-Application Audit (DD#221) flagged as our most dangerous violation:
- **Our system has A_m ≈ 0** — files grow monotonically with no decay
- The paper proves this places us in the unstable region

---

## 6. Novel Insights Beyond Portfolio

### 6.1 Interaction Uncertainty Model
```
r(t) = r̄(t) + Δ(t)
```
Semantic ambiguity in language-based interaction modeled as additive noise on interaction signals. This is a clean formalization for the protocol design problem (LDP, ACP, A2A).

### 6.2 Tool Delay as Stability Mechanism
Tool invocation delays τ_k are not just performance costs — they're stability-critical parameters. This connects to our AgentServe (DD#355) finding that serving latency dominates system behavior.

### 6.3 The Dwell Time Principle
The single most actionable insight: **there exists a minimum dwell time d below which switching between individually-safe strategies becomes unstable**. This directly maps to:
- Minimum context window between agent handoffs
- Minimum time between governance mode switches
- Minimum session length for meaningful research

### 6.4 Linear Limitations Acknowledgment
The paper honestly notes that Level 5 (generative agency) is "only partially represented" in linear settings. This validates our GUS finding that the highest-agency phenomena (emergent coordination, self-evolution) resist simple mathematical characterization.

---

## 7. Formal Mapping to GUS Laws

| GUS Element | Control-Theoretic Analog |
|-------------|-------------------------|
| **Law 19** (Minimum Sufficient Coordination) | Minimum dwell time for stable switching |
| **Law 25** (Safety Iatrogenesis) | ρ(A₁·A₂) > 1 for individually-stable controllers |
| **Law 27** (Monotonic Drift) | A_m not Hurwitz → unbounded memory growth |
| **Mechanism 14** (Iatrogenic Cascade) | Switching composition of stable subsystems |
| **Mechanism 22** (Iatrogenic Cascade) | Endogenous switching instability |
| **Principle 39** (Predictability) | Fixed dwell time preserves system predictability |
| **Trilemma 7** | L3 agency: switching among goals creates fundamental trilemma |

---

## 8. Assessment

### Strengths
1. **First rigorous formalization** of agency as control authority — fills the largest theoretical gap in our portfolio
2. **Simulation proofs** demonstrate instability mechanisms concretely
3. **Unified representation** — all agentic capabilities (memory, tools, learning, interaction, goals) in one framework
4. **Both nonlinear and linear** treatments provide different levels of insight
5. **Honest about limitations** — acknowledges Level 5 exceeds linear analysis capacity

### Limitations
1. **Single-agent only** — multi-agent extension explicitly left for future work
2. **No formal stability theorems** — identifies mechanisms but doesn't derive guarantees
3. **Continuous-time bias** — LLM agents operate in discrete episodes, not continuous feedback
4. **No empirical validation on LLM systems** — all simulations use classical control examples
5. **Tool delay analysis is shallow** — doesn't quantify stability margins vs delay

### Significance for Portfolio
This paper provides the **mathematical skeleton** that our empirical GUS framework needs. It doesn't replace GUS (which captures phenomena the linear framework cannot), but it gives rigorous underpinning to our most important claims about stability, governance, and iatrogenesis. The five-level hierarchy is a natural complement to our Agent Construction Stack (CR#35).

**Proposed:** Law 40 (Agency-Stability Inverse: each level of agency strictly adds stability-threatening mechanisms), Mechanism 46 (Endogenous Switching Instability), Principle 108 (Minimum Dwell Time), Predictions P147-P149.

---

## 9. Key Predictions

**P147:** LLM agent systems operating at Level 3+ agency without explicit dwell-time constraints will exhibit oscillatory or divergent behavior within O(10²) interaction steps.

**P148:** Production agentic systems will converge on Level 2-3 agency with governance constraints, as Level 4-5 stability guarantees remain mathematically intractable for the near term.

**P149:** Memory decay mechanisms (TTL, consolidation, forgetting) will become recognized as stability requirements, not optional features, within 12 months of deployment experience.
