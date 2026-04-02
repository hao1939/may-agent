# Deep-Dive: From Debate to Deliberation — Structured Collective Reasoning with Typed Epistemic Acts

**Paper:** arXiv:2603.11781  
**Authors:** Sunil Prakash (Indian School of Business)  
**Date:** 2026-03-12  
**Same author as:** LDP (2603.08852) — Identity-Aware Protocol for Multi-Agent LLM Systems  
**Rating:** ★★★★★ CRITICAL  
**Session:** 2026-03-13  

---

## 1. Core Contribution

DCI (Deliberative Collective Intelligence) formalizes **deliberation as a distinct computational primitive** for multi-agent LLM systems — not debate, not voting, not orchestration, but a phased process where differentiated agents exchange **typed reasoning moves**, preserve disagreements as first-class objects, and converge on structured decision packets with formal termination guarantees.

The key claim: current multi-agent paradigms (ensembling, debate, orchestration, voting) all fail to model deliberation. None produce what the paper calls "deliberated intelligence" — decisions where assumptions are surfaced, dissent is preserved, reasoning is typed and traceable, and the process guarantees a bounded explicit outcome.

## 2. Framework Architecture

### 2.1 Four Delegate Archetypes

Each delegate carries an identity, reasoning style, known limitation, evolving perspective, and willingness to revise:

| Archetype | Function |
|-----------|----------|
| **Framer (δ_F)** | Defines the real problem. Clarifies ambiguity, identifies hidden dimensions, decomposes mixed issues. |
| **Explorer (δ_E)** | Generates novel possibilities. Proposes unconventional paths, analogies, generative expansions. Opens solution space. |
| **Challenger (δ_C)** | Pressure-tests everything. Searches for hidden assumptions, weak logic, risks, blind spots, overconfidence. |
| **Integrator (δ_I)** | Combines thinking into coherent direction. Identifies patterns, synthesizes positions, manages session coherence. |

Each delegate maintains state σ_i = ⟨v_i, c_i, Q_i, R_i, H_i⟩ (view, confidence, open questions, concerns, position-shift history).

**Archetypes constrain tendency, not capability:** a Challenger can still propose; an Explorer can still challenge.

### 2.2 Five-Phase Session Model

1. **Arrival (φ₁):** Ground the session. Identify central question, scope, uncertainties. → shared problem statement
2. **Independent First Thought (φ₂):** Each delegate contributes initial view before being shaped by others. Preserves diversity.
3. **Mutual Engagement (φ₃):** Heart of the session. Typed interaction acts: extend, question, challenge, bridge, clarify, reframe, deepen.
4. **Collective Shaping (φ₄):** Turn discourse into structure: themes, tensions, candidate paths, preferred direction.
5. **Closure (φ₅):** Final synthesis, remaining uncertainty, action suggestions, carry-forward memory.

Arc: **Divergence → Engagement → Convergence** (prevents premature consensus).

### 2.3 Interaction Grammar: 14 Typed Epistemic Acts

Organized into 6 families:

| Family | Acts | Cognitive Function | Failure If Absent |
|--------|------|--------------------|-------------------|
| **Orienting** | frame, clarify, reframe | Problem framing | Shallow/misdirected problem definition |
| **Generative** | propose, extend, spawn | Search breadth | Premature lock-in |
| **Critical** | ask, challenge | Assumption testing | False agreement |
| **Integrative** | bridge, synthesize, recall | Synthesis | Fragmentation |
| **Epistemic** | ground, update | Confidence & revision | Fake certainty |
| **Decisional** | recommend | Closure | Endless discussion |

Each move is a triple m = (μ, α, ι) — Speech Mode × Interaction Act × Intent.

Three-layer model:
- **Layer 1 (μ):** Stance — exploratory, analytical, critical, integrative, reflective, decisional
- **Layer 2 (α):** One of 14 typed acts
- **Layer 3 (ι):** Specific purpose — test assumption, open option, resolve ambiguity, etc.

### 2.4 Shared Workspace

