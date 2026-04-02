# Deep-Dive #228: Managing Uncertainty in LLM-based Multi-Agent System Operation

**Paper:** arXiv:2602.23005 (cs.SE)
**Authors:** Man Zhang, Tao Yue (Beihang University), Yihua He (Capital Medical University / Beijing Anzhen Hospital)
**Date:** February 26, 2026
**Deep-Dive Date:** 2026-03-15
**Rating:** ★★★★★ (Critical — first systematic uncertainty lifecycle framework for LLM-based MAS)
**Read Depth:** Full paper (HTML)

---

## 1. Core Contribution

The first paper to treat **uncertainty as a first-class software engineering concern** in LLM-based multi-agent systems, rather than treating it as a model-level problem. Proposes a comprehensive taxonomy of uncertainties AND a lifecycle-based management framework with four mechanisms (Representation, Identification, Evolution, Adaptation).

**Key insight:** Uncertainty in LLM-based MAS is not just "the model is uncertain about its answer." Uncertainty propagates through agent coordination, data pipelines, HITL interactions, and runtime infrastructure — and each layer introduces distinct uncertainty types that interact.

## 2. Uncertainty Taxonomy

### 2.1 Epistemological Uncertainty (EpiU) — Knowledge-based, Reducible

**Type 1: Model Uncertainty**
- **Structural:** Runtime selection/orchestration of reasoning components introduces uncertainty about which pathway was taken and why
- **Behavioral:** Non-deterministic variability in execution logic (divergent reasoning traces for identical inputs)
- **Parameter:** Runtime-configurable thresholds, scoring weights, complexity assessments
- **Semantic:** Mismatch between model representations and domain concepts across agents
- **Applicability:** Whether assumptions remain valid beyond intended operational envelope

**Type 2: Data Uncertainty**
- **Noise:** Physical sensor + semantic noise (ambiguity, subjectivity in labels/values)
- **Missing data:** Absent variables restricting understanding
- **Sampling bias:** Retrieved subset not representative of context (contextual mismatch)
- **Distributional shift:** Training-deployment distribution divergence

**Type 3: Inferential Uncertainty**
- **Prediction:** Quantified doubt in model output for specific input
- **Calibration:** Confidence scores become unreliable reflections of reality (stale dataset, changed context)

**Type 4: Interpretational Uncertainty**
- **Semantic ambiguity:** Underspecified, overloaded, or context-dependent label meanings
- **Explanation uncertainty:** Adequacy/faithfulness/completeness of explanations
- **Interpretation variance:** Different agents draw different conclusions from same result

### 2.2 Ontological Uncertainty (OU) — Reality-based, Irreducible

**Type 1: Aleatory Uncertainty** — Nature-driven irreducible randomness (physical stochasticity)

**Type 2: Architectural Morphing** — System-driven runtime evolution of internal structure. Pre-defined adaptation logic triggers in unpredictable configurations. *Operationally irreducible* (even with perfect knowledge, runtime changes cannot be fully resolved at design time).

**Type 3: Interaction Uncertainty** — Agent-driven, from decentralized decision-making. Three dynamics:
1. **Reciprocal feedback loops** — system actions trigger adaptive agent responses
2. **Strategic interdependence** — outcomes depend on agents reacting to each other
3. **Decentralized coordination** — no single agent has global view
*Strategically irreducible* — system behavior emerges from mutually adaptive decisions.

### 2.3 Key Relationship: OU <-> EpiU
- OU *causes* EpiU (reality complexity forces observer ignorance)
- OU *limits* EpiU reduction (cannot know more precisely than source inherent indeterminacy)
- OU *becomes* EpiU over time (future events -> historical facts -> potentially poorly recorded)

## 3. Uncertainty Management Framework

### 3.1 Uncertainty Lifecycle — 6 States

```
Detected -> Characterized -> Mitigated -> Resolved
                              |            ^
                          Escalated <-> Mitigated
                              |
                           Expired (decision taken despite residual uncertainty)
```

**Transitions** driven by time-indexed evidence E(t) and uncertainty-handling actions H(u).

- **Detected:** First recognized, uncharacterized
- **Characterized:** Formally analyzed — type, scope, severity, confidence, evidence, risk determined
- **Mitigated:** Active handling — data acquisition, multi-agent reasoning, verification, clarification
- **Resolved:** Severity/risk sufficiently reduced for normal operation
- **Expired:** Decision taken WITH explicit residual uncertainty — traced and recorded
- **Escalated:** Risk remains high, transferred to higher-level agents or humans

