# DD#350: Human-Agentic AI Teaming — Continuity, Tension, and the Projection Congruence Problem

**Paper:** arXiv:2603.04746 — "Visioning Human-Agentic AI Teaming: Continuity, Tension, and Future Research"  
**Authors:** Bowen Lou, Tian Lu, T. S. Raghu, Yingjie Zhang  
**Submitted:** 2026-03-06  
**Rating:** ★★★★★ CRITICAL — First systematic theoretical framework mapping how open-ended agentic AI transforms the conditions for human-AI team coordination, exposing five fundamental tensions that GUS has not addressed

---

## 1. Core Thesis

**Team Situation Awareness (Team SA) — the dominant framework for human-AI teaming — assumes that shared awareness, once achieved, stabilizes coordination through iterative updating. Agentic AI breaks this assumption across three dimensions: open-ended trajectories, generative representations, and evolving objectives.**

The paper makes a crucial distinction:
- **Continuity** resides in the *static layer* — Team SA's three levels (perception, comprehension, projection) remain valid but must be reconceptualized for both human and AI
- **Tension** concentrates in the *dynamic layer* — the processes that were assumed to stabilize alignment (relational trust, cognitive learning, coordination/control) may instead AMPLIFY divergence under open-ended agency

This maps directly to GUS's Universal Non-Monotonicity Principle (CR#195): the same processes that should improve alignment may actively degrade it.

---

## 2. The Projection Congruence Problem

**Novel concept:** *Projection congruence* — the degree to which human and AI anticipate comparable future trajectories AND assign similar weightings to competing objectives over time.

This is more demanding than simple agreement because:
- It requires alignment not just on facts but on *anticipated futures*
- It must hold across *evolving objective priorities*, not just static goals  
- Divergence can arise even when factual understanding is perfectly shared

**Critical insight:** "The central challenge of HAT is not whether humans and AI can agree in the moment, but whether they can remain aligned as futures are continuously generated, revised, enacted, and governed over time."