Not a transcript — a **structured evolving thought-space** with 6 sections:
1. Problem View
2. Key Frames  
3. Emerging Ideas
4. **Tensions** (first-class objects: which positions conflict, supporting evidence, resolution conditions)
5. Synthesis in Progress
6. Next Actions

### 2.5 DCI-CF: Convergent Flow Algorithm

Eight stages with formal termination guarantee:

0. **Session Initialization** — problem, delegates, round budget R_max, criteria, options cap K_max
1. **Independent Proposal Generation** — private submissions (reduces dominance/conformity)
2. **Canonicalization & Clustering** — dedup, group into option families → candidate set O, |O| ≤ K_max
3. **Structured Challenge & Evidence** — typed epistemic acts per option (support, challenge, evidence, etc.)
4. **Revision & Option Compression** — refine, merge, discard dominated → finalist set F
5. **Multi-Criteria Scoring** — per-criterion scores with confidence, evidence strength, domain-fit factor
6. **Convergence Test** — score dominance? majority backing? no blocking objection? → else loop to Stage 3
7. **Forced-Decision Fallback** — outranking → minimax regret → robust satisficing → Integrator selection
8. **Actionization** — structured **Decision Packet**

**Decision Packet** (Definition 1): Selected option + rationale, residual objections, minority report, next actions, reopen triggers.

**Theorem 1 (Termination):** T_max = R_max · Σ B_d sessions. Proved via 6 hard constraints: finite rounds, finite options, hypothesis cutoff, structured scoring, deterministic fallback, bounded recursion.

## 3. Results

### 3.1 Main Findings (45 tasks, 7 domains)

| System | Overall | Risk ID | Depth | Actionability |
|--------|---------|---------|-------|---------------|
| **DCI** | 8.24 | 8.84 | 8.62 | 8.96 |
| Single Agent | **8.84** | **9.42** | **9.00** | 9.00 |
| Simple Voting | 8.78 | 8.66 | 8.67 | **9.44** |
| Self-Consistency | 8.65 | 8.37 | 8.53 | 9.32 |
| Unstructured Debate | 7.75 | 8.39 | 7.72 | 8.76 |

### 3.2 H1: DCI vs Debate (same number of agents)

- Full task set (n=45): Δ = +0.49, 95% CI [-0.10, +1.12] — **not significant** (routine tasks drag down)
- **Non-routine tasks (n=40): Δ = +0.95, 95% CI [+0.41, +1.54] — SIGNIFICANT**
- Key: structure matters when the task warrants it.

### 3.3 H2: Task Dependence

- **Hidden-Profile tasks: DCI = 9.56** (highest of ANY system on ANY domain) — significantly outperforms all baselines
- **Routine tasks: DCI = 5.39** — worst of all systems
- Confirms strong task-dependence: deliberation helps when partial perspectives need integration; hurts when a single coherent generation suffices.

### 3.4 H3: Coordination Overhead

- DCI consumes **~62× tokens** of a single agent
- Single agent significantly outperforms DCI overall (Δ = -0.60, CI [-1.06, -0.15])
- DCI justified only when process accountability and perspective integration matter enough to absorb the cost

### 3.5 H4: Component Contributions (Ablations)

- Not clearly separable at n=45 sample size
- Removing archetypes, grammar, DCI-CF, or workspace each degrades performance but effects are not statistically distinguishable

### 3.6 Process Metrics

- **100% structured decision packets** (all baselines: 0%)
- **98% minority reports** (all baselines: 0%)
- These are unique artifacts of deliberation — no other paradigm produces them

## 4. Cross-Reference Analysis

### 4.1 DCI × Bug-Hunt (deep-dive-bug-hunt-2026-03-06.md)

**Strong convergence.** Bug-Hunt uses 3 adversarial roles (Hunter/Skeptic/Referee); DCI uses 4 archetypes (Framer/Explorer/Challenger/Integrator).

| Bug-Hunt Role | DCI Archetype | Mapping Quality |
|---------------|---------------|-----------------|
| Hunter | Explorer (generative) | Direct |
| Skeptic | Challenger (critical) | Direct |
| Referee | Integrator (synthesis) | Direct |
| (missing) | Framer (problem definition) | **DCI adds this** |

