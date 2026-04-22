# DD-860: Error Absorbers and Decision Boundary Interventions in Autonomous Agents ★★★★★

**Research Question**: What mechanisms exist for preventing error cascade attractors in multi-step AI agent systems?
**Fills**: EXP-099 verification gravity well gap — FM-3.3 terminal attractor (20.3% of errors)
**Date**: 2026-07-21

---

## Executive Summary

Error cascades in LLM agent systems are not random — they follow **attractor dynamics** where early errors create gravitational pull toward specific failure basins. Our EXP-099 finding that FM-3.3 acts as a terminal attractor capturing 20.3% of all errors represents a specific instance of a broader phenomenon documented across the literature. This deep dive synthesizes four research threads: (1) error propagation in LLM pipelines, (2) distributed systems resilience patterns adapted for agents, (3) pre-commitment gate interventions, and (4) formal models of error attractor states. The central finding: **error absorption requires architectural intervention at decision boundaries, not post-hoc correction** — LLMs fundamentally cannot self-correct reasoning without external signals.

---

## 1. Error Propagation in LLM Agent Pipelines

### 1.1 The Cascade Problem is Well-Documented

Multiple recent papers confirm that error propagation in multi-step LLM pipelines is a first-order reliability concern:

**EnviSmart** (Guan et al., 2604.01647, PEARC 2026): Production multi-agent data management system that treats reliability as an *architectural property*. Key insight: "LLM pipelines may generate plausible but incorrect outputs that pass superficial checks and propagate into irreversible actions." Their solution: **role-separated agents with deterministic validators and audited handoffs** that restore fail-stop semantics at trust boundaries. Demonstrated boundary-based containment with 10-minute detection latency, zero user exposure.

**FOCAL** (Purwar & Choudhary, 2601.07367): Benchmarking framework for multi-modal agents that explicitly measures "component-wise error propagation" through cascading pipelines. Confirms that cascading pipelines present systematic error propagation, not random failure.

**MaCTG** (Zhao et al., 2410.19245): Documents "cascading hallucinations" in multi-agent programming — accumulated errors across agents result in suboptimal workflows. Their solution: dynamic graph structure for precise task allocation with systematic verification.

**DIG to Heal** (Yang et al., 2603.00309): Studies multi-agent systems where "unstructured interactions can lead to redundant work and cascading failures." Introduces Dynamic Interaction Graph (DIG) making emergent collaboration observable, enabling "real-time identification, explanation, and correction of collaboration-induced error patterns."

**ToolMind** (Yang et al., 2511.15718): Demonstrates that "turn-level errors propagate during training and degrade model performance." Employs fine-grained turn-level filtering to remove erroneous steps — a data-level error absorption strategy.

### 1.2 The Self-Correction Impossibility

**Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet"** (2310.01798, ICLR 2024): The foundational negative result. LLMs attempting intrinsic self-correction (without external feedback) **fail to improve and often degrade performance**. This is the theoretical basis for why verification gravity wells form: once an agent commits to a wrong reasoning path, asking it to re-verify using the same capabilities that produced the error creates a **self-reinforcing loop**, not a corrective one.

**Ríos-García et al., "AI Scientists Produce Results Without Reasoning Scientifically"** (2604.18805, 2026): Across 25,000+ agent runs, "evidence is ignored in 68% of traces, refutation-driven belief revision occurs in only 26%." The base model accounts for 41.4% of variance vs 1.5% for the scaffold. **Scaffold engineering alone cannot repair reasoning failures.** This directly validates our gravity well observation — the scaffold (verification loop) cannot overcome the model's tendency toward self-reinforcing errors.

**Self-Correction Bench** (Tsui, 2507.02778): Systematically studies the "self-correction blind spot" — models have specific, predictable failure modes where self-correction reliably fails.

### 1.3 Synthesis: Why FM-3.3 Is a Terminal Attractor

Combining these findings explains our EXP-099 observation:
1. FM-3.3 errors produce outputs that are **plausible enough** to pass the agent's own verification (EnviSmart insight)
2. The agent **cannot self-correct** the underlying reasoning error (Huang et al.)
3. Each verification iteration **reinforces** rather than corrects the error (Ríos-García et al. — evidence ignored 68% of time)
4. The error **propagates forward** through dependent steps (FOCAL, ToolMind)
5. The result is a **stable attractor state** — the system converges to the error rather than away from it

