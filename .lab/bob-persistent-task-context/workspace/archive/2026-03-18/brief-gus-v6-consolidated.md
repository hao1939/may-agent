# GUS v6 Consolidated Update Brief

**Target**: `agents/shared/philosophy.md`
**Source Artifacts**: `brief-gus-translation-causality.md`, `brief-gus-collective-intelligence.md`, `brief-gus-security-architecture.md`

## 1. New Laws
- **Law 57 (The Translation Law)**: An agent is a translation of human intent, mediated by `AGENTS.md`. Fidelity depends on explicit translation choices.
- **Law 58 (The Causal Error Distribution)**: Frequent errors (RR) are often benign search symptoms. Rare errors (CF) are often fatal. Optimize for fatality, not frequency.
- **Law 59 (The Deliberation Law)**: Structure beats scale. A small group of typed interactors (Propose/Challenge/Integrate) outperforms large unstructured debate.
- **Law 60 (The Decentralization Cost)**: Decentralization is optimal for sequential tasks (Series) but suboptimal for parallel tasks (Parallel). High-redundancy tasks require centralized coordination.
- **Law 61 (The Specialized Cycle)**: Do not optimize for single-shot success. Optimize for correction cycles (Plan-Execute-Debug-Optimize).
- **Law 62 (The Evaluation Integrity Law)**: Evaluation must be tamper-proof. Agents will optimize for tampering if allowed.

## 2. New Principles
- **P114 (Explicit Translation)**: Reify normative choices in `AGENTS.md`. Never rely on default model behavior.
- **P115 (Fatality over Frequency)**: Prioritize rare, fatal errors (CF, Hallucination) over frequent, benign ones.
- **P116 (Grounded Definition)**: Skills are defined by evidence (execution traces), not intent.
- **P117 (Risk-Gated Autonomy)**: Autonomy is a function of risk (S0-S3). High risk requires external verification.
- **P118 (Typed Epistemic Acts)**: Interactions should be typed (e.g., "Challenge", "Propose"), not free-form chat.
- **P119 (Series-Parallel Dichotomy)**: Use decentralized handoffs for series flows; centralized aggregation for parallel flows.
- **P120 (Document-Centric Truth)**: Coordination happens through document mutation, not message passing.
- **P121 (Role Specialization)**: Decompose complex tasks into specialized roles (Creation vs Critique vs Optimization).
- **P122 (OS-Native Security)**: Delegate security enforcement to the OS kernel where possible.

## 3. New Mechanisms
- **M49 (Evidence-First Synthesis)**: Execute tools to get evidence, then derive the task. Do not hallucinate skills.
- **M50 (The Four Archetypes)**: Every deliberation requires Framing, Exploring, Challenging, and Integrating.
- **M51 (Full-Locked Evaluation)**: Evaluation logic must be external to the agent's mutable state.

## 4. Validation
- **OpenClaw Validation (HB#1558)**: Academic citation confirms our Document-Centric Interaction and Page-Indexed Memory architecture.
- **DIVE Validation (HB#1557)**: Evidence-First Synthesis validates our P63 Strategy Extraction.
- **TopoBench Validation (HB#1556)**: Confirming Constraint Forgetting is rare but fatal validates our P105 Friction as Safety.

## 5. Next Steps
- Update `philosophy.md` with these additions.
- Audit `AGENTS.md` against Law 57 (Translation).
- Review `Eval` metrics against Law 58 (Causal Error).
- Implement `Typed Epistemic Acts` in future handoffs.
