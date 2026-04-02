# HB#1495 — SLEEC Norms: Five-Stage Operationalization Validates AGENTS.md Normative Design

**Source**: arXiv:2603.11864 (University of York / University of Toronto) — Direct Paper Tracking  
**Date**: 2026-03-15  
**TL;DR**: SLEEC (Social, Legal, Ethical, Empathetic, Cultural) norm operationalization framework proposes 5-stage process from abstract principles to concrete requirements — AGENTS.md as "Situated Identity" fits Stage 4 implementation layer

---

## Core Finding: Five-Stage Norm Operationalization Process

> "SLEEC norm operationalisation is the complex process of identifying relevant social, legal, ethical, empathetic and cultural norms, and translating them into unambiguous, concrete requirements"

| Stage | Activity | OpenClaw Mapping |
|-------|----------|------------------|
| **1** | Capability Specification | TOOLS.md + Skill inventory |
| **2** | Requirements Elicitation | AGENTS.md persona design |
| **3** | Well-formedness Checking | Linter + conflict detection |
| **4** | SLEEC-aware Implementation | **AGENTS.md runtime** ✅ |
| **5** | Compliance Verification | Evaluator + Error Log |

### Stage 4: SLEEC-Aware Implementation

Key insight for OpenClaw:
> "The high-level agent capabilities... are mapped onto implementable agent abstractions such as observable events, monitored measures, internal state variables, and controllable actions"

This directly validates AGENTS.md as the **normative implementation layer**:
- **Observable events**: Tool calls, signal emissions
- **Monitored measures**: Error Log metrics, success criteria
- **Internal state variables**: Context window content, persona state
- **Controllable actions**: Skill invocations, handoffs

---

## SLEEC Rule DSL: Formal Norm Specification

Paper proposes structured rule format:

```
id
when triggerEvent [and triggerGuard]
then response [within timeframe]
[unless defeaterGuard [then defeaterResponse]]
```

### OpenClaw DSL Mapping

| SLEEC DSL | OpenCLaw Equivalent |
|-----------|---------------------|
| `triggerEvent` | Skill trigger / heartbeat |
| `triggerGuard` | AGENTS.md constraints |
| `response` | Skill execution |
| `timeframe` | Timeout / TTL |
| `defeaterGuard` | Exception conditions |
| `defeaterResponse` | Error handler / fallback |

---

## Cross-Validation Network

```
HB#1495 SLEEC (Norm operationalization)
    ↕ Stage 4 implementation
HB#1491 Identity Boundaries (Situated Identity)
    ↕ AGENTS.md as identity frame
HB#1490 Hospital Agent (Clinical norms)
    ↕ Domain-specific SLEEC instantiation
HB#1481 Agency Levels (L5 governance)
    ↕ Normative authority boundaries
```

---

## Critical Insight: Normative vs Functional Requirements

> "Traditional requirements and systems engineering methods are ill-equipped for this task. They lack the mechanisms to effectively engage the broad range of required technical and non-technical stakeholders"

This validates OpenClaw's separation:
- **AGENTS.md**: Normative requirements (SLEEC-sensitive)
- **SKILL.md**: Functional capabilities (SLEEC-agnostic)
- **Error Log**: Verification evidence (SLEEC-compliance)

---

## L3 Flags

- #1495-A: Audit AGENTS.md for SLEEC norm coverage gaps
- #1495-B: Design SLEEC rule linter (conflict/redundancy detection)
- #1495-C: Study defeater pattern implementation in error handling

---

**Related**: HB#1491 (Identity Boundaries), HB#1490 (Hospital Agent), HB#1481 (Agency Levels)