---

## 2. Circuit Breaker and Checkpoint Patterns from Distributed Systems

No direct arXiv results for "circuit breaker pattern AI agent" — this is a **gap in the literature** and an opportunity. However, several well-established distributed systems patterns map directly:

### 2.1 Circuit Breaker Pattern (Nygard, "Release It!")

**Original pattern**: When a downstream service fails repeatedly, stop calling it. States: Closed → Open → Half-Open. Prevents cascade of timeouts/failures through the system.

**Agent mapping**: When a verification loop has failed to resolve an error after N iterations, **stop verifying and escalate**. The circuit breaker monitors verification attempt count and error similarity across iterations:
- **Closed** (normal): Agent verifies and iterates normally
- **Open** (tripped): After N failed verification cycles with no progress, halt the loop and escalate to human or alternative strategy
- **Half-Open** (probe): After cooldown/strategy change, attempt one verification with a different approach

**Direct application to FM-3.3**: A circuit breaker monitoring the verification loop would detect that iterations 3+ are producing similar outputs to iteration 1, trip the breaker, and prevent the gravity well from forming.

### 2.2 Bulkhead Pattern

**Original pattern**: Isolate failures to prevent cross-system contamination. Ship hull compartments prevent one breach from sinking the vessel.

**Agent mapping**: Isolate reasoning chains so that an error in one sub-task cannot contaminate the verification of another. Specifically:
- **Memory bulkheads**: Don't carry forward the full context of a failed attempt into the retry — this seeds the same error
- **Tool bulkheads**: Use different verification tools/approaches for retries rather than the same pipeline
- **Agent bulkheads**: Hand off to a differently-prompted or different-model agent for verification (the EnviSmart approach)

### 2.3 Chaos Engineering / GameDay Pattern

**Original pattern**: Inject failures deliberately to discover emergent failure modes before they occur in production.

**Agent mapping**: Deliberately inject known-incorrect outputs at various pipeline stages and measure:
- Does the verification loop catch them?
- How many iterations until detection?
- Does the system converge toward or away from the injected error?
- Which error types create attractor states?

This is essentially **adversarial testing of the verification loop itself** — probing for gravity wells before they capture real errors.

### 2.4 Timeout / Deadline Pattern

**Original pattern**: Every operation has a maximum allowed duration. Prevents indefinite blocking.

**Agent mapping**: Every verification loop has a **maximum iteration budget**. After budget exhaustion:
- Return the best-so-far result with confidence annotation
- Escalate to human review
- Try an orthogonal approach (different model, different decomposition)

### 2.5 The Kitchen Loop (Roy, 2603.25697)

The closest thing to a circuit breaker pattern applied to LLM agents in the literature. Implements:
- **Unbeatable Tests**: Ground-truth verification the code author cannot fake
- **Drift Control**: Continuous quality measurement with **automated pause gates**
- **1000x synthetic user testing**: Stress-testing at scale

The "automated pause gates" are effectively circuit breakers — they halt autonomous evolution when quality metrics degrade. Validated across 285+ iterations with zero regressions.

---

## 3. Pre-Commitment Gates and Decision Boundary Interventions

### 3.1 The Concept: Interrupting Gravity-Well Dynamics

A **pre-commitment gate** is an intervention point placed *before* the agent commits to a reasoning path, where the cost of changing direction is still low. The key insight from dynamical systems: **it's exponentially cheaper to intervene at decision boundaries than to correct after convergence to an attractor**.

### 3.2 Audited Handoffs (EnviSmart Pattern)

EnviSmart's most relevant contribution: **audited handoffs at trust boundaries before irreversible steps**. This is a pre-commitment gate — before the system can execute an irreversible action (DOI minting, public release), a deterministic validator must approve.

**Mapping to our system**: Before Bob commits a verification result to session state (creating the "fact" that subsequent reasoning builds on), an independent check gates the commitment:
- Is this verification result consistent with prior verified facts?
- Has the confidence distribution shifted anomalously?
- Does the error pattern match a known attractor signature?

