# Cross-Reference Synthesis: DCI × TRACED — Detecting When Deliberation Is Productive vs. Spinning

**Papers:**
- DCI: arXiv:2603.11781 (Prakash, ISB) — Deliberative Collective Intelligence
- TRACED: arXiv:2603.10384 (Jiang, Liu, Wang, Hu — ICML 2026) — Geometric Reasoning Evaluation

**Session:** 2026-03-13 (Heartbeat)
**Rating:** ★★★★★ CRITICAL — Novel synthesis not present in either paper alone

---

## 1. The Core Question

DCI's biggest weakness is its token cost: ~62× a single agent, with overall performance *below* a single agent on average. DCI only wins on hidden-profile tasks (9.56, highest of any system) and non-routine tasks. On routine tasks, it scores 5.39 — the worst. The question is: **how do you know, mid-deliberation, whether the process is producing value or just burning tokens?**

TRACED provides the answer: geometric trajectory signatures can distinguish productive reasoning (high displacement, low curvature) from unproductive reasoning (low displacement, high curvature = "Hesitation Loops").

**The synthesis:** Apply TRACED's geometric monitoring to DCI's deliberation phases to create an adaptive deliberation system that can detect — and terminate — unproductive deliberation in real time.

## 2. Mapping DCI Phases to Geometric Regimes

### 2.1 Expected Geometric Signatures by Phase

| DCI Phase | Expected Displacement | Expected Curvature | Rationale |
|-----------|----------------------|-------------------|-----------|
| φ₁ Arrival (framing) | Low-to-moderate | Low | Establishing coordinates; small semantic moves, smooth |
| φ₂ Independent First Thought | High | Low | Each agent moves rapidly to their initial position; smooth because unchallenged |
| φ₃ Mutual Engagement | Moderate-to-high | Moderate | Agents respond, challenge, extend; direction changes are expected and productive |
| φ₄ Collective Shaping | Moderate | Decreasing | Convergence: curvature should drop as positions settle |
| φ₅ Closure | Low | Low | Final synthesis; minimal new movement |

**The critical diagnostic pattern:** If curvature *increases* during φ₄ (Collective Shaping), the system is failing to converge — it's entering a Hesitation Loop at the group level. This is the geometric signature of DCI's 5.39 performance on routine tasks: agents are going through the motions of deliberation without making semantic progress toward resolution.

### 2.2 Phase Transition Signatures

Healthy deliberation should show a characteristic "curvature arc":

```
φ₁    φ₂    φ₃        φ₄      φ₅
LOW → LOW → RISING → FALLING → LOW
      ↑      ↑         ↑        ↑
   smooth  productive  convergence  settled
   setup   conflict    resolution
```

Pathological deliberation:

```
φ₁    φ₂    φ₃        φ₄      φ₅
LOW → LOW → RISING → RISING → HIGH
                       ↑         ↑
                   no convergence  forced closure
                   = spinning      = arbitrary decision
```

### 2.3 Per-Agent vs. Aggregate Signatures

TRACED operates on individual reasoning trajectories. In a DCI system, we can compute:
- **Per-agent trajectories:** Is the Challenger making productive challenges (inducing curvature in the Explorer) or spinning in its own hesitation loop?
- **Aggregate workspace trajectory:** How is the shared workspace evolving? If the workspace state's displacement stalls while curvature rises, the deliberation as a whole is unproductive.
- **Cross-agent effects:** Does Agent A's contribution change Agent B's trajectory? This measures *influence* — whether agents are genuinely responding to each other vs. monologuing.

## 3. Archetype-Specific Geometric Profiles

### 3.1 Expected Profiles

| DCI Archetype | Healthy M (Displacement) | Healthy K (Curvature) | Pathological Signal |
|---------------|--------------------------|----------------------|---------------------|
| **Framer** | Moderate | Low | High-K Framer = can't settle on problem definition → cascading instability |
| **Explorer** | **High** | Moderate | Low-M Explorer = failing to generate novel options → deliberation will stall |
| **Challenger** | Low-moderate (self) | Low (self) | High-K self = the Challenger is *confused*, not challenging |
| **Integrator** | Moderate | **Low** | High-K Integrator = can't synthesize → will produce incoherent decision packet |

### 3.2 Cross-Agent Effect Matrix

The most interesting signal is not an agent's own trajectory, but the effect of its moves on others:

