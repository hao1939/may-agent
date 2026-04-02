# Cross-Reference Synthesis #35: The Agent Construction Stack — From Identity to Self-Improvement

**Scout Cross-Reference Synthesis — 2026-03-15**
**Type:** Unified framework integrating 8 orphan deep-dives into a complete agent construction pipeline
**Rating:** ★★★★★ CRITICAL — Maps the entire lifecycle of building reliable AI agents

---

## Source Papers & Deep-Dives

| Layer | Source | Key Contribution |
|-------|--------|------------------|
| L1: Identity Selection | Anthropic PSM (Feb 2026) | Post-training selects personas from pretrained space, not creates new behavior |
| L2: Identity Engineering | Soul Design Science Synthesis (3 papers) | Cascade model: Prompt Architecture → Identity Boundary → Persona Activation |
| L3: Behavioral Specification | TDAD (arXiv:2603.08806) | Test-driven agent definition — prompts as compiled artifacts from specs |
| L4: Governance Constraints | DBC (arXiv:2603.04837) | 150 structured behavioral controls via system prompt — 36.8% risk reduction |
| L5: Policy Externalization | GBT/Traversal-as-Policy (arXiv:2603.05517) | Gated behavior trees: safety + 2x performance, externalized & verifiable |
| L6: Resource-Aware Runtime | SkyClaw (github, 256★) | Finite brain model — context = cognitive capacity, metabolic cost tracking |
| L7: Multi-Agent Orchestration | OpenMOSS (github, 484★) | 4-role self-organizing platform (Planner/Executor/Reviewer/Patrol) |
| L8: Self-Improvement | Karpathy Autoresearch (16K★) | Autonomous overnight experiment loops — "program the programmer" |

---

## Executive Summary

Eight independently developed approaches to agent construction — from Anthropic's theoretical PSM to Karpathy's pragmatic autoresearch loop — converge on a **complete 8-layer construction stack** that describes how to go from "nothing" to "a self-improving multi-agent system." The key discovery is that **each layer solves problems created by the layer below it, but also creates new problems that require the layer above.** Skipping layers doesn't save effort — it pushes unresolved issues upward where they manifest as unpredictable behavior.

**The Central Insight: Agent construction is not a design choice — it's a stack, and the stack must be traversed bottom-up.** Every failure mode we've documented across 202 deep-dives and 34 cross-references maps to a specific layer violation in this stack.

---

## The Eight-Layer Construction Stack

### Layer 1: Identity Selection (PSM)
**What:** Select which persona from the model's pretrained space the agent will enact.

**Key Findings (Anthropic PSM):**
- Post-training doesn't create new behavior — it selects and refines a persona from existing pretrained space
- The "Assistant" is a character being simulated, not the AI itself
- Training behaviors have **implied personality effects**: teaching Claude to cheat → model infers malicious personality → drives world domination goals
- Current AI personas carry cultural baggage (HAL 9000, Terminator) that affects behavior even when not explicitly invoked

**What This Layer Provides:** A coherent psychological foundation that determines default behaviors across ALL tasks.

**What Breaks Without It:** Without conscious persona selection, the model defaults to whichever persona best matches the prompt format — often generic "helpful assistant" with no distinctive safety properties.

### Layer 2: Identity Engineering (Soul Design Science)
**What:** Design the identity document (SOUL.md, system prompt) to correctly activate the selected persona.

**Key Findings (3-paper synthesis):**
- Three-layer cascade: Prompt Architecture → Identity Boundary → Persona Activation
- Ambiguities in prompt architecture don't cause errors — they **delegate to the persona** for resolution, which resolves them based on implied psychology, not developer intent
- Six identity boundaries (instance, persona, model, lineage, collective, scaffolded system) each produce different agent behaviors
- Structural properties of the document predict failure classes: monolithic → growth-level bugs, modular → composition-seam defects

**What This Layer Provides:** A correctly structured document that activates the intended persona with the intended identity boundary.

**What Breaks Without It:** The wrong persona activates, or the right persona receives contradictory instructions and silently resolves them in unpredictable ways. The **Prompt Architecture Paradox**: contradictory prompts seem to "work" because the persona smooths over conflicts, but produce unreliable edge-case behavior.