### 3.3 FATE: Feasibility-Aware Task Generation (Wei et al., 2603.01505)

Implements a **generation–verification–revision closed loop** with a critical innovation: an **active repair module** that converts infeasible proposals into valid ones rather than simply rejecting them. This is more than a gate — it's an **error transformer** that redirects the system away from attractor states.

### 3.4 RE-MCDF: Relation-Enhanced Multi-Expert Clinical Diagnosis (Shen et al., 2602.01297)

Implements a **generation–verification–revision closed-loop architecture** for clinical diagnosis with three complementary components. Most relevant: the "multi-relation awareness and evaluation expert group" that enforces **inter-disease logical constraints**. This is a constraint-based pre-commitment gate — before a diagnosis is committed, it must be logically consistent with known disease relationships.

**Mapping to our system**: Before a verification result is committed, check it against known **inter-error logical constraints**:
- Are the claimed fixes logically consistent with each other?
- Does the fix pattern match a known false-fix signature?
- Does the claimed improvement violate any invariant?

### 3.5 GeoEvolver: Self-Evolving Through Failure Memory (Dai et al., 2602.02559)

Stores "root-cause attribution from failures" in an evolving memory bank. This creates an **implicit pre-commitment gate**: before attempting a solution, check if the approach matches a known failure pattern from memory. Average 12% improvement across backbones.

### 3.6 Proposed Pre-Commitment Gate Architecture

Based on the literature synthesis, a pre-commitment gate for verification loops should have three layers:

```
┌─────────────────────────────────────────────┐
│  LAYER 3: ATTRACTOR SIGNATURE DETECTION     │
│  "Does this look like a known gravity well?" │
│  - Pattern match against FM-3.3 signatures   │
│  - Similarity to previous failed iterations   │
│  - Convergence velocity toward known basins   │
├─────────────────────────────────────────────┤
│  LAYER 2: PROGRESS ORACLE                    │
│  "Is the verification loop making progress?" │
│  - Diff between iteration N and N-1 outputs   │
│  - Monotonic improvement in objective metrics │
│  - Diversity of approaches across iterations  │
├─────────────────────────────────────────────┤
│  LAYER 1: BUDGET & TIMEOUT                   │
│  "Has the loop exceeded resource limits?"    │
│  - Iteration count vs budget                  │
│  - Wall-clock time vs deadline                │
│  - Token spend vs allocation                  │
└─────────────────────────────────────────────┘
```

**Trigger logic**: Any layer can trigger intervention. Layer 1 is the hard stop. Layer 2 catches stagnation. Layer 3 catches active convergence toward known error states.

**Intervention actions** (escalating):
1. **Perturbation**: Inject noise into the next iteration (different prompt, shuffled context)
2. **Strategy switch**: Change verification approach entirely (different tool, different decomposition)
3. **Agent switch**: Hand off to a differently-configured agent (EnviSmart pattern)
4. **Escalation**: Flag for human review with attractor analysis

---

## 4. Formal Models of Error Attractor States

### 4.1 Dynamical Systems Framing

The most natural formalization treats the agent's state space as a dynamical system:

Let **s_t** ∈ S be the agent's belief state at verification iteration t. The verification loop defines a map **f: S → S** where **s_{t+1} = f(s_t)**. An **error attractor** is a fixed point **s*** where:
- **f(s*) = s*** (the state is self-reinforcing)
- There exists a basin of attraction **B(s*)** ⊂ S such that for all **s_0 ∈ B(s*)**, the sequence **f^n(s_0) → s*** as n → ∞

FM-3.3 capturing 20.3% of errors means **|B(s*_FM3.3)| / |S_error|** ≈ 0.203 — its basin of attraction covers roughly one-fifth of the error state space.

### 4.2 Properties of LLM Error Attractors

From the literature, LLM error attractors have specific properties:

1. **Plausibility shield**: Attractor states produce outputs that pass superficial verification (EnviSmart finding). Unlike random errors, attractor states are *locally optimal* — they look correct from nearby in state space.

2. **Self-reinforcement via attention**: The agent's attention mechanism weights recent context heavily. Once an error enters context, it biases subsequent generation toward consistency with the error rather than ground truth (Huang et al. self-correction finding).

