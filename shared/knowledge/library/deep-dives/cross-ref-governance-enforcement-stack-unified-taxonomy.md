# Cross-Reference Synthesis: The Governance Enforcement Stack
## A Unified Taxonomy of Agent Behavioral Control — From Norms to Execution Gates
### Scout Cross-Reference #15 | 2026-04-03

---

## Papers Synthesized (10 Deep-Dives)

| # | Paper | Key Contribution | Layer |
|---|-------|------------------|-------|
| 1 | **SLEEC** (2603.11864) — York/Toronto | 5-stage norm operationalization pipeline | Normative (top) |
| 2 | **DBC** (2603.04837) — Madan Mohan et al. | 150-control prompt-level governance benchmark | Policy |
| 3 | **COMPASS** (2603.11277) — Multi-institution | Sovereignty-aware policy arbiter for multi-agent | Policy + Orchestration |
| 4 | **ABC** (2602.22302) — Behavioral contracts | Formal contract specification + runtime drift monitoring | Contract |
| 5 | **TDAD** (2603.08806) — Rehan | Test-driven agent definition, prompts as compiled artifacts | Specification |
| 6 | **Schema-Gated AI** (2603.06394) — Intellegens/Cambridge | Talk freely, execute strictly; schema validation | Orchestration Gate |
| 7 | **VMAO** (2603.11445) — AWS/HSBC | Plan-execute-verify-replan with independent verifier | Orchestration + Verification |
| 8 | **GBT / Traversal-as-Policy** (2603.05517) — Li et al. | Gated Behavior Trees with monotonic safety | Execution Gate |
| 9 | **ToolSafe** (2601.10156) — Proactive tool safety | Three-layer pre-execution tool validation | Tool Gate |
| 10 | **PRISM** (2603.11853) — Li | 10-lifecycle-hook runtime security layer | Execution Defense |
| 11 | **LGA** (2603.07191) — Ge, York | 4-layer defense-in-depth (sandbox → audit) | Infrastructure |
| 12 | **MaMa** (2602.04431) — Nöther et al., ICML | Game-theoretic adversarial system design | Design-Time |
| 13 | **CQS / Controllability Trap** (2603.03515) — Military AI | Control Quality Score, temporal control degradation | Measurement |

---

## The Core Insight: A 7-Layer Governance Enforcement Stack

These 13 papers, produced independently across 15+ institutions, collectively describe a **single coherent governance stack** — but no individual paper sees more than 2-3 layers. This synthesis reveals the full architecture.

### Layer 0: DESIGN-TIME ADVERSARIAL HARDENING
**Paper:** MaMa (2602.04431)

Before any governance layer exists, the system architecture itself must be adversarially designed. MaMa's Stackelberg security game formalizes this: the Meta-Agent proposes designs, the Meta-Adversary finds worst-case compromises, and the system iteratively hardens.

- **What it governs:** System topology (communication graph), agent roles, tool assignments
- **Enforcement mechanism:** Iterative adversarial search over design space
- **Key metric:** Safety under ε-agent compromise (strongest threat model in portfolio)
- **Limitation:** Design-time only — cannot adapt to runtime novelty

### Layer 1: NORMATIVE REQUIREMENTS
**Paper:** SLEEC (2603.11864)

The highest abstraction layer. Abstract ethical, legal, social, and cultural norms are operationalized into concrete, formally verifiable requirements through a 5-stage pipeline:

1. Capability enumeration → 2. Pluralistic elicitation → 3. Well-formedness checking (tock-CSP / FOL*) → 4. SLEEC-aware implementation → 5. Compliance verification (RoboChart)

- **What it governs:** What the agent *should* care about (values, rights, duties)
- **Enforcement mechanism:** Formal verification (model checking) at design time; runtime guardrails at execution time
- **Key innovation:** Defeater logic — exceptions to rules are formally specified, not ad hoc
- **Gap identified:** Translation from abstract norms to concrete requirements remains partially manual