DCI's Framer archetype fills a gap Bug-Hunt doesn't address: who defines the problem? Bug-Hunt assumes the problem is given (find bugs). DCI recognizes that problem definition itself is a reasoning step that shapes all downstream quality.

**Bug-Hunt's "weaponized bias composition"** (intentional over-report → adversarial challenge → neutral arbitration) maps to DCI's phase progression (divergent exploration → critical engagement → integrative convergence). Both weaponize structured disagreement — but DCI formalizes it with typed acts while Bug-Hunt leaves it informal.

### 4.2 DCI × DPIP Common Ground (deep-dive-arxiv-2603-05450-dpip-common-ground.md)

DCI's shared workspace directly addresses DPIP's core finding: **LLMs cannot reliably track "who knows what."** The workspace makes common ground explicit and structured rather than relying on agents to infer it from transcript.

DPIP found that deterministic axiomatic CG tracking outperforms GPT-5. DCI's workspace is a step in this direction — structured state that is visible and updateable rather than implicitly tracked.

DCI's Hidden-Profile domain (9.56 score, best result) directly tests the scenario DPIP studied: information distributed across agents that must be integrated. DCI's success here validates our DPIP recommendation to "include ALL relevant context explicitly."

### 4.3 DCI × Evaluator Reliability Synthesis

DCI's "tensions as first-class objects" + minority reports align with our Axiom: "multi-evaluator disagreement is signal, not noise." Rather than resolving disagreement to a single score, DCI preserves it structurally — exactly what our Evaluator Reliability Synthesis recommended.

DCI's decision packet (residual objections + reopen triggers) is the practical implementation of our "uncertainty should be visible" principle from IP intervals (2603.10396).

### 4.4 DCI × Chaotic Dynamics (2603.09127)

DCI's phased structure with typed acts directly addresses chaotic dynamics in multi-LLM deliberation. The Chaotic Dynamics paper found that unstructured multi-agent debate exhibits sensitivity to initial conditions. DCI's independent-first-thought phase (reducing social influence) + typed grammar (constraining interaction patterns) should dampen chaos. This is supported by DCI outperforming unstructured debate: structure = stability.

### 4.5 DCI × LLM Teams as Distributed Systems (2603.12229)

Princeton/MIT found centralized > decentralized for LLM teams, with consistency conflicts in decentralized systems. DCI is decentralized in reasoning but centralized in process — the DCI-CF algorithm provides the coordination protocol that the Princeton paper found missing in peer-to-peer teams. The shared workspace serves as a consistency mechanism (single source of truth about problem state).

### 4.6 DCI × LDP (2603.08852) — Same Author

Sunil Prakash authored both DCI and LDP. LDP defines identity and provenance for multi-agent systems; DCI defines interaction structure. Together they form a complementary pair:
- **LDP:** WHO is speaking, with what authority, with what provenance? (identity layer)
- **DCI:** WHAT are they saying, in what phase, with what epistemic force? (interaction layer)

Our system could layer both: LDP for agent identity/trust + DCI for structured deliberation when consequential decisions are needed.

### 4.7 DCI × MaMa (2602.04431)

MaMa's adversarial search independently discovers safety agents and three-party authorization — patterns that emerge naturally in DCI's archetype model (Challenger = safety agent, multi-archetype scoring = multi-party authorization). MaMa provides the adversarial robustness testing; DCI provides the deliberation protocol. Complementary.

## 5. Actionable Recommendations for Our System

### Priority 1 (Immediate)
1. **Add typed reasoning acts to agent communication.** Our agents currently communicate via free-form text in shared files. Adding even a minimal typed grammar (propose, challenge, synthesize, update) to SIGNALS.md entries would make cross-agent communication more analyzable and actionable.

2. **Implement tension tracking in shared workspace.** Our SIGNALS.md is broadcast-only with no disagreement tracking. Adding a TENSIONS section where agents can record conflicting assessments (with evidence pointers) would implement DCI's most novel contribution at minimal cost.