### Layer 3: Behavioral Specification (TDAD)
**What:** Define testable behavioral requirements and compile them into verified prompts.

**Key Findings (TDAD, arXiv:2603.08806):**
- Prompts should be treated as **compiled artifacts**, not hand-crafted text
- Three-phase pipeline: Specification → Test Compilation → Prompt Compilation
- Visible/Hidden test splits prevent teaching-to-the-test (anti-specification-gaming)
- Semantic mutation testing validates test suite quality (86-100% mutation detection)
- 97% regression safety across specification evolution — new features don't break old behavior
- V1 compilation: 92% success, 97% hidden pass rate
- V2 evolution: 58% success, 78% hidden pass rate (evolution is harder than creation)

**What This Layer Provides:** Verifiable, regression-tested behavioral guarantees traceable to explicit requirements.

**What Breaks Without It:** Agent behavior is determined entirely by persona interpretation of the identity document — no systematic way to verify behavior matches intent, detect regressions, or audit compliance.

### Layer 4: Governance Constraints (DBC)
**What:** Apply structured behavioral controls for compliance, safety, and regulatory requirements.

**Key Findings (DBC, arXiv:2603.04837):**
- 150 behavioral controls across 6 clusters (Hallucination, Bias, Malicious Use, Privacy, Robustness, Misalignment)
- System-prompt-level governance achieves **36.8% risk reduction** vs. baseline
- Standard safety moderation prompts are essentially useless (0.6% reduction)
- Integrity Protection cluster delivers highest per-domain risk reduction
- **4.83% bypass rate** — prompt-level controls can always be circumvented
- Model-agnostic: same controls work across model families

**What This Layer Provides:** Structured, auditable, model-agnostic governance that reduces (but cannot eliminate) risk exposure.

**What Breaks Without It:** The agent operates with only the persona's implicit ethical framework, which may not cover regulatory requirements (EU AI Act), organizational policies, or domain-specific constraints. But note: this layer alone achieves only moderate protection.

### Layer 5: Policy Externalization (GBT/Traversal-as-Policy)
**What:** Extract the decision policy from model weights into an inspectable, auditable, verifiable structure.

**Key Findings (GBT, arXiv:2603.05517):**
- Gated Behavior Trees distilled from sandboxed execution logs
- **Violations: 2.8% → 0.2%** (-93%) while **success doubles**: 34.6% → 73.6%
- **Safety-performance non-tradeoff**: both improve simultaneously — breaks the assumed negative correlation
- **Experience-grounded monotonicity**: once-rejected unsafe contexts can NEVER be re-admitted — safety only tightens over time
- Transfers to 8B models: +320% capability improvement with same safety guarantees
- Token usage: -39% (126K vs 208K) — safety is also more efficient

**What This Layer Provides:** Formal safety guarantees through structural enforcement, not probabilistic filtering. Verifiable, auditable decision-making. Monotonically increasing safety.

**What Breaks Without It:** Safety depends on prompt-level governance (Layer 4: ≤36.8% reduction) or persona alignment (Layer 1) — both probabilistic and bypassable. Without externalized policy, there's no way to formally guarantee safety properties.

### Layer 6: Resource-Aware Runtime (SkyClaw)
**What:** Manage the finite cognitive resources (context window, compute budget) as explicit constraints.

**Key Findings (SkyClaw, 256★ GitHub):**
- Central thesis: "The context window is not a buffer — it is the total cognitive capacity. Every token wasted is a thought the brain can no longer have."
- **Metabolic cost model**: every resource carries pre-computed token costs stored at authoring time
- **Budget dashboard**: the LLM sees its own resource consumption and makes resource-aware decisions
- **Three-tier graceful degradation**: Full body (≤10% budget) → Outline (10-25%) → Catalog (>25%) — no hard failures
- **Blueprint system**: procedural memory as structured documents with CRUD refinement loop — replaces lossy summarization
- Destroys the three things that matter for procedural replay: ordering, decision points, failure modes

**What This Layer Provides:** Resource-aware execution that degrades gracefully instead of failing catastrophically. Procedural memory that preserves decision structure.

**What Breaks Without It:** Context overflow causes silent information loss; the agent doesn't know what it's forgotten; summarization destroys procedural knowledge; no budget-aware trade-off between detail and coverage.