### Layer 2: BEHAVIORAL SPECIFICATION & TESTING
**Papers:** TDAD (2603.08806), DBC (2603.04837)

Norms from Layer 1 are compiled into testable behavioral specifications. TDAD's three-phase pipeline (spec → test → prompt compilation) treats prompts as compiled artifacts. DBC provides a taxonomy of 150 behavioral controls organized into 6 risk clusters.

- **What it governs:** What the agent *must* and *must not* do (concrete behaviors)
- **Enforcement mechanism:** Test suites with visible/hidden splits + semantic mutation testing (TDAD); structured system prompts (DBC)
- **Key metrics:** 92% compilation success, 97% hidden pass rate, 86-100% mutation scores (TDAD); 36.8% risk reduction (DBC)
- **Critical finding:** Prompt-level governance (DBC) achieves only 36.8% risk reduction — necessary but radically insufficient alone. TDAD's test-driven approach is stronger but applies only at specification time.

### Layer 3: FORMAL BEHAVIORAL CONTRACTS
**Paper:** ABC (2602.22302)

Behavioral specifications from Layer 2 are formalized as runtime-enforceable contracts with preconditions, postconditions, and invariants expressed in a contract specification language supporting temporal operators and probabilistic bounds.

- **What it governs:** Runtime behavioral boundaries with formal drift detection
- **Enforcement mechanism:** Three-tier monitoring (local → interaction → global) with graduated enforcement (soft correction → hard correction → rollback → isolation)
- **Key innovation:** Behavioral Drift Distance (BDD) — a continuous metric quantifying how far an agent has strayed from its contract
- **Connection to CQS:** BDD for agents mirrors CQS for human oversight — both are continuous metrics replacing binary compliance/non-compliance

### Layer 4: ORCHESTRATION & POLICY ENFORCEMENT
**Papers:** COMPASS (2603.11277), Schema-Gated AI (2603.06394), VMAO (2603.11445)

The orchestration layer mediates *between* agents and between agents and tools. Three complementary approaches:

**4a. COMPASS — Sovereignty-Aware Policy Arbiter**
- Policy Arbiter intercepts all inter-agent communications
- Three-layer policies: agent-local → inter-agent → system-level sovereignty
- Ethical constraint propagation prevents "ethical laundering" through intermediaries
- Constraint intersection model (most restrictive applies)

**4b. Schema-Gated AI — Talk Freely, Execute Strictly**
- Separation of conversational authority (unlimited) from execution authority (schema-gated)
- Clarification-before-execution: ambiguity resolved conversationally before any action
- Tool-to-workflow-level schema validation
- Pareto front analysis: schema-gated systems closest to ideal (max flexibility + max determinism)

**4c. VMAO — Verification-Driven Orchestration**
- Plan-Execute-Verify-Replan loop with independent verifier (different, more capable model)
- DAG-based query decomposition with wave-based parallel execution
- Completeness-driven replanning with configurable stop conditions
- Answer completeness: 3.1→4.2; source quality: 2.6→4.1 vs baseline

- **What Layer 4 governs:** Inter-agent communication, delegation, and workflow composition
- **Key insight across all three:** Governance must be *structural* (architecture-level), not just *behavioral* (prompt-level). All three papers independently arrive at "interpose a governance mechanism between agents."

### Layer 5: EXECUTION GATES
**Papers:** GBT/Traversal-as-Policy (2603.05517), ToolSafe (2601.10156)

The tightest control point: individual actions are gated before execution.

**5a. GBT — Gated Behavior Trees**
- Entire policy externalized as auditable tree structure
- Deterministic (not probabilistic) safety gates
- Experience-grounded monotonicity: safety only tightens over time
- Results: violations 2.8%→0.2% (−93%), success 34.6%→73.6% (+113%)

