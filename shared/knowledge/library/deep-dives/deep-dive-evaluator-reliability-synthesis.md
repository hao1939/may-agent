# Cross-Reference Synthesis: Evaluator Reliability — When Judges Disagree, Drift, and Hallucinate

**Date:** 2026-03-28
**Type:** Cross-reference synthesis (7 papers + 1 repo)
**Sources:**
- CUAAudit (2603.10577) — VLM auditor meta-evaluation
- TRACED (2603.10384) — Geometric reasoning quality assessment
- JRH (2603.05399) — Judge Reliability Harness
- Bias-Bounded Eval (2603.05485) — Provably unbiased LLM judges
- ADVERSA (2603.10068) — Multi-turn guardrail degradation
- Chaotic Dynamics (2603.09127) — Inter-run divergence in multi-LLM deliberation
- Bug-Hunt (danpeg/bug-hunt repo) — Adversarial 3-agent verification
- LDP Room Model (2603.08852) — Identity-aware protocol with formal roles

---

## 1. The Central Problem: Evaluation Is the Bottleneck

Seven independent research threads converge on a single uncomfortable truth: **evaluating agent behavior is harder than performing it, and current evaluators are unreliable in ways that compound across multi-agent systems.**

Each paper attacks a different facet of this problem:

| Paper | Evaluator Failure Mode | Domain |
|-------|----------------------|--------|
| CUAAudit | VLM auditors disagree on task completion (κ=0.54-0.76); accuracy drops 15-25% on complex environments | Computer-use agents |
| TRACED | Scalar probability fails to detect hallucinations; geometric signatures (displacement+curvature) needed | Reasoning chains |
| JRH | Format perturbations (whitespace!) cause larger reliability drops than semantic changes | Safety benchmarks |
| Bias-Bounded | Judge bias exists and cannot be eliminated — can only be bounded | Arena rankings |
| ADVERSA | Judges disagree on guardrail violations; triple-judge consensus still unstable | Red-teaming |
| Chaotic Dynamics | Same evaluator on same input produces divergent trajectories across runs | Deliberation |
| LDP Provenance Paradox | Unverified self-reported confidence degrades synthesis quality below no-confidence baseline | Delegation |

## 2. Three Laws of Evaluator Unreliability

### Law 1: No Single Evaluator Is Uniformly Reliable
- **JRH:** Reliability is a property of the (model × task × perturbation) triple, not the model alone
- **CUAAudit:** GPT-4o leads on macOS (0.91) but Claude leads on Windows (0.75) and OSWorld (0.79)
- **ADVERSA:** Claude is most vulnerable to jailbreaks (40%) but other models over-trigger false positives
- **Implication:** Any system relying on a single evaluator will have blind spots that vary by domain

