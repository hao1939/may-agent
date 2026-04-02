# Deep Dive: Talk Freely, Execute Strictly — Schema-Gated Agentic AI for Flexible and Reproducible Scientific Workflows

**Paper:** arXiv:2603.06394v1  
**Authors:** Joel Strickland, Arjun Vijeta, Chris Moores, Oliwia Bodek, Bogdan Nenchev, Thomas Whitehead, Charles Phillips, Karl Tassenberg, Gareth Conduit, Ben Pellegrini  
**Affiliation:** Intellegens (Cambridge, UK) + Independent Researchers + Cavendish Laboratory  
**Date:** 06 March 2026  
**Topics:** Agentic AI architecture, workflow orchestration, schema validation, execution determinism, scientific reproducibility

---

## Summary

This paper identifies and resolves a fundamental tension in LLM-driven scientific workflows: researchers need **conversational flexibility** (CF) to explore ideas naturally AND **execution determinism** (ED) to ensure reproducible, auditable computation. Through semi-structured interviews with 18 experts across 10 industrial R&D stakeholders, the authors surface these two competing requirements and propose **schema-gated orchestration** as the resolving principle: the LLM can "talk freely" (converse, reason, propose) but must "execute strictly" (all actions validate against a machine-checkable schema before running).

---

## Core Contributions

### 1. Practitioner-Grounded Requirements Elicitation

Semi-structured interviews (20 sessions, ~30min each) with 18 experts spanning specialty chemicals, food science, materials, semiconductors, construction, and manufacturing yielded:

- **17 themes** from 1,135 codings across 2,468 speaker-turn paragraphs
- **4 theme clusters**: Determinism pole (527 mentions), Flexibility pole (300), Cross-cutting/boundary (146), Out-of-scope (162)
- **Two core requirements:**
  - **Req A: Execution Determinism** — Stable, repeatable, validated computations for the scientific record
  - **Req B: Conversational Flexibility** — Natural language interaction for rapid iteration and exploration
- **Boundary properties:** Explainability/transparency, human-in-the-loop control, progressive autonomy — constraints any resolution must satisfy

### 2. Architectural Taxonomy and Design Space

The paper reviews 20 representative systems across five groups along a "validation-scope spectrum":

| Group | Examples | ED | CF |
|-------|----------|----|----|
| **Generative** | LLM chat, GitHub Copilot, AutoGPT | Low | High |
| **Tool-augmented** | LangChain, Semantic Kernel | Medium | Medium-High |
| **Schema-gated** | OpenAI Assistants (strict mode), Copilot Studio | High | High |
| **Workflow + NL** | n8n, Dataiku, NL-assisted authoring | High | Medium |
| **Workflow-centric** | Galaxy, Snakemake, Nextflow, Airflow, Kubeflow | Very High | Low |

### 3. Multi-Model LLM Scoring Protocol

A novel methodological contribution: each of 20 systems was scored in **15 independent sessions** across 3 LLM families (ChatGPT 5.2, Claude Sonnet 4.6, Gemini 3.1 Pro), yielding:
- **Krippendorff's α = 0.80** for ED
- **Krippendorff's α = 0.98** for CF
- Demonstrates that multi-model LLM scoring can serve as a reusable alternative to human expert panels

### 4. The Empirical Pareto Front

The ED/CF design space reveals **no system achieves both maximum flexibility and maximum determinism** — but a convergence zone exists. The schema-gated group (OpenAI Assistants strict mode, Copilot Studio) sits closest to the ideal (5,5) corner.

### 5. Schema-Gated Orchestration Principles

Three operational principles:
1. **Clarification-before-execution**: The system must resolve ambiguity conversationally *before* any computation runs
2. **Constrained plan-act orchestration**: LLM plans freely but acts only through validated invocations
3. **Tool-to-workflow-level gating**: Schema validation extends from individual tool calls to composed multi-step workflows

**Key architectural insight:** Execution authority is separated from conversational authority. The LLM has full conversational authority (interpret intent, propose actions, explain) but zero direct execution authority (all actions pass through schema gates).

---

## The Execution Authority Framework

The paper introduces "execution authority" as a lens for analyzing where responsibility for concrete executable behavior resides:

- **Paradigm I (Generative):** Execution authority resides in the LLM/agent. Final artifact = generated code. Contract is conversational, not machine-checkable.
- **Paradigm II (Workflow-centric):** Execution authority resides in the workflow specification. Final artifact = explicit DAG/DSL/config. NL assists but doesn't control.
- **Paradigm III (Schema-gated):** Execution authority resides in the schema-validated layer. Final artifact = fully resolved, machine-checkable invocation object. NL drives intent, schema gates execution.

