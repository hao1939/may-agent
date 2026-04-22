# DD#859 — Error Absorbers in Multi-Step Systems: Theoretical Foundations for Verification Gravity Wells

**Why terminal verification steps become disproportionate error concentrators — and what this means for system design**

**Date:** 2026-06-19
**Triggered by:** EXP-099 finding — FM-3.3 captures 20.3% of all errors; DD#855 surveyed interventions but not root causes
**Tags:** `error-absorbers` `gravity-well` `verification` `EXP-099` `theoretical-framework` `attribution-collapse` `cascade-dynamics`

---

## 1. The Phenomenon

EXP-099 analyzed 999 errors across 384 sessions and found FM-3.3 (Verification Failure) is the single largest error category at 20.3% — more than any planning, reasoning, or execution failure mode. The transition analysis revealed FM-3.3 is a **terminal attractor**: errors flow *into* it (FM-2.2 → FM-3.3 is the #1 transition at 29 occurrences) but also *out* of it (FM-3.3 → FM-1.1 at 23 occurrences, triggering new cascades).

We called this a "verification gravity well." DD#855 explored where to intervene. This deep dive asks the deeper question: **Why do verification steps become error absorbers?** Is this an accident of our system, or a structural inevitability in multi-step pipelines?

**Conclusion: It is structural.** The concentration effect emerges from at least five independent mechanisms, each of which has analogues in established theory. No existing literature describes the *combined* effect; this appears to be a novel synthesis.

---

## 2. Literature Search Summary

### 2.1 Direct Matches: None

Searches across arXiv for "terminal-step failure concentration," "error absorber verification," and related queries returned no direct matches. The specific phenomenon of verification steps acting as error attractors in sequential AI systems is **not described in existing literature** as of June 2026. This confirms the April 21 novelty assessment.

### 2.2 Closest Analogues Found

| Paper / Framework | Year | Relevance |
|---|---|---|
| **Zhu et al., "Where LLM Agents Fail"** [arXiv:2509.25370](https://arxiv.org/abs/2509.25370) | 2025 | AgentErrorTaxonomy: modular failure classification. Documents cascading failures where "a single root-cause error propagates through subsequent decisions." Does NOT address terminal concentration. |
| **Jardine, "CTHA"** [arXiv:2601.10738](https://arxiv.org/abs/2601.10738) | 2026 | Constrained Temporal Hierarchical Architecture. Reports 47% reduction in failure cascades via inter-layer constraints. Identifies "unbounded error propagation" as a core problem but treats it as uniform, not terminal-concentrating. |
| **Flouro & Chadwick, "Hallucinations Live in Variance"** [arXiv:2601.07058](https://arxiv.org/abs/2601.07058) | 2026 | Key insight: "cascading failures in multi-step execution" triggered by variance. Distinguishes bias (wrong knowledge) from variance (inconsistent pathways). Relevant to WHY errors accumulate but not WHERE. |
| **Zeng et al., "Bayesian Adversarial Multi-Agent"** [arXiv:2603.03233](https://arxiv.org/abs/2603.03233) | 2026 | Directly addresses "error propagation in multi-agent workflows." Adversarial loop reduces dependence on any single step. Closest to a mitigation strategy but doesn't analyze the concentration phenomenon. |
| **Sah et al., "The Verifier Tax"** [arXiv:2603.19328](https://arxiv.org/abs/2603.19328) | 2026 | Critical: shows that terminal safety verification intercepts 94% of non-compliant actions but safe success rate is **below 5%**. Recovery after verification intervention: ~0% in complex scenarios. This is direct evidence of verification as a gravity well — it catches everything but resolves nothing. |
| **Banerjee et al., "SEVerA"** [arXiv:2603.25111](https://arxiv.org/abs/2603.25111) | 2026 | Formally Guarded Generative Models with per-step contracts. Represents the counter-architecture: distribute verification so no terminal step bears the full burden. |

### 2.3 Classical Theory Analogues

| Framework | Analogue to Gravity Well | Key Insight |
|---|---|---|
| **Absorbing Markov Chains** | FM-3.3 as absorbing state | In a Markov chain, absorbing states have probability 1 of eventual entry from any transient state. If verification is the only state that "catches" errors, it becomes absorbing by definition — all error chains terminate there. |
| **Swiss Cheese Model** (Reason, 1990) | Terminal slice accumulation | Reason's model assumes each defensive layer is independent. But in sequential systems, the *last* slice sees all errors that passed through every prior slice. The terminal layer's apparent failure rate is the *product* of all upstream miss rates, not its own intrinsic rate. |
| **Byzantine Fault Tolerance** | View-change concentration | In BFT protocols, the view-change (leader-replacement) mechanism absorbs faults from prior views. Terminal consensus rounds show disproportionate failure rates not because they're faulty, but because they inherit unresolved state. |
| **Control Theory — Steady-State Error** | Integral windup | In PID controllers, the integrator accumulates error over time. Without anti-windup, the terminal output saturates. Verification steps act as integrators: they accumulate the residual of all upstream processing without a mechanism to "unwind." |
| **Oracle Problem** (software testing) | Test oracle as error sink | Weyuker (1982): the oracle problem states that determining expected output is often as hard as solving the original problem. Verification oracles in AI pipelines face the same issue — they can *detect* deviation but cannot *diagnose* origin, making them attribution-blind sinks. |

---

## 3. Theoretical Framework: Five Mechanisms of Terminal Error Concentration

We propose that verification gravity wells emerge from five independent, reinforcing mechanisms:

### Mechanism 1: Funnel Geometry (Structural)

In a sequential pipeline with N steps, the terminal step is the **only step that observes all outputs**. Upstream steps see only their local input→output. The terminal step is structurally positioned to detect errors from *any* prior step.

**Formal statement:** Let each step $i$ have independent error rate $e_i$ and detection rate $d_i$. The probability an error from step $i$ reaches the terminal step $N$ is $e_i \cdot \prod_{j=i+1}^{N-1}(1-d_j)$. The terminal step sees the **union** of surviving errors from all upstream steps — a funnel effect.

**Implication:** Even with identical per-step error rates, the terminal step will always appear to have the highest error rate simply because it observes the accumulated residual. This is a **measurement artifact**, not a quality deficit.

### Mechanism 2: Attribution Collapse (Epistemic)

This is our core hypothesis. The verification step can observe *that* something is wrong but cannot determine *where* the error originated. When FM-3.3 fires, the error is coded as a verification failure — but the root cause may be FM-2.1 (hallucination), FM-2.2 (evidence gap), or FM-1.4 (tool misuse) from earlier steps.

**Evidence from EXP-099:** The #1 transition is FM-2.2 → FM-3.3 (29 occurrences). This means evidence gaps *cause* verification failures. The error is attributed to verification, but it was *born* in reasoning. The verification step absorbs the attribution.

**Analogy:** This is isomorphic to the **oracle problem** in software testing. The test oracle reports "wrong output" but cannot say which line of code is defective. Similarly, FM-3.3 reports "verification failed" but cannot point to the upstream step that introduced the fault.

**Formal property:** Attribution collapse occurs when the error detection function $detect(output)$ has **no inverse** — i.e., there is no function $locate(error) → step_i$. In our system, FM-3.3 is a detection-only function with no attribution channel.

### Mechanism 3: Asymmetric Observability (Information-Theoretic)

Upstream steps operate on partial information and have **local observability** — they can verify their own output against their input but cannot assess downstream compatibility. The terminal step has **global observability** over the final artifact but lacks the causal chain.

This creates an information asymmetry:
- **Upstream steps:** Can attribute errors (they know what they did) but cannot detect downstream impact
- **Terminal step:** Can detect errors (it sees the final output) but cannot attribute upstream origin

**Result:** The only step that can *detect* errors is the one that *cannot attribute* them. This asymmetry is what makes the terminal step an **error absorber** — errors become visible only where they become untraceable.

### Mechanism 4: Cascade Amplification (Dynamic)

EXP-099 showed 77.3% of sessions have 2+ errors and 49.2% have 3+ errors. In cascade-heavy environments, individual errors compound. The terminal step doesn't just see N independent errors — it sees the *interaction effects* of cascaded errors.

**From Zhu et al. (2509.25370):** "A single root-cause error propagates through subsequent decisions, leading to task failure." The terminal step faces not just the residual of individual errors but the combinatorial explosion of their interactions.

**From CTHA (2601.10738):** Unconstrained hierarchical systems exhibit "unbounded error propagation." CTHA's 47% failure cascade reduction came specifically from bounding inter-layer communication — preventing the cascade amplification that terminal steps absorb.

### Mechanism 5: Verification Paradox (Pragmatic)

**From "The Verifier Tax" (2603.19328):** Terminal verification catches 94% of non-compliant actions but achieves <5% safe success rate. This reveals a paradox: **the more effective verification is at catching errors, the more errors it absorbs, and the worse it appears.**

A verification step that catches nothing would show 0% error rate. A verification step that catches everything shows the system's total error rate. The gravity well effect is *proportional to verification effectiveness*.

**Corollary:** Improving FM-3.3's detection capability will *increase* its apparent error share, not decrease it. This is why naive "fix the verification step" approaches fail — the step isn't broken, it's doing exactly what it should, and that makes it look like the problem.

---

## 4. Unified Model: The Error Absorber

Combining all five mechanisms:

```
             ┌──────────────────────────────────────────┐
             │     VERIFICATION GRAVITY WELL MODEL       │
             ├──────────────────────────────────────────┤
             │                                          │
             │  Step 1 ──e₁──→  Step 2 ──e₂──→  ...    │
             │    │                │                     │
             │    │ (local         │ (local              │
             │    │  detection)    │  detection)         │
             │    ▼                ▼                     │
             │  [caught₁]      [caught₂]                │
             │                                          │
             │  Surviving errors: e₁(1-d₁) + e₂(1-d₂)  │
             │       + interactions(e₁,e₂,...)          │
             │            │                             │
             │            ▼                             │
             │    ┌─────────────────┐                   │
             │    │   TERMINAL      │ ← Funnel          │
             │    │   VERIFICATION  │ ← Attribution     │
             │    │   (FM-3.3)      │    Collapse        │
             │    │                 │ ← Asymmetric       │
             │    │  Detects: ALL   │    Observability   │
             │    │  Attributes: ∅  │ ← Cascade          │
             │    │  Resolves: ~0%  │    Amplification   │
             │    └─────────────────┘ ← Verification     │
             │                            Paradox        │
             └──────────────────────────────────────────┘
```

**Definition:** An **error absorber** is a system component that satisfies:
1. **Terminal position** in information flow (funnel geometry)
2. **Detection without attribution** (attribution collapse)
3. **Global observability without causal access** (asymmetric observability)
4. **Exposure to compound errors** (cascade amplification)
5. **Effectiveness-proportional blame** (verification paradox)

Any verification step meeting all five criteria will inevitably become a gravity well. This is not a bug — it is a structural property of sequential verification architectures.

---

## 5. Predictions and Testable Implications

### P1: Error Share Scales with Pipeline Length
If FM-3.3's concentration is structural, longer pipelines should show higher terminal concentration. EXP-099 already shows optimizer (29.4 ops avg, 73% cascade rate) vs scout (fewer ops, 6% cascade rate). **Prediction: plot FM-3.3 share vs session opCount; expect positive correlation.**

### P2: Distributed Verification Reduces Gravity
If we add intermediate verification gates (per DD#855's SEVerA-style contracts), the terminal step's share should decrease proportionally. **Prediction: with K intermediate gates, FM-3.3 share drops by approximately K/(N-1).**

### P3: Attribution Channels Decouple Detection from Absorption
If we add error provenance tracking (each step tags its output with a confidence signal), FM-3.3 should still detect the same number of errors but they'd be re-attributed to origin steps. **Prediction: total error count unchanged; FM-3.3 count drops; upstream FM counts rise.**

### P4: The Verification Paradox is Measurable
Compare sessions where FM-3.3 was more vs. less thorough. More thorough verification should show *higher* FM-3.3 rates but *lower* undetected error rates (measured by post-hoc human review). **Prediction: FM-3.3 rate and verification quality are positively correlated.**

---

## 6. Implications for System Design

### 6.1 Stop Blaming the Terminal Step
FM-3.3's 20.3% share does not mean verification is our worst-performing capability. It means verification is our most *visible* error surface. Improvement efforts focused on FM-3.3 will reduce detection, not errors.

### 6.2 Distribute Verification (Break the Funnel)
Per SEVerA [2603.25111]: attach lightweight post-condition contracts to each step. Each step verifies its own output before passing downstream. This converts the single terminal absorber into distributed detection with local attribution.

**Concrete proposal:** Each tool call should return a `confidence` field and a `postcondition_met` boolean. The terminal verification step should only handle *novel* verification, not re-checking upstream work.

### 6.3 Add Attribution Channels (Break the Collapse)
Each step should propagate a provenance trace: what inputs it used, what transformations it applied, what it's uncertain about. When FM-3.3 detects an error, the provenance trace enables attribution to the originating step.

**Concrete proposal:** Structured `provenance` metadata on each inter-step message, carrying forward uncertainty markers. FM-3.3 becomes a *router* (attributing errors to origin) rather than a *sink* (absorbing them).

### 6.4 Anti-Windup for Error Cascades
Per control theory: add "anti-windup" mechanisms that prevent error accumulation. In practice: if intermediate steps detect rising uncertainty, they should **halt and request clarification** rather than passing degraded output downstream.

**From CTHA [2601.10738]:** Authority Manifold Constraints bound each layer's decision space. Applied to our system: each step has an explicit "confidence floor" below which it escalates rather than proceeding.

### 6.5 Accept the Paradox
Some terminal concentration is *healthy* — it means the verification step is working. Design dashboards that distinguish:
- **Absorbed errors**: detected at FM-3.3, originated upstream (should decrease with better upstream gates)
- **Intrinsic errors**: verification logic itself is wrong (the actual FM-3.3 quality signal)
- **Novel errors**: only observable at terminal step (irreducible)

---

## 7. Relationship to Prior Deep Dives

| Deep Dive | Connection |
|---|---|
| **DD#855** (Decision Boundary Interventions) | DD#855 surveyed *where* to intervene; DD#859 explains *why* intervention is needed at those points. The SEVerA and SafeHarness patterns from DD#855 are theoretically justified by the funnel geometry and attribution collapse mechanisms here. |
| **EXP-099** (Information-Flow Failure Modes) | DD#859 provides the theoretical framework for EXP-099's empirical finding. The 20.3% concentration and FM-2.2 → FM-3.3 transition are predicted by Mechanisms 1-3. |

---

## 8. Open Questions

1. **Is there an optimal number of intermediate verification gates?** Too few → gravity well; too many → verifier tax [2603.19328]. There should be a Pareto frontier.
2. **Can attribution collapse be formally measured?** Possible metric: mutual information between error detection signal and error origin, I(detection; origin). For FM-3.3 currently, this is near zero.
3. **Do other error codes exhibit absorber properties?** FM-2.1 (hallucination, 15.5%) might be a secondary absorber — it could be absorbing context-window and retrieval errors.
4. **Cross-system generality:** Does this framework predict gravity wells in other multi-agent architectures? The CTHA and AgentDebug systems should exhibit similar patterns at their terminal evaluation steps.

---

## 9. Key Citations

1. **Zhu et al.** (2025). "Where LLM Agents Fail and How They Can Learn From Failures." arXiv:2509.25370. — Cascading failure taxonomy for LLM agents.
2. **Jardine** (2026). "CTHA: Constrained Temporal Hierarchical Architecture for Stable Multi-Agent LLM Systems." arXiv:2601.10738. — 47% failure cascade reduction via inter-layer constraints.
3. **Flouro & Chadwick** (2026). "Hallucinations Live in Variance." arXiv:2601.07058. — Variance-driven cascading failures in agentic systems.
4. **Zeng et al.** (2026). "AI-for-Science Low-code Platform with Bayesian Adversarial Multi-Agent Framework." arXiv:2603.03233. — Error propagation minimization in multi-agent workflows.
5. **Sah et al.** (2026). "The Verifier Tax." arXiv:2603.19328. — Terminal verification catches 94% of errors but achieves <5% safe success rate.
6. **Banerjee, Xu & Singh** (2026). "SEVerA: Self-Evolving Verified Agents." arXiv:2603.25111. — Per-step formal contracts as distributed verification.
7. **Lin et al.** (2026). "SafeHarness." arXiv:2604.13630. — Dynamic escalation of verification rigor across lifecycle.
8. **Reason, J.** (1990). *Human Error*. Cambridge University Press. — Swiss Cheese Model of defensive layers.
9. **Weyuker, E.J.** (1982). "On testing non-testable programs." *Computer Journal*, 25(4). — The oracle problem in software testing.
10. **Kemeny, J.G. & Snell, J.L.** (1976). *Finite Markov Chains*. Springer. — Absorbing states theory.

---

## 10. Summary

The "verification gravity well" at FM-3.3 is not a quality problem — it is a **structural inevitability** of sequential pipeline architectures with terminal verification. Five independent mechanisms (funnel geometry, attribution collapse, asymmetric observability, cascade amplification, verification paradox) combine to make terminal verification steps disproportionate error concentrators.

The core insight: **verification steps have asymmetric error visibility — they surface errors but cannot attribute them upstream, creating attribution collapse.** This makes them appear to be the system's weakest point when they are actually its most *honest* point.

The fix is architectural: distribute verification, add attribution channels, and implement anti-windup. Stop optimizing the terminal step; start preventing errors from reaching it.

---

*This framework appears to be novel as of June 2026. No existing literature describes the combined terminal concentration effect in multi-step AI systems, though each individual mechanism has classical analogues. Priority claim: EXP-099 (April 2026) → DD#859 (June 2026).*