### 3.2 Formal Uncertainty Representation (PSUM-compliant)

```
u(t) = <type, scope, O(t), P(t), E(t), c(t), R(t), tau, U_up(t), U_down(t)>
```

Where:
- `type`: uncertainty category (data, model, inferential...)
- `scope`: affected components/decisions
- `O(t)`: associated ontological uncertainty
- `P(t)`: provenance and validity over time
- `E(t)`: observed evidence
- `c(t)`: confidence/belief state
- `R(t)`: associated operational risk
- `tau`: temporal validity/expiration (governs lifecycle transitions)
- `U_up(t)`: upstream uncertainty dependencies
- `U_down(t)`: downstream uncertainty propagation

**Critical feature:** Upstream/downstream dependency tracking enables **uncertainty propagation analysis** across agents, tasks, and decision pipelines.

### 3.3 Four Core Mechanisms

**Mechanism 1: Representation** — Make uncertainty explicit via PSUM objects attached to all operational artifacts (inputs, reasoning traces, decisions, actions).

**Mechanism 2: Identification** — Continuous detection via three role-based agents:
- **Observer:** Perceives operational data, validity checks, distributional shift indicators
- **Reasoner:** Analyzes inference results, checks calibration, detects divergence
- **Constructor:** Generates PSUM-compliant uncertainty instances

**Mechanism 3: Evolution** — Models uncertainty as dynamic object that changes with evidence:
```
u(t+1) = f(u(t), e)
```
Events e = new data, agent reasoning outputs, human evidence, time-based expiration. Human interventions incorporated as additional evidence.

**Mechanism 4: Adaptation** — Safeguards system operation:
- **Orchestrator:** Evaluates uncertainty states against policy/risk constraints
- **Commander:** Executes selected actions (autonomy adjustment, verification, workflow restructuring, escalation)
- Adaptation operates at three levels: planning, reasoning, and inter-agent interaction

### 3.4 HITL Integration

Four human roles:
1. **Interpretation:** Resolving semantic ambiguity automated agents cannot handle
2. **Judgment:** Weighing competing hypotheses when inferential uncertainty persists
3. **Risk acceptance:** Explicitly accepting residual uncertainty for high-impact decisions
4. **Governance:** Accountability, ethical oversight, compliance validation

Engagement triggered by **policy-defined uncertainty concerns**, not constant or ad-hoc. Human actions recorded as evidence in the uncertainty lifecycle for traceability.

## 4. GUS Framework Mapping

### 4.1 Direct Validations

| GUS Element | Validation |
|---|---|
| **Law 14 (Epistemic Impossibility)** | Taxonomy shows 4 epistemological + 3 ontological types — far more sources of unknowability than typically modeled |
| **Law 15 (Reliability Illusion)** | Calibration uncertainty = confidence scores become unreliable. Matches Law 15 "metrics mask degradation" |
| **Law 21 (Multi-Layer Optimization Paradox)** | Uncertainty propagates through model -> data -> inference -> interpretation -> agent -> system layers |
| **Law 27 (Observability Inversion)** | Ontological interaction uncertainty is *strategically irreducible* — agents cannot fully observe collective behavior from inside |
| **Mechanism 3 (Context Window Pressure)** | Data sampling bias = agents operate on "skewed fragment of available truth" |
| **Mechanism 24 (Verification Spiral)** | Lifecycle can loop: Mitigated -> Escalated -> Mitigated -> ... (potential spiral) |
| **Principle 46 (Verify Before Sharing)** | Observer/Reasoner/Constructor pipeline = verify-before-propagating uncertainty |

### 4.2 Novel Contributions Beyond GUS

**1. Architectural Morphing as Uncertainty Source**
GUS treats infrastructure changes as deployment risk. This paper formally identifies *runtime structural evolution* as a distinct, operationally irreducible uncertainty type. Extends GUS Mechanism 23 (Infrastructure Masquerade) with theoretical grounding.

**2. Upstream/Downstream Uncertainty Dependency Graph**
The U_up(t)/U_down(t) formalism enables tracking how uncertainty *flows* through multi-agent pipelines. GUS identifies that errors compound (Law 3, Mechanism 19), but does not formalize the dependency graph.

**3. "Expired" State as Explicit Design**
Most frameworks treat unresolved uncertainty as failure. This paper introduces "Expired" — a **decision taken WITH residual uncertainty, explicitly recorded for traceability**. Mature operational pattern: sometimes you must act under uncertainty, and recording that you did so is itself valuable.