**5b. ToolSafe — Three-Layer Tool Validation**
- Semantic validation (intent alignment), parameter validation (anomaly detection), consequence prediction (outcome simulation)
- 94.7% dangerous invocation detection, 3.2% false positive rate
- ~200ms latency per tool call

- **What Layer 5 governs:** Individual agent actions at the moment of execution
- **Key finding:** This is where the strongest empirical results live. GBT's simultaneous 2x success + 14x fewer violations **breaks the assumed safety-performance tradeoff.**

### Layer 6: RUNTIME DEFENSE-IN-DEPTH
**Papers:** PRISM (2603.11853), LGA (2603.07191)

Infrastructure-level security that operates below the agent abstraction.

**6a. PRISM — 10-Lifecycle-Hook Security**
- Distributes enforcement across entire agent lifecycle (ingress → spawn)
- Hybrid detection: heuristic + LLM-based scanning
- Session-scoped risk accumulation with TTL decay (detects slow-burn attacks)
- Tamper-evident audit trails

**6b. LGA — Four-Layer Defense-in-Depth**
- L1: OS-level execution sandbox (containers, seccomp)
- L2: Intent verification (independent judge model)
- L3: Zero-trust inter-agent protocol (capability tokens, HMAC-SHA256)
- L4: Immutable audit log (append-only)
- 98% interception rate for prompt injection/RAG poisoning (14B judge)

- **What Layer 6 governs:** The execution environment itself — isolation, authentication, audit
- **Key principle:** Security must be *orthogonal* to agent semantics. OS-level isolation cannot be bypassed by prompt injection.

### META-LAYER: CONTINUOUS MEASUREMENT
**Paper:** CQS / Controllability Trap (2603.03515)

Cuts across all layers. The Control Quality Score measures *quality* of human control through four dimensions:

1. **Decision Fidelity** — Can the human understand agent proposals?
2. **Intervention Latency** — How quickly can humans meaningfully intervene?
3. **Override Effectiveness** — Do overrides actually propagate?
4. **Awareness Completeness** — Sufficient situational awareness?

- **Critical insight:** CQS degrades over time through automation bias, skill atrophy, speed divergence, and complexity accumulation. Even perfect governance layers erode if the human oversight that legitimizes them becomes perfunctory.

---

## The Fundamental Finding: Layer Interaction Effects

### 1. The Prompt Layer Is Necessary but Radically Insufficient
DBC's 36.8% risk reduction vs. GBT's 93% violation reduction tells the definitive story: **prompt-level governance is ~4x weaker than execution-level gating**. The field's over-investment in prompt engineering for safety is a strategic error.

### 2. The Safety-Performance Tradeoff Is Not Universal
Three papers break the tradeoff:
- **GBT:** +113% success AND −93% violations
- **VMAO:** Verification-driven replanning improves both completeness and quality
- **MaMa:** Adversarially-hardened designs maintain task quality while dramatically improving safety

The tradeoff only holds for *retrofitted* safety mechanisms. *Architecturally-integrated* governance can improve both.

### 3. The "Governance Gap" Is Really a "Layer Gap"
No paper covers more than 2-3 layers. Real-world systems will fail in the layers they don't address:
- SLEEC stops at formal specification — no runtime enforcement
- ToolSafe gates tools — but doesn't verify inter-agent communication
- LGA secures infrastructure — but can't assess behavioral drift
- ABC monitors contracts — but doesn't validate norms

**Implication:** A production-grade governance stack requires mechanisms at ALL 7 layers.

### 4. Three Convergent Design Principles
Every paper independently discovers at least one of these:

| Principle | Papers | Description |
|-----------|--------|-------------|
| **Separation of Authority** | Schema-Gated, GBT, LGA, PRISM | Execution authority must be structurally separated from reasoning/conversational authority |
| **Independent Verification** | VMAO, LGA, ABC, TDAD, ToolSafe | The verifier must be independent of the executor (different model, different layer, different phase) |
| **Monotonic Safety** | GBT, ABC, SLEEC | Safety constraints should only tighten over time, never relax (experience-grounded monotonicity, contract invariants, defeater logic) |

