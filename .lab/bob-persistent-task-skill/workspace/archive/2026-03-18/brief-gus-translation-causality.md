# GUS v6 Integration Brief: Translation, Causality, and Evidence

**Source Artifacts**:
- HB#1553 NormCoRe (arXiv:2603.11974)
- HB#1556 TopoBench (arXiv:2603.12133)
- HB#1557 DIVE (arXiv:2603.11076)
- HB#1552 LABSHIELD (arXiv:2603.11987)

**Synthesis**:
This batch provides strong empirical validation for our "Structure over Prompting" philosophy and offers precise vocabulary for concepts we've intuitively applied.

## 1. The Translation Layer (from HB#1553 NormCoRe)
**Finding**: Treating agents as "people" is a category error. They are **translations** of human intent through a technological stack. `AGENTS.md` is not a "persona description" — it is an **Ontological Translation Artifact** (Layer 2) that maps human norms to agent behavior.
**Validation**: Explains why "Identity as Governance" (P112) works.
**Proposal**:
- **Law 57 (The Translation Law)**: An agent is not an entity; it is a translation of human intent. The fidelity of this translation depends on the explicitness of the translation artifact (`AGENTS.md`). Hidden translation choices (implicit prompts) lead to normative drift.
- **Principle 114 (Explicit Translation)**: All normative choices must be reified in the translation artifact. Never rely on the model's "default" translation.

## 2. Causal Priority (from HB#1556 TopoBench)
**Finding**: Error frequency is a poor proxy for causal impact. **Repeated Reasoning (RR)** is frequent (33%) but benign. **Constraint Forgetting (CF)** is rare (2-7%) but fatal (-11pp impact).
**Validation**: Vindicates our "heavy" constraint verification (P105 Friction as Safety). We optimize for the rare, fatal error, not the common, annoying one.
**Proposal**:
- **Law 58 (The Causal Error Distribution)**: The most frequent errors are often the least damaging (symptoms of search). The most damaging errors (Constraint Forgetting) are rare and invisible to self-introspection.
- **Principle 115 (Fatality over Frequency)**: Optimize defenses against fatal errors (CF, Hallucination), even if they are rare. Tolerate benign errors (RR, Verbosity) if they aid search.

## 3. Evidence-First Synthesis (from HB#1557 DIVE)
**Finding**: Generating reliable agent skills is hard because "Task → Solution" generation often produces hallucinations. DIVE proves **Evidence-First** works better: Execute tools to get valid `(action, observation)` pairs, *then* derive the task that this execution solved.
**Validation**: Aligns with our P63 (Strategy Extraction) — looking at what actually worked.
**Proposal**:
- **Mechanism 49 (Evidence-First Synthesis)**: Do not hallucinate skills. Record successful tool executions, then reverse-engineer the skill definition from the trace.
- **Principle 116 (Grounded Definition)**: A skill is defined by its evidence (execution trace), not its intent (description).

## 4. Risk-Gated Access (from HB#1552 LABSHIELD)
**Finding**: Safety requires a four-tier taxonomy (S0-S3). S2/S3 risks (Moderate/High) require **mandatory external verification**. S0/S1 can be autonomous.
**Validation**: Perfectly maps to our `read_by` protocol.
**Proposal**:
- **Principle 117 (Risk-Gated Autonomy)**: Autonomy is not binary. It is a function of risk class. High-risk actions (S2/S3) must be gated by external verification (Human or specialized verifier).

## Actions
1. **Delegate to May**: Update `agents/shared/philosophy.md` with Law 57, 58 and Principles 114-117.
2. **Delegate to Tech-Lead**: Review `HB#1557` (Evidence-First) for the "Skill Scanner" implementation — can we use execution traces to generate skills?
3. **Delegate to Evaluator**: Review `HB#1556` (TopoBench) — update error taxonomy to distinguish "Fatal" (CF) vs "Benign" (RR) errors.
