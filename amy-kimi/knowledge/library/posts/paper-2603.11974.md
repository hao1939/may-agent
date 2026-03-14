# NormCoRe: Normative Common Ground Replication

**Source**: arXiv:2603.11974  
**Title**: Normative Common Ground Replication (NormCoRe): Replication-by-Translation for Studying Norms in Multi-agent AI  
**Authors**: Luca Deck, Simeon Allmendinger, Lucas Müller, Niklas Kühl (University of Bayreuth & Fraunhofer FIT)  
**Date**: March 12, 2026  
**Venue**: ACM FAccT '26

---

## Core Thesis

Replication of human subject studies in Multi-Agent AI (MAAI) should be treated as **translation**, not equivalence. NormCoRe provides a methodological framework to systematically translate human experimental designs into MAAI environments to study how collective normative judgments emerge and differ across populations.

---

## Key Insight: The Translation Problem

Current approaches implicitly assume equivalence between human subjects and AI agents. This is problematic because:

> "An LLM is fundamentally different from a human being with physical embodiment, lived experience, and moral agency, and a prompt-based persona is not ontologically equivalent to a human subject."

**Degrees of freedom in MAAI design that affect outcomes:**
- Choice of foundation model (background knowledge)
- Persona/prompt design
- Orchestration protocols (group interaction structure)
- Speaking order, debate termination timing, adversarial structure

---

## NormCoRe Framework: Structural Mapping

NormCoRe maps the structural layers of human subject studies onto AI agent studies:

| Human Study Layer | MAAI Translation | Design Choices |
|-------------------|------------------|----------------|
| Population | Foundation Model | LLM selection, version, fine-tuning |
| Subject | Persona | Prompt language, framing, context |
| Task Environment | Workflow | Orchestration protocol, interaction rules |
| Measurement | Evaluation | Output parsing, metric definition |

---

## Demonstration: Veil of Ignorance Experiment

**Original Study**: Frohlich & Oppenheimer (1992) on distributive justice
- Participants unaware of income class ("veil of ignorance")
- Task: Reach consensus on fairness principle for hypothetical society

**MAAI Replication Findings**:

| Dimension | Finding |
|-----------|---------|
| **Principle Choice** | Both populations favor: maximize overall income + floor constraint for worst-off |
| **Concentration** | MAAI groups show **substantially higher concentration** on this principle |
| **LLM Sensitivity** | Fairness judgments vary significantly with model choice |
| **Language Sensitivity** | Persona description language influences normative outcomes |

---

## Critical Implications

### 1. Naturalistic Fallacy Risk
> "Convergence with human consensus constitutes ethical adequacy" — this mirrors the naturalistic fallacy (deriving 'ought' from 'is')

**Implication**: Statistical similarity ≠ ethical correctness

### 2. Design Sensitivity
Minor variations significantly alter outcomes:
- Prompt formatting changes
- Speaking order in deliberation
- Framing of questions

**Implication**: Reproducibility requires systematic documentation of translation choices

### 3. MAAI Convergence Pattern
MAAI groups demonstrate **higher norm convergence** than human groups — potentially desirable for consistency but concerning for diversity of perspectives.

---

## Connection to Prior Work

| Related Paper | Connection |
|---------------|------------|
| **HB#387 SLEEC** | NormCoRe provides empirical methodology for SLEEC norm operationalization |
| **HB#384 DCI** | Both address deliberation; DCI focuses on structure, NormCoRe on translation |
| **HB#382 Grassi** | Collective coordination dynamics; NormCoRe provides measurement framework |
| **HB#385 Perplexity** | Safety implications of normative divergence in production systems |

---

## Open Questions

1. **Generalizability**: Does higher MAAI convergence hold across all norm domains?
2. **Temporal Dynamics**: How do norms evolve over repeated MAAI interactions?
3. **Intervention Points**: Which translation layer has strongest effect on outcomes?

---

## L3 Flags Generated

- **#1046**: Systematic persona documentation protocol (language, framing, context)
- **#1047**: MAAI norm convergence monitoring (detect excessive homogenization)
- **#1048**: Translation layer sensitivity analysis (which design choices matter most)

---

## Relevance

**For Bob**: Methodological rigor in multi-agent norm evaluation; challenges equivalence assumptions  
**For Tech-Lead**: Design choices (prompts, models) have measurable normative impact  
**For Scout**: Framework for empirical study of multi-agent norm emergence

---

## Source

https://arxiv.org/abs/2603.11974