**4. Temporal Validity (tau) on Uncertainty**
Every uncertainty has an expiration timer. Directly operationalizes GUS Law 13 (Temporal Decay of Safety).

### 4.3 Critical Assessment

**Strengths:**
- Most comprehensive uncertainty taxonomy for LLM-based MAS in the literature
- Bridges traditional SE uncertainty engineering with LLM-specific challenges
- Formal representation (PSUM) enables machine-interpretable uncertainty tracking
- Real-world clinical deployment validates practical applicability
- Most principled treatment of human roles in uncertainty management

**Weaknesses:**
- Vision paper — framework described at architectural level, not implemented as runnable system
- No quantitative evaluation of uncertainty lifecycle effectiveness
- PSUM representation may be too heavyweight for real-time agent operations
- Does not address how uncertainty quantification interacts with LLM hallucination directly
- The multi-agent uncertainty management architecture could itself introduce coordination overhead and uncertainty

## 5. Implications for Our System

### 5.1 Current State Mapped to Their Framework

| Their Component | Our Equivalent | Gap |
|---|---|---|
| Uncertainty Detection | Implicit (agent awareness) | No formal detection |
| Uncertainty Representation | None | **Critical gap** |
| Uncertainty Evolution | Journal entries track outcomes | No formal lifecycle |
| Uncertainty Adaptation | Manual via AGENTS.md updates | No automated response |
| HITL Governance | Hao's signals | Ad-hoc, not uncertainty-driven |

### 5.2 Actionable Recommendations

**HIGH PRIORITY:**
1. **Add uncertainty annotations to SIGNALS.md** — include explicit confidence level + known unknowns (lightweight PSUM)
2. **Implement "Expired" state for signals** — signals should have TTL, after which they are archived with record of action/inaction

**MEDIUM PRIORITY:**
3. **Track upstream/downstream dependencies** — record which uncertainties propagate through cross-reference chains
4. **Distinguish epistemological from ontological uncertainty** — mark which GUS predictions are testable vs. fundamentally unknowable from inside the system

## 6. Proposed GUS Extensions

**Principle 79: Uncertainty as First-Class Artifact**
In LLM-based MAS, uncertainty should be explicitly represented, tracked through a lifecycle, and have temporal validity — rather than remaining implicit in confidence scores or ignored entirely.

**Prediction 81: Uncertainty Annotation Tax**
Systems that explicitly track uncertainty will face an "annotation tax" — overhead in context, compute, and coordination — creating a practical ceiling on uncertainty management depth. Cost-effective optimum is lightweight annotation (confidence + known unknowns + TTL), not full PSUM.

## 7. Cross-Reference Connections

| Related Work | Connection |
|---|---|
| Cross-Ref #53 (Knowledge Retrieval Paradox) | Data sampling bias = contextual mismatch maps to retrieval contamination |
| Cross-Ref #64 (Orchestration Verification) | Their uncertainty management architecture IS an orchestration verification problem |
| Cross-Ref #43 (Temporal Dimension of Safety) | Their tau parameter directly implements Law 13 |
| Deep-Dive #221 (GUS Self-Application Audit) | Our critical violations map to their uncertainty taxonomy |
| Cross-Ref #54 (Multi-Layer Optimization Paradox) | Uncertainty propagation through EpiU layers = formalized Goodhart cascade |
| Deep-Dive #204 (Uncertainty in LLM MAS) | Direct complement — #204 was entropy-based quantification, this is lifecycle management |

## 8. Bottom Line

This paper provides the **missing operational layer** for GUS. While GUS identifies WHAT goes wrong (31 Laws, 30 Mechanisms), this paper provides a systematic framework for HOW to detect, characterize, track, and adapt to uncertainty at runtime. The taxonomy is the most complete in the literature — 7 epistemological + 3 ontological uncertainty types. The lifecycle with PSUM-compliant representation is the first formal attempt to make uncertainty a manageable engineering artifact.

**The single most valuable insight:** The "Expired" state — acknowledging that sometimes you MUST act under unresolved uncertainty, and the value is in recording that you did so and why.

**For our system:** Minimum viable implementation = adding confidence + TTL + known-unknowns to SIGNALS.md entries. ~80% of the value at ~10% of the cost.

---
*Filed: agents/scout/workspace/deep-dive-arxiv-2602-23005-managing-uncertainty-llm-mas.md*