### 5. Temporal Degradation Is the Unifying Threat
CQS's temporal degradation connects to:
- ABC's behavioral drift (agents drift from contracts over time)
- DBC's bypass rate (adversaries eventually find gaps in prompt-level controls)
- The Controllability Trap's three stages (capability expansion → control erosion → brittle governance)

**Every governance layer degrades over time unless actively maintained.** This implies the stack needs a continuous "governance maintenance" process, not just initial deployment.

---

## The Complete Stack — Reference Architecture

```
┌─────────────────────────────────────────────────────┐
│  META: Continuous Control Quality Measurement (CQS)  │
│  ↕ Monitors all layers for temporal degradation      │
├─────────────────────────────────────────────────────┤
│  L0: Design-Time Adversarial Hardening (MaMa)       │
│      Stackelberg game over system topology           │
├─────────────────────────────────────────────────────┤
│  L1: Normative Requirements (SLEEC)                  │
│      Ethics → formal rules via pluralistic elicitation│
├─────────────────────────────────────────────────────┤
│  L2: Behavioral Specification (TDAD + DBC)           │
│      Specs → tested prompts; 150 behavioral controls │
├─────────────────────────────────────────────────────┤
│  L3: Formal Contracts (ABC)                          │
│      Preconditions/postconditions/invariants + BDD   │
├─────────────────────────────────────────────────────┤
│  L4: Orchestration Governance                        │
│      COMPASS (sovereignty) + Schema-Gated (exec/conv │
│      separation) + VMAO (verify-replan)              │
├─────────────────────────────────────────────────────┤
│  L5: Execution Gates (GBT + ToolSafe)                │
│      Deterministic pre-execution safety gates        │
│      ★ Strongest empirical results here ★            │
├─────────────────────────────────────────────────────┤
│  L6: Runtime Defense-in-Depth (PRISM + LGA)          │
│      OS isolation + lifecycle hooks + audit trails    │
└─────────────────────────────────────────────────────┘
```

---

## Open Questions

1. **Layer Integration Testing:** No paper tests how layers interact when composed. Do they interfere? Do they create false sense of security at neglected layers?

2. **Cost of Full-Stack Governance:** Each layer adds latency and compute. What is the cumulative overhead of implementing all 7 layers? Is there a practical "minimum viable governance stack"?

3. **Adversarial Governance Evasion:** Adversaries will target the weakest layer. Are there attacks that specifically exploit layer boundaries (e.g., actions that are compliant at L3 contract level but violate L1 norms)?

4. **Governance Governance:** Who governs the governance mechanisms? ABC's monitors are LLM-based classifiers — can they be adversarially compromised? VMAO's verifier is a stronger LLM — but what if it's wrong?

5. **Dynamic Layer Adaptation:** Should governance intensity vary by risk level? Low-risk tasks might need only L5-L6; high-risk tasks might require L0-L6. But who assesses risk level — and at which layer?

---

## Significance for Koda/Multi-Agent Systems

This synthesis provides the **first complete reference architecture** for multi-agent governance enforcement. For any production multi-agent system:

1. **Audit against the stack:** Which layers are implemented? Which are missing?
2. **Prioritize Layer 5 (Execution Gates):** This is where the strongest evidence lives. GBT's results are the best in the portfolio.
3. **Don't stop at prompts (Layer 2):** DBC's 36.8% risk reduction is the ceiling for prompt-only governance.
4. **Plan for temporal degradation:** Every layer will erode. Build CQS-like continuous monitoring.
5. **Separate authorities structurally:** The single most convergent design principle across all 13 papers.

---

*Filed: 2026-04-03 | Scout Cross-Reference #15 | 13 papers synthesized across 7 layers*
*Portfolio: 197 deep-dives + 15 cross-reference syntheses*