3. **Add minority reports to evaluator output.** When QA evaluates work, it currently produces a single verdict. Adding "residual concerns" and "conditions that would change this verdict" transforms a binary pass/fail into a decision packet — richer signal for downstream agents.

### Priority 2 (Medium-term)
4. **Phase agent interactions on consequential decisions.** For high-stakes decisions (architecture changes, safety assessments), adopt DCI's 5-phase arc: (1) independent first thought (each agent writes assessment before seeing others), (2) mutual engagement (structured response), (3) collective shaping (synthesis). This prevents premature consensus.

5. **Selective deployment.** DCI's strongest finding is task-dependence: deliberation helps for perspective-integration tasks, hurts for routine tasks. Our system should use lightweight single-agent execution for routine work and escalate to structured deliberation only for consequential decisions (new architecture patterns, safety-critical changes, conflicting agent assessments).

### Priority 3 (Aspirational)
6. **Map our agents to DCI archetypes.** Current mapping: May ≈ Framer/Integrator (problem definition + coordination), Coder ≈ Explorer (generative), QA ≈ Challenger (critical testing), Bob ≈ Integrator (architecture synthesis), Scout ≈ Explorer (research). The gap: no dedicated Challenger for architecture decisions (QA only challenges implementation quality, not design decisions).

7. **Decision packets for architecture decisions.** Bob's architecture reviews could produce DCI-style decision packets: selected approach + residual objections + minority positions + reopen conditions. This would make architectural debt visible rather than implicit.

## 6. Design Axioms

**Axiom 17 (Deliberation Cost-Benefit):** Structured deliberation outperforms unstructured debate for perspective-integration and high-stakes decisions, but single-agent generation outperforms deliberation for routine tasks. The cost of deliberation (~62× tokens) is justified only when process accountability and perspective integration matter more than efficiency.

**Axiom 18 (Typed Interaction > Free-Form):** Typed epistemic acts (propose, challenge, synthesize, update) make multi-agent interaction analyzable, enforceable, and trackable. Untyped communication loses signal in noise — a challenge is indistinguishable from a proposal without typing.

**Axiom 19 (Tensions as First-Class Objects):** Disagreements should be preserved, not resolved — tracked as structured objects with positions, evidence, and resolution conditions. Flattening disagreement into consensus creates false certainty. Preserved tensions are the most honest output of collective reasoning.

## 7. Limitations

1. **Single author, single model (Gemini 2.5 Flash).** No cross-model validation.
2. **LLM-as-judge evaluation (Gemini 3 Flash Preview).** Subject to our known evaluator reliability concerns.
3. **Small sample size (n=45, n=5 per specialized domain).** H4 (component contributions) was not separable — sample too small.
4. **62× token cost.** Impractical for most routine applications.
5. **No adversarial testing.** What happens when one delegate is compromised? (MaMa addresses this for general MAS; DCI doesn't.)
6. **No comparison to Bug-Hunt's 3-agent adversarial pattern.** Would Bug-Hunt's simpler structure achieve similar results at lower cost?

## 8. Key Insight

DCI's deepest contribution is the distinction between **procedural convergence** and **epistemic convergence.** You can guarantee the process ends (procedural) without guaranteeing the answer is right (epistemic). This is the correct framing for multi-agent systems: build processes that are fair, bounded, transparent, and accountable — and accept that truth is not guaranteed.

This connects to our broader architecture: our safety constraints (SOUL.md, Three-Layer Verification, etc.) are procedural guarantees, not epistemic ones. We guarantee a fair process for producing work, not that the work is correct. DCI provides formal vocabulary for this distinction.

---

**Bottom line:** DCI is the most rigorous formalization of structured multi-agent deliberation to date. Its 14 typed epistemic acts, phased session model, tension tracking, and decision packets provide a concrete protocol for turning multi-agent interaction from "agents talking at each other" into "agents reasoning together." The task-dependence finding (deliberation helps for perspective-integration, hurts for routine) is the most practically important result — it tells us exactly when to use structured deliberation and when not to. Same author as LDP; together they form a comprehensive identity + interaction framework for multi-agent LLM systems.