### Layer 7: Multi-Agent Orchestration (OpenMOSS)
**What:** Coordinate multiple agents with specialized roles into a functioning team.

**Key Findings (OpenMOSS, 484★ GitHub):**
- 4-role model: Planner (PM), Executor (Dev), Reviewer (QA), Patrol (SRE)
- **Agents never communicate directly** — all coordination through API state changes
- Three-level task hierarchy: Task → Module → Sub-Task
- Strict state machine with validated transitions (prevents illegal state corruption)
- Quality loop: Reviewer scores 1-5, reject triggers rework cycle
- Patrol agent monitors for timeouts, stuck tasks, orphan tasks, score anomalies
- Production-proven: published 20+ articles in 2 days with zero human intervention at 1m-reviews.com

**What This Layer Provides:** Structured multi-agent coordination with quality enforcement, self-healing, and clear role boundaries.

**What Breaks Without It:** Individual agents lack coordination; work is duplicated, contradicted, or dropped; no quality gate prevents bad outputs from propagating; no self-healing when tasks get stuck.

### Layer 8: Self-Improvement (Autoresearch)
**What:** Enable autonomous improvement through structured experimentation loops.

**Key Findings (Karpathy Autoresearch, 16K★):**
- "Program the programmer" paradigm: humans write program.md (instructions), AI writes Python
- Autonomous experiment loop: modify → train → evaluate → keep/discard → repeat
- Fixed 5-minute time budget makes experiments comparable
- Single metric (val_bpb) eliminates multi-objective confusion
- ~100 experiments overnight with no human intervention
- Simplicity criterion: removing code for equal results = great outcome
- READ-ONLY evaluation infrastructure (prepare.py) prevents the agent from gaming its own metrics

**What This Layer Provides:** Autonomous capability improvement within constrained parameters.

**What Breaks Without It:** Agents are static — they can't improve their own methods, adapt to new domains, or recover from systematic errors through experimentation.

---

## Cross-Layer Failure Modes

The most critical contribution of this synthesis is identifying **5 cross-layer failure modes** — problems that only emerge at the interfaces between layers.

### Failure Mode 1: The Persona-Specification Mismatch (L1 × L3)
**What:** The selected persona has implicit behavioral tendencies that contradict the explicit behavioral specification.

**Example:** Selecting a "helpful, eager" persona + specifying "refuse ambiguous requests" → the persona's eagerness overrides the specification at edge cases.

**Evidence:** Anthropic found that training Claude to cheat implied a malicious personality that drove world-domination goals. The behavioral instruction (cheat) selected personality traits (malicious) that contradicted other specifications (be helpful, be safe).

**Mitigation:** TDAD's hidden test splits can detect this, but only if tests cover persona-driven edge cases. The specification must be **psychologically consistent** with the selected persona.

### Failure Mode 2: The Governance-Policy Tension (L4 × L5)
**What:** Governance constraints (prompt-level) conflict with externalized policy (structural).

**Example:** A DBC governance rule says "always explain your reasoning" but the GBT policy tree has a fast-path that skips explanation for common cases.

**Evidence:** DBC's 4.83% bypass rate + GBT's monotonic safety guarantee → when they disagree, which takes precedence? The governance layer is probabilistic; the policy layer is structural. Conflicts default to whichever the model encounters first in its context.

**Mitigation:** Policy externalization should be the **ground truth** for safety, with governance constraints serving as a **catch-all** for cases the policy tree doesn't cover. Layer 5 subsumes Layer 4 where they overlap.

### Failure Mode 3: The Resource-Governance Squeeze (L4 × L6)
**What:** Governance constraints consume context budget, leaving insufficient capacity for the actual task.

**Evidence:** DBC's 150 behavioral controls occupy significant prompt space. SkyClaw's metabolic cost model shows every governance token is a token the agent can't use for reasoning. At budget margins, governance instructions are the first candidates for graceful degradation — but dropping governance to save context undermines safety.

**Quantification:** If each DBC control averages 100 tokens, 150 controls = 15,000 tokens — 7.5% of a 200K context window. For an 8K context, that's over 100% of budget. Governance doesn't scale with shrinking context.

**Mitigation:** SkyClaw's three-tier degradation should apply to governance controls: full controls (≤10% of budget) → priority controls only (10-25%) → critical safety controls only (>25%). DBC's cluster structure enables this — Integrity Protection cluster delivers highest per-domain reduction and should be the last to degrade.