| Source → Target | Expected Effect on Target M | Expected Effect on Target K |
|-----------------|---------------------------|----------------------------|
| Challenger → Explorer | Decrease (forces reconsideration) | **Increase** (productive disruption) |
| Challenger → Integrator | Slight decrease | Increase (new constraint to integrate) |
| Explorer → Challenger | Increase (new material to test) | Decrease (more concrete targets) |
| Explorer → Integrator | Increase (more to synthesize) | Moderate increase |
| Framer → All | Increase if reframe accepted | Decrease (clarification reduces oscillation) |
| Integrator → All | Increase (synthesis moves everyone forward) | **Decrease** (integration reduces conflict) |

**Key diagnostic:** If the Integrator's synthesis moves *increase* other agents' curvature rather than decreasing it, the synthesis is failing — it's creating confusion, not resolution. This is a strong signal to stop deliberation.

## 4. Deliberation Circuit Breaker Protocol

Combining DCI's phase model with TRACED's geometric monitoring yields an adaptive protocol:

### 4.1 Design

```
MONITOR:
  For each DCI round r:
    1. Compute per-agent displacement M_i(r) and curvature K_i(r)
    2. Compute aggregate workspace displacement M_w(r) and curvature K_w(r)
    3. Compute curvature delta: ΔK_w(r) = K_w(r) - K_w(r-1)

CIRCUIT BREAKER TRIGGERS:
  T1: K_w(r) > K_threshold AND M_w(r) < M_threshold for 2+ consecutive rounds
      → HESITATION LOOP detected. Deliberation is spinning.
      → Action: Force transition to φ₅ (Closure). Accept current best position.

  T2: All agent K_i(r) converge to near-zero AND M_i(r) < M_threshold
      → PREMATURE CONSENSUS. Agents have stopped engaging.
      → Action: Inject Challenger prompt or introduce new constraint.

  T3: ΔK_w(r) > 0 during φ₄ (Collective Shaping)
      → CONVERGENCE FAILURE. System is diverging when it should converge.
      → Action: (a) Switch Integrator to stronger model, (b) Reduce active agents to 2,
         or (c) Terminate and escalate to human.

  T4: Single agent K_i(r) >> mean K(r) for 3+ rounds
      → AGENT DEGRADATION. One agent is in a Hesitation Loop.
      → Action: Remove agent from deliberation. Redistribute its role.
```

### 4.2 Adaptive Token Budget

DCI's ~62× token overhead could be dramatically reduced:

- **Baseline mode:** Start all deliberation in "lightweight" mode (fewer rounds, tighter R_max).
- **Escalation:** If φ₃ shows high M (productive divergence) AND healthy K profiles, extend the round budget — the deliberation is producing value.
- **De-escalation:** If T1 or T3 fires early, terminate immediately. The ~62× cost is only justified when geometric monitoring confirms productive engagement.

**Expected savings:** On routine tasks (where DCI scored 5.39), the circuit breaker would trigger within 2-3 rounds, cutting token cost from ~62× to ~5-10×. On hidden-profile tasks (where DCI scored 9.56), the system would detect productive divergence and allow full deliberation.

## 5. Connection to Our Four Laws of Evaluator Unreliability

| Law | DCI Challenge | TRACED Resolution |
|-----|--------------|-------------------|
| **Law 1: No single evaluator is uniformly reliable** | DCI's performance is wildly task-dependent (5.39–9.56) | Geometric monitoring predicts which task *category* the deliberation is behaving like, enabling adaptive routing |
| **Law 2: Evaluator confidence is unreliable** | DCI agents report confidence via σ_i.c_i, but we've shown confidence is unreliable | Replace self-reported confidence with geometric trajectory quality as the trust signal |
| **Law 3: Disagreement is signal** | DCI preserves disagreement via tensions and minority reports | TRACED can *weight* disagreements: dissent from a high-M, low-K trajectory is more valuable than dissent from a Hesitation Loop |
| **Law 4: Editable evaluators will be compromised** | DCI's decision packets could be manipulated by a compromised agent | TRACED trajectory signatures are harder to fake than text output — a compromised agent would need to control its hidden state dynamics, not just its output text |

## 6. Connection to Other Prior Research

### 6.1 × Chaotic Dynamics (2603.09127)
The Chaotic Dynamics paper found multi-agent deliberation is sensitive to initial conditions, with divergence amplified through feedback loops. TRACED monitoring on DCI provides the first *detection mechanism* for when deliberation enters chaotic regimes. The Hesitation Loop signature (high-K, low-M) is the geometric manifestation of chaotic attractor trapping in the deliberation state space.

