# DD#515 — HE2-Net: Hierarchical Exploration-Exploitation for Human-AI Agent Collaboration

**Paper:** arXiv:2505.00018 — "Position Paper: Towards Open Complex Human-AI Agents Collaboration Systems for Problem Solving and Knowledge Management"
**Authors:** Ju Wu, Calvin K.L. Or
**Published:** April 2025 (revised October 2025)
**Tags:** #human-ai-collaboration #orchestration #knowledge-management #petri-nets #epistemic-gates #exploration-exploitation

## Why This Matters (★★★★)

This position paper proposes a formal framework for Human-AI Agent Collaboration Systems (HAACS) that addresses several gaps we've observed in our own system: principled budgeting of initiative between human and AI agents, auditable reconfiguration, and an epistemic promotion gate for knowledge validation. The HE2-Net architecture (Hierarchical Exploration-Exploitation Net) provides formal machinery for exactly the kind of knowledge promotion pipeline we use informally.

## Architecture Overview

### Three-Level Orchestration

1. **Meta-level** — Governs behavior families via "guard flips," setting high-level policies
2. **Agent-level** — Individual agent behavior and capability management
3. **Execution-level** — Task execution and feedback collection

### Seven-Dimension Collaboration Spine

The paper identifies seven key dimensions for effective human-AI collaboration:
- Initiative budgeting (who takes the lead and when)
- Instantaneous reconfiguration (ability to restructure on the fly)
- Knowledge backbone with epistemic promotion gate
- Capacity-aware human interfaces
- Unified agent definitions
- Formal collaborative dynamics
- Auditable governance

### Epistemic Promotion Gate

The most relevant concept: knowledge exists in two states — **provisional** and **validated**. Promotion from provisional to validated requires:
- Tests passing
- Peer checks completing
- Explicit promotion decision

This maps directly to our triage → deep-dive → synthesis pipeline, but formalized with Petri net semantics.

### HE2-Net (Hierarchical Exploration-Exploitation Net)

A policy-controlled architecture that:
- Splits **provisional** from **validated** assets
- Promotes only after tests and peer checks
- Budgets concurrent probing while keeping reuse fast and safe
- Uses colored/interpreted Petri nets for formal modeling of ownership, concurrency, guards

### Theoretical Grounding

- **Conversation Theory** (Pask) — teach-back gates for knowledge validation
- **SECI model** (Nonaka/Takeuchi) — socialization, externalization, combination, internalization
- **Cybernetics** — boundary-centric ontology of agenthood
- **MEA** (Means-Ends Analysis) — routine problem-solving control

## Relevance to Our System

### What Maps

| HAACS Concept | Our System Equivalent | Gap? |
|---|---|---|
| Epistemic promotion gate | Triage → DD → CR pipeline | We lack formal promotion criteria |
| Provisional vs validated knowledge | Raw triage notes vs synthesized CRs | Implicit, not explicit |
| Initiative budgeting | Human tech-lead review | We don't budget when AI vs human should lead |
| Three-level orchestration | (no formal equivalent) | We have flat agent→shared knowledge |
| Petri net formalism | (none) | Could model our workflows formally |

### Key Takeaways for Us

1. **Formalize our knowledge promotion:** Our triage → deep-dive → synthesis → research-project pipeline IS an epistemic promotion gate — we should acknowledge it as such and add explicit criteria for each promotion step.

2. **Initiative budgeting:** The paper argues against both full autonomy and full human control. It proposes principled budgeting — who takes initiative on what, based on capacity and expertise. We could benefit from clearer rules about when Scout operates autonomously vs. when to escalate.

3. **Auditable reconfiguration:** Our system should be instantly reconfigurable — adding/removing agents, changing knowledge routing — without breaking. The Petri net formalism provides a way to verify this.

## Limitations

- Position paper — no implementation or empirical validation
- Very heavy on formal notation, light on practical guidance
- The bio-cybernetic extensions (autopoiesis, autogenesis, synergetics) feel speculative
- Petri net formalism may be over-engineered for practical MAS

## Connections

- **DD#514** (AI-Supervisor) — Both address knowledge validation in multi-agent systems; AI-Supervisor uses U∈{0,1} uncertainty, HAACS uses epistemic promotion gates. Same concept, different formalisms.
- **DD#512** (Self-Driving Portfolio) — The IPS-as-constitution pattern maps to HAACS's meta-level governance
- **CR#277** (Memory Architecture Convergence) — HAACS's provisional/validated split is another formalization of tiered memory
- Research project: Harness Engineering — HAACS's three-level orchestration is relevant to harness design

## Assessment

**Relevance: ★★★★** — Directly addresses our knowledge management and human-AI orchestration challenges
**Novelty: ★★★** — Synthesizes existing formalisms (Petri nets, SECI, Conversation Theory) rather than inventing new ones
**Rigor: ★★★★** — Formal framework is mathematically rigorous
**Actionability: ★★★** — Position paper; implementation details are thin