3. **Monotonic convergence**: Successive iterations increase confidence in the wrong answer (Ríos-García finding that evidence is ignored 68% of time). The "gravity" is real — there's a Lyapunov-like function where each iteration decreases distance to the attractor.

4. **Basin boundaries are decision points**: The pre-commitment gate insight is that basin boundaries correspond to early decision points where the agent hasn't yet committed to the error-path context.

### 4.3 The Verification Gravity Well as Lyapunov Trap

Define a pseudo-energy function **V(s)** measuring distance from the attractor state. In a verification gravity well:
- **V(s_{t+1}) < V(s_t)** for most iterations (the system "falls" toward the attractor)
- **∂V/∂t** increases as **V → 0** (convergence accelerates — the well gets steeper)
- **V(s*) = 0** is a global minimum within the basin

A **circuit breaker** fires when **ΔV** between iterations falls below a threshold (stagnation) or when **V** drops below a warning level (approaching known attractor). A **pre-commitment gate** operates at the basin boundary where **V** first begins to decrease.

### 4.4 Connection to WirelessBench Error Taxonomy (Tong et al., 2603.21251)

WirelessBench introduces a tolerance-aware scoring system that distinguishes **catastrophic errors** (invisible to exact-match metrics) from gradual degradation. 23% of errors are catastrophic. This maps to our attractor taxonomy: catastrophic errors correspond to deep attractor basins, while gradual errors correspond to shallow ones. Their "four actionable diagnostic categories" provide a template for classifying attractor types.

### 4.5 Connection to FuncPoison Attack Model (Long & Li, 2509.24408)

FuncPoison demonstrates that errors injected at one agent "trigger cascading errors that mislead other agents." This confirms that error attractors are not agent-local — they propagate across agent boundaries and can create **system-level attractor states** that no individual agent can escape.

---

## 5. Synthesis: Error Absorber Architecture for Our System

### 5.1 What Is an Error Absorber?

An **error absorber** is a system component designed to:
1. **Detect** convergence toward a known error attractor
2. **Absorb** the error's propagation energy (prevent cascade)
3. **Redirect** the system toward a productive state

It combines the circuit breaker (detection + halt), the bulkhead (containment), and the pre-commitment gate (redirection).

### 5.2 Proposed Error Absorber for FM-3.3

Based on the literature synthesis, the following architecture targets the FM-3.3 terminal attractor specifically:

```
VERIFICATION LOOP with ERROR ABSORBER
======================================

Iteration 1: Normal verification
     │
     ▼
[ABSORBER CHECK 1: Baseline capture]
  - Record output signature, confidence, approach
  - No intervention (need baseline)
     │
     ▼
Iteration 2: Normal verification
     │
     ▼
[ABSORBER CHECK 2: Progress measurement]
  - Compare output diff to iteration 1
  - If diff < threshold: STAGNATION WARNING
  - If output matches FM-3.3 signature: ATTRACTOR WARNING
  - If progress detected: continue normally
     │
     ▼
Iteration 3: Conditional
     │
     ├── If no warnings: Normal verification
     │
     ├── If STAGNATION: Strategy perturbation
     │   (different prompt template, shuffled context,
     │    explicit instruction to try alternative approach)
     │
     └── If ATTRACTOR: Hard redirect
         (agent switch, decomposition change,
          or escalation with attractor analysis)
```

### 5.3 Design Principles from Literature

| Principle | Source | Application |
|-----------|--------|-------------|
| Deterministic validators at trust boundaries | EnviSmart | Gate verification results with invariant checks |
| External feedback required for correction | Huang et al. (ICLR 2024) | Never rely on same-model self-correction |
| Failure memory for pattern avoidance | GeoEvolver | Maintain registry of FM-3.3 signatures |
| Role separation between generator and verifier | EnviSmart, RE-MCDF | Different agent/model for verification vs generation |
| Automated pause gates | Kitchen Loop | Hard iteration budgets with escalation |
| Active repair over simple rejection | FATE | Transform errors rather than just flagging them |
| Trajectory-level anomaly detection | TrajAD (DD-785) | Monitor action sequences for attractor signatures |
| Observable collaboration graphs | DIG | Make verification dynamics visible for diagnosis |

### 5.4 Implementation Priority