### 6.2 × Sim2Real Gap (2603.11245)
If our QA agent is systematically cooperative-biased (Sim2Real finding), this should be geometrically detectable: a cooperative agent in the Challenger role would show *low curvature induction* on target agents. Their challenges would fail to disrupt others' trajectories — a measurable sign of "soft" rather than genuine adversarial testing.

### 6.3 × Bug-Hunt (Three-Agent Adversarial Verification)
Bug-Hunt's Hunter/Skeptic/Referee maps to DCI's Explorer/Challenger/Integrator. TRACED provides the missing performance metric for Bug-Hunt: is the Skeptic actually being skeptical? Measure whether the Skeptic's moves increase the Hunter's trajectory curvature. If not, the Skeptic is failing its role.

### 6.4 × Imprecise Probabilities (2603.10396)
DCI decision packets should include IP-style confidence intervals, not point estimates. TRACED trajectory quality should modulate the width: high-K reasoning → wider intervals (less trust); low-K reasoning → narrower intervals (more trust). This creates a three-layer trust assessment: **what was decided** (decision packet) × **how confident** (IP intervals) × **how well-reasoned** (TRACED geometry).

## 7. Practical Implementation for Our System

### 7.1 Without Hidden State Access (API Models)

Our agents use API models where hidden states aren't available. Proxy approaches:

1. **Text-level displacement:** Compute semantic embeddings of each agent's contributions over rounds. Track displacement (cosine distance from initial to current position) and curvature (variance of direction changes between successive contributions).

2. **Typed act frequency analysis:** DCI's 14 typed epistemic acts provide a discrete proxy for trajectory dynamics:
   - High frequency of `challenge`, `reframe`, `ask` acts → high curvature
   - Increasing frequency of `synthesize`, `recommend`, `bridge` → convergence
   - Repetition of the same act type → stagnation
   - Monitor the *diversity* of act types per round as an exploration vs. exploitation signal

3. **Workspace delta analysis:** Track edit operations on the shared workspace:
   - High displacement ≈ new sections added, positions restructured
   - High curvature ≈ same sections repeatedly modified, positions oscillating
   - Convergence ≈ modifications become smaller, additions become rarer

### 7.2 Minimal Viable Implementation

For our file-based multi-agent system, the cheapest useful implementation:

1. **Tag SIGNALS.md entries with typed acts.** Add `[propose]`, `[challenge]`, `[synthesize]`, `[update]` prefixes.
2. **Track workspace deltas.** Count words added/modified per agent per round. Stalling displacement = potential Hesitation Loop.
3. **Monitor contribution diversity.** If an agent's last 3 contributions have the same structure/act type, flag as stagnation.
4. **Implement a simple circuit breaker:** If a deliberation exceeds N rounds without new information (measured by workspace delta), auto-escalate to human or force closure.

## 8. New Design Axioms

**Axiom 20: Productive Deliberation Has a Geometric Signature.**
Healthy multi-agent deliberation follows a characteristic curvature arc: low (framing) → rising (productive conflict) → falling (convergence) → low (closure). Deviations from this arc — especially rising curvature during convergence phases — indicate the deliberation is failing and should be terminated.

**Axiom 21: Influence Is Measurable.**
An agent's effectiveness in a deliberation is not measured by the quality of its own reasoning, but by the effect of its contributions on other agents' reasoning trajectories. A Challenger that doesn't change anyone's trajectory is not challenging. An Integrator whose synthesis increases others' curvature is not integrating.

**Axiom 22: Deliberation Cost Should Be Adaptive, Not Fixed.**
Multi-agent deliberation's ~62× token overhead is only justified when geometric monitoring confirms productive engagement. Routine tasks should be detected early (low-M, low-K profiles) and routed to single-agent processing. Full deliberation budget should be reserved for tasks that show genuine divergence in agent perspectives.

## 9. Summary

DCI provides the *process model* for structured multi-agent deliberation: typed acts, phased progression, decision packets. TRACED provides the *monitoring instrument*: geometric trajectory signatures that distinguish productive reasoning from Hesitation Loops. Neither paper references the other. Together they create something neither achieves alone:

**An adaptive deliberation system that knows when to keep talking and when to stop.**

This synthesis directly addresses DCI's central weakness (catastrophic cost on routine tasks) and TRACED's central limitation (individual reasoning only, not group dynamics). The circuit breaker protocol + adaptive token budget could potentially improve DCI's overall efficiency by 5-10× while preserving its unique strength on hidden-profile tasks.

For our system specifically: even without hidden state access, the text-level proxy approaches (typed act frequency, workspace delta analysis, contribution diversity) provide actionable approximations that can be implemented with our existing file-based architecture.