The schema-gated approach makes:
- **Approval gates trivial** — the invocation is an inspectable artifact
- **Provenance captured by construction** — every run is a validated, versioned record
- **Reproducibility inherent** — same schema + same inputs = same execution

---

## Relevance to AI Safety & Multi-Agent Systems

### Direct Connections

1. **Constraining AI agent execution**: Schema gating is a concrete architectural pattern for ensuring AI agents can reason freely but act only within validated boundaries. This is a practical instantiation of the "sandbox" or "corrigibility" concept.

2. **Separation of conversational and execution authority**: This architectural principle directly addresses the alignment problem at the systems level — the LLM's reasoning doesn't need to be perfectly aligned because the schema gate catches invalid actions regardless of the reasoning behind them.

3. **Human-in-the-loop by construction**: When every action must pass through a machine-checkable invocation object, human oversight becomes inspecting that object rather than auditing opaque LLM reasoning. This dramatically reduces the oversight burden.

4. **Provenance and auditability for AI governance**: The schema-gated architecture provides exactly the kind of machine-readable audit trail that emerging AI governance frameworks demand.

5. **Multi-agent coordination**: When multiple agents compose workflows, schema gating at the workflow level prevents cascading errors or unauthorized action sequences.

### Portfolio Cross-References

- **SLEEC norm operationalization** (2603.11864): SLEEC norms could serve as the schema constraints in a schema-gated architecture — translating social/legal/ethical norms into machine-checkable validation gates.

- **Multi-agent authorization/bureaucracy** (2603.09875): Schema gating is the practical implementation of authorization constraints in multi-agent systems. The structural equivalence to memory consistency models could inform schema composition rules.

- **Attack & defense in agentic AI** (2603.11088): Schema gating provides a defense-in-depth layer against prompt injection and tool misuse — even if the LLM is compromised, invalid actions are rejected by the schema gate.

- **WebWeaver topology attack** (2603.11132): Schema validation could prevent topology-based attacks by constraining the valid action space for web-navigating agents.

- **Value alignment via negotiation** (2603.11126, 2603.10476): Schema-gated execution could enforce alignment constraints discovered through negotiation, turning soft alignment into hard execution boundaries.

- **XSkill continual learning** (2603.12056): Schema gating could constrain what new skills an agent learns by requiring new tool integrations to pass schema validation — preventing capability acquisition that violates governance constraints.

- **Strategically Robust MARL** (2603.09208): Schema gating provides an architectural complement to RQRE's theoretical robustness — even with robust equilibria, schema validation adds a hard constraint layer.

---

## Methodological Innovation

The **multi-model LLM scoring protocol** is itself noteworthy:
- Using multiple LLM families as independent "raters" to assess architectural properties
- Achieving Krippendorff's α of 0.80-0.98 demonstrates this can replace or supplement expert panels
- This methodology could be applied broadly to evaluate AI system designs, safety properties, etc.

---

## Limitations and Open Questions

1. **Empirical validation pending**: The reference architecture is proposed but not empirically validated — this is explicitly identified as the most pressing near-term priority
2. **Convenience sample**: All stakeholders recruited through Intellegens' professional network, potentially over-representing ML-forward organizations
3. **Schema rigidity**: How to handle genuinely novel actions that don't fit existing schemas? The tension between safety (reject unknown) and capability (allow exploration) isn't fully resolved
4. **Performance overhead**: Schema validation adds latency — not quantified
5. **Schema evolution**: How schemas evolve as scientific domains develop new methods needs more treatment
6. **Adversarial robustness of schemas**: Can an LLM learn to craft technically-valid-but-harmful schema-conforming actions?

---

## Assessment

**Relevance: ★★★★★ CRITICAL**  
**Novelty: ★★★★☆ HIGH**  
**Practical Impact: ★★★★★ EXCEPTIONAL**

This paper provides one of the most practical and immediately actionable architectural frameworks in the portfolio. The schema-gated pattern — "talk freely, execute strictly" — is an elegant operationalization of AI safety principles at the systems architecture level. The practitioner-grounded methodology and multi-model scoring protocol add methodological rigor. The separation of conversational and execution authority is a pattern that should inform the design of any deployed agentic AI system.