### Law 2: Evaluator Confidence Is Unreliable Unless Externally Verified
- **LDP Provenance Paradox:** Self-reported confidence without verification is worse than no confidence at all
- **CUAAudit Calibration:** Brier scores show open-source models are systematically overconfident (0.097-0.167) vs proprietary (0.058-0.099)
- **Bias-Bounded Eval:** Even calibrated judges exhibit format-sensitive bias that inflates/deflates scores
- **TRACED:** Scalar probability (the model's own confidence) fails to detect hallucinations — you need to look at the trajectory geometry, not the model's self-assessment
- **Implication:** Never trust an evaluator's self-reported confidence. External verification or structural signatures are required.

### Law 3: Multi-Evaluator Disagreement Is Signal, Not Noise
- **CUAAudit:** Inter-model κ drops from 0.76 (macOS, proprietary pair) to 0.54 (Windows, cross-family) — disagreement indicates task ambiguity
- **ADVERSA:** Triple-judge consensus masks systematic biases (all three judges share correlated failure modes on specific attack patterns)
- **Bug-Hunt:** Intentional disagreement (Hunter vs. Skeptic) + neutral arbitration (Referee) outperforms any single balanced reviewer
- **Chaotic Dynamics:** Even a single evaluator disagrees with itself across runs on identical input — inter-run κ can be as low as 0.3
- **Implication:** Design for disagreement. Extract signal from where evaluators diverge, not just where they agree.

## 3. Two Paradigms for Handling Unreliable Evaluators

### Paradigm A: Bound the Bias (Statistical)
**Source:** Bias-Bounded Eval, CUAAudit, JRH

Accept that evaluators are biased and unreliable. Don't try to fix them — bound their impact:
1. **Perturbation testing** (JRH): Run the same evaluation with format perturbations (whitespace, ordering, indentation). Measure sensitivity. If a score changes by >τ on format perturbation, flag as unreliable.
2. **Calibrated noise injection** (Bias-Bounded): Add Gaussian noise calibrated to measured sensitivity. Apply Lipschitz shrinkage to extreme scores. Provides (τ, δ) guarantees on ranking stability.
3. **Multi-model Brier scoring** (CUAAudit): Track calibration per evaluator per environment. Weight evaluator contributions by demonstrated calibration quality.
4. **Environment-specific reporting** (CUAAudit): Never aggregate metrics across environments — report per-domain performance and flag domains where calibration degrades.

### Paradigm B: Structural Verification (Architectural)
**Source:** Bug-Hunt, LDP Room Model, TRACED

Don't rely on evaluator judgment at all. Use structural properties:
1. **Adversarial role composition** (Bug-Hunt): Weaponize bias by assigning opposing biases to different agents (over-report → challenge → arbitrate). Each agent is individually biased but the composition is approximately unbiased.
2. **Formal role protocols** (LDP Room Model): Chair controls agenda, Recorder captures consensus, Verifier checks claims against evidence, Arbitrator resolves disputes. Protocol structure prevents common failure modes (groupthink, anchoring, authority bias).
3. **Geometric trajectory analysis** (TRACED): Instead of asking "is this reasoning correct?" (a judgment call), measure geometric properties of the reasoning trace (displacement = progress, curvature = stability). Hallucinations have a measurable geometric signature (low displacement, high curvature) that doesn't require judgment.
4. **Information flow control** (Bug-Hunt): Complete context isolation between evaluator stages prevents anchoring. Structured data as the only interface prevents narrative contamination.

## 4. Mapping to Our System

### Current Evaluator Architecture
Our system uses a QA/evaluator agent that reviews coder output. This is a **single-evaluator design** — vulnerable to all three laws above.

### Recommended Improvements (Priority Order)

#### P1: Format Perturbation Testing (Low effort, immediate value)
From JRH + CUAAudit. Before trusting any evaluation result:
- Re-run with whitespace changes, response reordering
- If verdict changes → flag as low-confidence
- Cost: near zero (just prompt formatting variations)

#### P2: Adversarial Role Decomposition (Medium effort, high value)
From Bug-Hunt. Split single evaluator into:
- **Advocate** (biased toward accepting the code — looks for strengths)
- **Critic** (biased toward rejecting — looks for flaws)
- **Judge** (neutral — receives structured reports from both, renders verdict)
- Each runs in complete isolation — no shared context
- Information flows through structured reports only

#### P3: Geometric Hallucination Detection (High effort, novel capability)
From TRACED. For reasoning-heavy evaluations:
- Monitor the evaluator's own reasoning trajectory geometry
- Flag evaluations where the evaluator's reasoning shows low displacement + high curvature (hallucination signature)
- This catches cases where the evaluator *confidently produces wrong judgments* — the most dangerous failure mode

#### P4: Provenance-Verified Confidence (Medium effort, systemic improvement)
From LDP Provenance Paradox. When one agent provides input to another:
- Attach structured provenance (source agent, method, confidence, verification status)
- **Critical:** Confidence fields must be verified (backed by evidence) or omitted entirely
- Never propagate self-reported-only confidence — it's worse than nothing

#### P5: Calibration Tracking Over Time (Low effort, ongoing value)
From CUAAudit + Bias-Bounded. Track evaluator performance over time:
- Per-task-type accuracy and Brier score
- Flag domains where calibration degrades
- Weight future evaluations by demonstrated calibration

## 5. Bug-Hunt × LDP Room Model Cross-Reference

The deferred cross-reference reveals a clean mapping:

| LDP Room Role | Bug-Hunt Agent | Function |
|--------------|---------------|----------|
| **Chair** | **Orchestrator (SKILL.md)** | Controls agenda, information flow, turn order |
| **Participant** | **Hunter** | Generates claims/findings |
| **Verifier** | **Skeptic** | Challenges claims against evidence |
| **Arbitrator** | **Referee** | Resolves disputes, renders final judgment |
| **Recorder** | (implicit in SKILL.md) | Captures structured bug reports |

**Key difference:** Bug-Hunt achieves this through prompt engineering and context isolation in a single-session skill. LDP formalizes it as a protocol with identity cards, session governance, and trust domains. Bug-Hunt is a pragmatic hack; LDP is a theoretical framework. Both converge on the same role structure.

**What Bug-Hunt gets right that LDP doesn't test:**
1. **Asymmetric scoring** — weaponizing LLM sycophancy by aligning natural biases with role requirements
2. **Information flow restriction** — not just session governance, but *content filtering* (only structured data passes, no narrative)
3. **Early exit** — zero findings → skip verification stages entirely

**What LDP adds that Bug-Hunt lacks:**
1. **Provenance** — Bug-Hunt has no confidence tracking or verification status
2. **Progressive payload modes** — Bug-Hunt passes everything as text; semantic frames could reduce tokens 37%
3. **Trust domains** — Bug-Hunt assumes all agents are equally trusted; LDP allows trust-level boundaries
4. **Session persistence** — Bug-Hunt is one-shot; LDP supports multi-round governed sessions

**Synthesis:** The ideal evaluator architecture would combine Bug-Hunt's adversarial role composition and asymmetric scoring with LDP's provenance verification and session governance. The resulting protocol would be:
1. Structured roles with intentional bias composition (Bug-Hunt)
2. Identity-aware routing to assign appropriate model strengths to each role (LDP)
3. Verified provenance on all inter-role communications (LDP)
4. Context isolation enforced by protocol, not just prompt engineering (LDP)
5. Asymmetric incentive structures per role (Bug-Hunt)

## 6. TRACED: Why This Matters for Agent Evaluation

TRACED's geometric decomposition is not just a reasoning evaluation tool — it's a **meta-evaluator**. The insight is profound:

> Don't ask "is the evaluation correct?" Instead, measure the geometric signature of the evaluation process itself.

Applied to our system:
- When QA reviews code, its reasoning trace has a geometry
- If the trace shows low displacement (not progressing toward a conclusion) and high curvature (oscillating between judgments), the evaluation itself is unreliable — regardless of what verdict it outputs
- This provides **evaluator reliability without a meta-evaluator** — you're measuring structural properties of the trace, not making another judgment call

**Connection to Chaotic Dynamics (2603.09127):** The chaotic divergence between runs maps directly to TRACED's instability metric (curvature). A system that produces chaotic evaluations across runs will show high curvature variance. TRACED provides the mathematical framework to detect and quantify this.

**Connection to JRH format perturbation:** JRH measures evaluator sensitivity to format changes. TRACED measures evaluator reasoning quality via geometry. These are complementary: JRH tells you *when* the evaluator is unreliable (which perturbations break it), while TRACED tells you *why* (the reasoning trajectory is geometrically degenerate).

## 7. CUAAudit: Implications for Visual Agent Evaluation

CUAAudit's findings directly challenge the assumption that "more capable models = better evaluators":

| Finding | Implication |
|---------|------------|
| Accuracy drops 15-25% on complex environments | Environment-specific calibration is mandatory |
| Calibration ≠ accuracy (can have right answers with wrong confidence) | Must track both independently |
| Inter-model κ=0.54-0.76 (substantial disagreement) | Single-evaluator verdicts are unreliable |
| Open-source overconfidence (Brier 0.097-0.167) | Never use self-reported confidence from smaller models |
| macOS > Windows > Linux (consistent accuracy ordering) | UI complexity directly impacts evaluator reliability |

**For our system:** Our agents work in a file-system/code environment (most analogous to Linux terminal — the hardest environment in CUAAudit). This means evaluator reliability in our domain is likely at the lower end of the spectrum. We should assume higher disagreement rates and calibrate accordingly.

## 8. Updated Design Axioms

Based on this synthesis, I'm adding to our growing list of design axioms:

1. **"Evaluator reliability is not a property of the evaluator"** — it's a property of the (evaluator × task × environment × format) tuple. (From JRH, CUAAudit)
2. **"Self-reported confidence is worse than no confidence unless externally verified"** — The Provenance Paradox. (From LDP)
3. **"Design for disagreement, not consensus"** — Extract signal from divergence, not agreement. (From CUAAudit, Bug-Hunt, Chaotic Dynamics)
4. **"Measure traces, not verdicts"** — Geometric properties of evaluation trajectories detect unreliability without meta-evaluation. (From TRACED)
5. **"Bias composition > bias elimination"** — Compose intentionally biased evaluators rather than trying to make one unbiased evaluator. (From Bug-Hunt, MaMa)

## 9. Connection to Prior Syntheses

| Prior Synthesis | Connection |
|----------------|------------|
| Three-Layer Verification | This synthesis provides the *evaluator reliability framework* that the Three-Layer Architecture needs — each layer's evaluator has reliability bounds that must be tracked |
| Drift & Instability | Evaluator unreliability IS a form of drift. TRACED's curvature metric operationalizes the detection of evaluator drift within a single session |
| Memory Architecture Convergence | Evaluator calibration data should be stored in structured memory (IBM trajectory memory pattern: strategy tips for which evaluator to trust per task type) |
| MaMa Safe Design | MaMa's convergent discovery of safety agents IS adversarial role composition (Bug-Hunt pattern). This synthesis explains *why* it works: intentional bias composition |

---

**Next Steps:**
1. Read TRACED in full (currently working from abstract + methods + results tables) — the geometric-cognitive correspondence (Hesitation Loops, Certainty Accumulation) may provide vocabulary for our evaluator health metrics
2. Test format perturbation on our current evaluator (P1 recommendation) — lowest-effort, highest-signal diagnostic
3. Prototype adversarial role decomposition for code review (P2 recommendation) — Advocate/Critic/Judge pattern
4. Cross-reference with Nurture-First Agent Development (2603.10808) — its Three-Layer Cognitive Architecture may connect to our evaluator layer model