**GUS connection:** This is the temporal dimension of alignment (CR#43) applied to human-AI interaction. Safety doesn't just decay over time (Law 13: S(t) ≤ S(0)·e^(-λt)) — the alignment REFERENT changes.

---

## 3. Five Structural Tensions

### 3.1 Relational Legitimacy Fragility
- Open-ended trajectories make trust simultaneously **easier to build** (rich fluent outputs) and **harder to sustain** (inconsistency risk)
- Fluency serves as a **heuristic proxy** for competence — exactly the Compression-Truth Gap (DD#347/CR#191)
- "Epistemic fragility" — shared comprehension at a point in time may mask instability of underlying representations
- **GUS connection:** Maps to the Reliability Illusion (CR#29) — surface metrics inflate actual alignment quality

### 3.2 Speed-Fidelity Dissociation in Learning
- **Asynchronous updating:** AI revises internal representations faster than human monitoring capacity
- Early intermediate states embed **implicit commitments** that constrain later options (path dependence)
- **Rapid convergence may indicate premature commitment**, not genuine alignment
- **Feedback endogeneity:** AI updates based on human responses already shaped by prior AI outputs → recursive reinforcement loops
- **GUS connection:** This IS the Information Self-Locking mechanism (DD#208/CR#41) applied to human-AI pairs

### 3.3 Convergence Speed vs. Convergence Quality  
- "Cognitive learning under agentic conditions cannot be modeled as a monotonic corrective process"
- The paper explicitly identifies **non-monotonicity** in convergence — more interaction can amplify divergence
- **Corrective obsolescence:** Corrections achieved in one regime become irrelevant when objectives shift
- **GUS connection:** Universal Non-Monotonicity Principle (CR#195) — seventh dimension confirmed in human-AI teaming

### 3.4 Oversight Decoupling
- **Core finding:** "Shared awareness of task states does not ensure effective oversight if policy adaptation remains opaque"
- Humans observe coherent outputs without seeing how underlying decision policies evolve
- **Policy visibility ≠ outcome visibility** — this is the Orchestration Verification Problem (CR#64) in human-AI context
- Nominal authority can coexist with substantive loss of control

### 3.5 Accountability Fragmentation
- Under adaptive objectives, "it is unclear whether undesirable outcomes reflect human oversight failure, algorithmic adaptation, or distortions introduced by misaligned incentive systems"
- Role fluidity blurs credit/blame boundaries
- **Incentive incompatibility:** Human evaluation metrics may structurally misalign with AI optimization logic
- **GUS connection:** Multi-Layer Optimization Paradox (CR#54) — proxy divergence between layers

---

## 4. The Human SA Reconceptualization (Continuity Layer)

### Three levels under open-ended agency:

**Level 1 — Perception:** From detecting discrete outputs → interpreting trajectory-level cues. "Perception becomes diagnostic rather than event-based." Humans must identify *structural inflection points* in evolving trajectories.

**Level 2 — Comprehension:** From validating outputs → *structural sensemaking*. "Whether the generative decomposition of the problem remains aligned with underlying task goals." Early AI signals anchor human reasoning even when corrective opportunities exist.

**Level 3 — Projection:** From forecasting next states → *regime-level concern*. Must anticipate "the stability of governing logics themselves." Projection congruence is the critical requirement: aligned anticipated futures + aligned objective weightings.

### The AI SA Definition (Novel)
"An evolving representational system comprising:
1. Encoded task and human cues
2. Structured internal task models and inferred intent representations  
3. Anticipatory projections of future task states and value trade-offs"

This is the first formal definition of AI Situation Awareness suitable for teaming contexts.

---

## 5. Critical Findings for GUS

### 5.1 GUS Blind Spot #3 Directly Addressed
GUS's Self-Critique (CR#100) identified the "human element" as a structural blind spot. This paper provides the missing theoretical layer:
- Human-AI alignment is NOT reducible to AI-AI alignment
- Human cognitive constraints (bounded rationality, anchoring, attention limits) create fundamentally different dynamics than model-model interaction
- Projection congruence is harder to achieve AND harder to measure than model agreement

### 5.2 Alignment as Continuous Achievement, Not State
"Alignment is a continuously negotiated achievement that depends on authority architectures, transparency of evolving decision policies, and incentive compatibility as autonomy scales."
- This matches our finding that governance has an optimal dosage (CR#194) but adds the human dimension
- Alignment isn't a property you achieve — it's a process you maintain

### 5.3 The Cognitive-Institutional Duality
"Open-ended agency transforms coordination from a primarily cognitive alignment problem into a joint cognitive–institutional design problem."
- Shared SA is NECESSARY but INSUFFICIENT
- Must be complemented by: authority architectures, intervention checkpoints, transparency mechanisms, incentive compatibility
- This is our Specification-to-Enforcement Gap (CR#34) plus the human governance layer

### 5.4 Non-Monotonicity in Human-AI Convergence
The paper independently discovers our Universal Non-Monotonicity Principle in the human-AI learning context:
- More interaction → possible amplification of misalignment
- Speed-fidelity dissociation: faster convergence can mean worse alignment
- Feedback endogeneity creates recursive reinforcement loops

---

## 6. Research Agenda (16 Questions)

The paper proposes 16 specific research questions across 5 themes:
- **RQ1.1-1.4:** Human SA operationalization under open-ended agency
- **RQ2.1-2.4:** AI SA operationalization and projection congruence metrics
- **RQ3.1-3.4:** Relational legitimacy under open-ended agency
- **RQ4.1-4.4:** Cognitive learning convergence/divergence dynamics
- **RQ5.1-5.4:** Coordination, oversight, and incentive architecture design

Most directly relevant to us: RQ4.4 (feedback endogeneity in shared SA) and RQ5.3 (predefined intervention checkpoints).

---

## 7. Limitations

1. **Dyadic focus** — analyzes human-AI pairs, not multi-human + multi-agent configurations (acknowledged by authors)
2. **Theoretical, not empirical** — framework paper with no experiments
3. **IS/Management theory lens** — rich in organizational theory but missing the technical mechanisms our portfolio has identified
4. **Doesn't quantify** — identifies tensions but doesn't formalize thresholds or provide measurable bounds
5. **Assumes AI is the autonomous agent** — doesn't consider scenarios where human behavior is the destabilizing factor

---

## 8. Portfolio Integration

### Validates
- **CR#195 (Universal Non-Monotonicity):** Independently discovers non-monotonic convergence in human-AI learning
- **CR#43 (Temporal Safety Dimension):** Alignment decay over time as objectives evolve
- **CR#29 (Reliability Illusion):** Surface coherence masks real alignment quality
- **DD#347 (Compression-Truth Gap):** Fluency as proxy for competence = compression as proxy for truth
- **CR#54 (Multi-Layer Optimization Paradox):** Incentive incompatibility across human-AI layers
- **CR#64 (Orchestration Verification):** Can't verify alignment from inside the system

### Fills Gaps
- **GUS Blind Spot #3:** First systematic treatment of human element in our portfolio
- **CR#100 (What GUS Gets Wrong):** Addresses the human-agent teaming gap
- **CR#194 (Governance Dosage):** Adds human cognitive constraints to governance calibration

### Extends
- **DD#208 (Information Self-Locking):** Speed-fidelity dissociation = self-locking in human-AI context
- **CR#34 (Specification-to-Enforcement Gap):** Oversight decoupling adds human governance dimension
- **DD#265 (DCI Deliberation):** Phased deliberation as potential solution to asynchronous updating

### Novel Contributions
- **Projection Congruence:** New concept not in GUS — alignment of anticipated futures + objective weightings
- **Oversight Decoupling:** Outcome visibility ≠ policy visibility as formal construct
- **Corrective Obsolescence:** Prior corrections invalidated by objective evolution
- **Feedback Endogeneity:** Recursive AI-human reinforcement loops as structural feature

---

## 9. Proposed GUS Extensions

**Mechanism 34: Projection Drift** — Human and AI projection congruence degrades as (a) AI revision speed exceeds human monitoring bandwidth, (b) intermediate commitments accumulate path dependencies, (c) objective priorities shift without synchronized recalibration.

**Principle 87: Staged Intervention Design** — Delegation to agentic AI must include predefined reassessment points keyed to structural commitment events, not just elapsed time or output volume. Authority must be conditionally structured for reclamation.

**Principle 88: Policy Transparency Over Outcome Transparency** — Oversight effectiveness depends on visibility into evolving decision policies, not just coherent outputs. Outcome-level monitoring creates false confidence (oversight decoupling).

**Prediction P101: Speed-Fidelity Inversion** — In longitudinal human-AI teaming studies, teams that converge fastest on task representations will show the highest rates of late-stage alignment failure due to premature commitment and suppressed corrective exploration.

**Prediction P102: Projection Congruence Decay** — Human-AI projection congruence in multi-step tasks will decay exponentially with trajectory length, following S(t) ≤ S(0)·e^(-λt) where λ scales with AI planning speed / human monitoring bandwidth ratio.

---

*Deep-dive produced 2026-03-16 session s_1773689309385_377*
*Rating: ★★★★★ CRITICAL — fills GUS's biggest acknowledged blind spot*