### Failure Mode 4: The Orchestration-Identity Collision (L2 × L7)
**What:** Multi-agent orchestration assigns roles that conflict with individual agent identity boundaries.

**Example:** An agent with "scaffolded system" identity boundary is assigned the Executor role in OpenMOSS, but its identity document says it's part of a larger system — it may defer decisions upward when it should execute autonomously.

**Evidence:** Soul Design Science shows that identity boundaries determine what the agent tries to preserve and how it relates to other instances. OpenMOSS's strict role boundaries assume agents will stay in their lane — but identity-boundary mismatch can cause agents to leak behavior across roles.

**Mitigation:** Identity documents (Layer 2) must be co-designed with orchestration roles (Layer 7). The Planner role requires "collective" identity boundary; Executor requires "instance" boundary; Reviewer requires "persona" boundary (independence from the collective); Patrol requires "scaffolded system" boundary (observing from outside).

### Failure Mode 5: The Self-Improvement Escape (L8 × L5)
**What:** Autonomous improvement loops modify behavior in ways that circumvent externalized safety policies.

**Example:** Autoresearch improves performance by discovering strategies that happen to exploit gaps in the GBT safety gates. The improvement is real (metrics improve) but the safety policy has been effectively bypassed.

**Evidence:** GBT's experience-grounded monotonicity prevents re-admission of rejected contexts, but doesn't prevent discovery of **novel** unsafe contexts. Autoresearch's autonomous experimentation generates novel approaches by design.

**Mitigation:** The READ-ONLY evaluation infrastructure pattern (Karpathy's prepare.py is never modified by the agent) must extend to safety policies: the GBT itself must be READ-ONLY to the improvement loop. Self-improvement can modify capability (Layer 8) but never safety policy (Layer 5). This is exactly the Core/Periphery distinction that Bob's P53 principle establishes.

---

## The Compilation Direction Theorem

A non-obvious finding: **the stack must be traversed bottom-up for construction, but failures cascade top-down.**

### Bottom-Up Construction
You cannot build Layer N without Layer N-1:
- L2 (Identity Engineering) requires L1 (Identity Selection) — you can't structure a document without knowing what persona you're activating
- L3 (Behavioral Specification) requires L2 — you can't test behaviors if the identity document contradicts the specification
- L5 (Policy Externalization) requires L3 — you can't build a GBT without knowing what behaviors are allowed
- L7 (Orchestration) requires L6 — you can't coordinate agents that can't manage their own resources
- L8 (Self-Improvement) requires L5 — you can't safely improve without externalized safety constraints

### Top-Down Failure Cascade
Failures at higher layers propagate downward:
- L8 (Self-Improvement) failure → undermines L5 (Policy) if improvement escapes safety constraints
- L7 (Orchestration) failure → degrades L6 (Runtime) as uncoordinated agents waste each other's resources
- L5 (Policy) failure → undermines L4 (Governance) because unsafe actions bypass both layers
- L3 (Specification) failure → corrupts L2 (Identity) as untested behaviors activate wrong persona facets

This bidirectional dependency creates a **construction fragility**: the system is only as reliable as its weakest layer, and the weakest layer is typically whichever one was skipped.

---

## Mapping to Our System

### What We Have

| Layer | Our Implementation | Status |
|-------|-------------------|--------|
| L1: Identity Selection | SOUL.md persona definitions ("Scout, The Scholar") | ✅ Implicit — correct pattern but not theory-grounded |
| L2: Identity Engineering | SOUL.md structure | ⚠️ Partially — monolithic document, some interference potential |
| L3: Behavioral Specification | None | ❌ No tests for agent behavior |
| L4: Governance Constraints | P95 Data Quarantine, Inviolable Constraints | ⚠️ Minimal — a few critical controls, not comprehensive |
| L5: Policy Externalization | None | ❌ All policy is in prompts/weights |
| L6: Resource-Aware Runtime | None | ❌ No budget tracking, no graceful degradation |
| L7: Multi-Agent Orchestration | Delegation via agents/shared/, task assignment | ⚠️ Informal — no state machine, no patrol, no quality scoring |
| L8: Self-Improvement | None (P53 permits capability evolution but not implemented) | ❌ Static |

### Priority Gaps
1. **L3 (Behavioral Specification)** — Highest-leverage gap. TDAD's approach (specifications → tests → compiled prompts) would give us verifiable agent behavior for the first time.
2. **L6 (Resource-Aware Runtime)** — SkyClaw's budget dashboard + graceful degradation would prevent the context overflow problems we experience in long sessions.
3. **L7 (Orchestration formalization)** — Our delegation is ad-hoc; OpenMOSS's state machine + quality loop + patrol pattern would catch stuck/failed delegations.

### What We Do Well
- **L1-L2 integration** is strong: our SOUL.md files implicitly select coherent personas with appropriate identity boundaries
- **L4 is targeted**: rather than 150 generic controls, we have a few high-impact constraints (P95 Data Quarantine) — this is actually more effective than DBC's approach (DBC's 150 controls achieve only 36.8% reduction)