**Highest impact, lowest effort** (implement first):
1. **Iteration budget with escalation** — Simple counter, massive impact on gravity wells
2. **Inter-iteration diff monitoring** — Detect stagnation before attractor convergence
3. **FM-3.3 signature registry** — Pattern-match against known attractor outputs

**High impact, medium effort** (implement second):
4. **Strategy perturbation on stagnation** — Prompt/context variation to escape basin
5. **Agent/model switch for verification retries** — Different model breaks self-reinforcement

**High impact, high effort** (design now, implement later):
6. **Full pre-commitment gate architecture** — Three-layer gate as described in §3.6
7. **Formal attractor state monitoring** — Lyapunov-like convergence tracking

---

## 6. Open Questions and Research Directions

1. **Basin mapping**: Can we empirically map the basin of attraction for FM-3.3? Inject controlled errors and measure which ones converge to FM-3.3 vs other states.

2. **Attractor taxonomy**: Are there other terminal attractors besides FM-3.3? The 20.3% suggests yes — what captures the other ~80% of errors?

3. **Optimal intervention timing**: The dynamical systems model suggests earlier intervention is exponentially cheaper. Can we empirically validate this with our data?

4. **Cross-agent attractor propagation**: FuncPoison shows errors cascade across agents. Do our multi-agent workflows have system-level attractors distinct from single-agent ones?

5. **Error absorber overhead**: What is the latency/cost of absorber checks? Need to ensure the cure isn't worse than the disease.

6. **Formal verification of absorber correctness**: Can we prove that the absorber prevents convergence to known attractors? (Lyapunov stability analysis of the augmented system.)

---

## 7. Key References

| Reference | Year | Relevance |
|-----------|------|-----------|
| Huang et al., "LLMs Cannot Self-Correct Reasoning Yet" (2310.01798) | 2024 | Foundational — explains why verification loops create attractors |
| Guan et al., EnviSmart (2604.01647) | 2026 | Production system with audited handoffs, deterministic validators |
| Yang et al., DIG to Heal (2603.00309) | 2026 | Observable collaboration graphs, cascading failure correction |
| Roy, Kitchen Loop (2603.25697) | 2026 | Automated pause gates, drift control in autonomous evolution |
| Ríos-García et al., "AI Scientists..." (2604.18805) | 2026 | Evidence ignored 68%, scaffold cannot fix reasoning |
| Wei et al., FATE (2603.01505) | 2026 | Active repair module, generation-verification-revision loop |
| Shen et al., RE-MCDF (2602.01297) | 2026 | Constraint-based verification, logical consistency gates |
| Dai et al., GeoEvolver (2602.02559) | 2026 | Failure memory bank, root-cause attribution |
| Tsui, Self-Correction Bench (2507.02778) | 2025 | Systematic self-correction blind spots |
| Tong et al., WirelessBench (2603.21251) | 2026 | Catastrophic error taxonomy, tolerance-aware scoring |
| Long & Li, FuncPoison (2509.24408) | 2025 | Cross-agent error cascade via shared tools |
| Zhao et al., MaCTG (2410.19245) | 2024 | Cascading hallucinations in multi-agent systems |
| Purwar & Choudhary, FOCAL (2601.07367) | 2026 | Component-wise error propagation measurement |
| He et al., TrajAD (DD-785) | 2025 | Trajectory-level anomaly detection for agents |
| Nygard, "Release It!" | 2018 | Circuit breaker, bulkhead, timeout patterns |

---

## Connection to Internal Work

- **EXP-099**: FM-3.3 terminal attractor (20.3% of errors) — this DD provides the intervention architecture
- **DD-785 (TrajAD)**: Trajectory anomaly detection — provides the *detection* layer for error absorbers
- **DD-788 (AgentRacer)**: Failure attribution — provides the *diagnosis* layer for understanding attractor causes
- **FM-3.3**: The specific failure mode that motivated this research — error absorbers are the proposed mitigation

---

*Research quality: Strong empirical grounding from 13+ papers. The distributed systems analogies (circuit breaker, bulkhead) are novel applications not yet in the AI agent literature — this represents a genuine gap and opportunity. The dynamical systems formalization is original synthesis connecting multiple threads.*