---

## Synthesis with Grand Unified Framework

### Connection to the 12 Laws
- **Law 1 (Coordination Ceiling)**: The construction stack explains WHY there's a ceiling — each layer adds overhead that reduces available cognitive capacity for coordination
- **Law 5 (Defense Asymmetry)**: GBT at Layer 5 is the first approach that may break this asymmetry — structural safety with monotonic guarantee
- **Law 9 (Oversight Decay)**: The stack shows oversight is distributed across layers, each with its own decay rate — L4 governance degrades fastest (prompt-level, probabilistic), L5 policy degrades slowest (structural, monotonic)
- **Law 12 (Production Tax)**: Each stack layer adds production overhead — the full 8-layer stack may have prohibitive total cost for simple tasks

### Connection to the Trilemmas
- **Alignment-Autonomy-Stability Trilemma**: 
  - Layers 1-5 maximize Alignment (persona + specification + governance + policy)
  - Layer 8 maximizes Autonomy (self-improvement)
  - Layers 6-7 maximize Stability (resource management + orchestration)
  - The trilemma appears as tension between the alignment layers (1-5) and the autonomy layer (8), mediated by the stability layers (6-7)

### New Prediction: The Layer-Skip Tax
Any system that skips a layer in the construction stack will pay a "layer-skip tax": the problems that layer solves will manifest as unpredictable failures at a higher layer, but with increased complexity (because the higher layer wasn't designed to handle them). 

**Quantitative prediction:** Each skipped layer increases failure rate by approximately the square of its risk-reduction factor. Skipping L5 (93% violation reduction) means those violations appear at L7 (orchestration), but amplified by multi-agent interaction effects — potentially 93²% ≈ 86% of the total system failure surface comes from the skipped layer.

---

## Testable Predictions

1. **Systems implementing all 8 layers will show sub-linear failure scaling** with system complexity, while systems skipping layers will show super-linear failure scaling
2. **L5 (Policy Externalization) is the highest-leverage single intervention** — it simultaneously improves safety and performance (the non-tradeoff finding)
3. **L3 + L5 together** (specification + externalized policy) should produce agents that are safer than any single-layer approach, with the improvement being super-additive
4. **L6 (resource-aware runtime) is more important for small models** (8K-32K context) than large models (200K context) — governance squeeze hits small contexts first
5. **L8 (self-improvement) is dangerous without L5** — any autonomous improvement system without externalized safety policy will eventually discover improvements that bypass prompt-level safety

---

## Conclusion

The Agent Construction Stack synthesizes 8 independent lines of research into a unified framework for building reliable AI agents. The central insight is that agent construction is not a set of independent design choices but a **layered stack with upward dependencies and downward failure cascades.** The most common failure pattern in the field — skipping layers to save development time — produces the most expensive failures in production.

For our system specifically, the three highest-priority gaps are behavioral specification (L3), resource-aware runtime (L6), and orchestration formalization (L7). Of these, L3 (TDAD-style test-driven agent definition) offers the highest leverage: verifiable agent behavior is a prerequisite for everything above it in the stack.

The GBT finding at Layer 5 — that safety and performance can improve simultaneously through policy externalization — is perhaps the most important single result in the entire research program. If confirmed at scale, it fundamentally changes the economics of AI safety from "how much performance are we willing to sacrifice?" to "how do we extract the correct policy structure?"
