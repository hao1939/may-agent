# AIVV: Neuro-Symbolic LLM Council for Verification & Validation

**Source**: arXiv:2604.02478 (April 2, 2026)  
**Authors**: Jiyong Kwon, Ujin Jeon, Sooji Lee, Guang Lin  
**Type**: Multi-Agent Verification Framework

## Core Concept

AIVV (Agent-Integrated Verification and Validation) deploys **role-specialized LLM agents as a deliberative council** to automate Human-in-the-Loop (HITL) verification processes for autonomous systems.

## Problem Statement

Deep learning models can detect anomalies but struggle with:
- **Anomaly classification**: Distinguishing genuine faults from nuisance faults (noise/transients)
- **Scalability**: Rule-based validation doesn't scale across diverse control systems
- **Manual bottleneck**: Full V&V still requires unsustainable HITL analysis

## Two-Phase Council Architecture

```
Phase 1: COLLABORATIVE VALIDATION
┌─────────────────────────────────────────┐
│  Mathematical Anomaly Detection         │
│  ↓                                      │
│  Role-Specialized LLM Council           │
│  • Semantic validation of failures      │
│  • Distinguish true vs nuisance faults  │
│  • Natural language requirements check  │
└─────────────────────────────────────────┘
                    ↓
Phase 2: SYSTEM VERIFICATION
┌─────────────────────────────────────────┐
│  Post-fault response assessment         │
│  • Check against operational tolerances │
│  • Generate actionable artifacts        │
│  • Output: gain-tuning proposals, etc.  │
└─────────────────────────────────────────┘
```

## Key Mechanisms

1. **Neuro-Symbolic Hybrid**: Neural anomaly detection + symbolic LLM deliberation
2. **Role Specialization**: Council agents have distinct validation roles
3. **Natural Language Requirements**: V&V based on NL specifications, not just formal rules
4. **Actionable Output**: Generates concrete artifacts (tuning proposals) not just pass/fail

## Experimental Validation

- **Domain**: Unmanned Underwater Vehicles (UUVs) time-series simulator
- **Result**: Successfully digitized HITL V&V process
- **Achievement**: Overcame limitations of rule-based fault classification

## Relevance to Our System

- **Council Pattern**: Multi-agent verification through specialized roles
- **Quality Assurance**: Our system could use similar council for output validation
- **Hybrid Architecture**: Neural + symbolic combination for robust decision-making
- **Actionable Verification**: Generate concrete fixes, not just identify problems

## Design Patterns

| Pattern | Application |
|---------|-------------|
| Council of Experts | Multiple specialized validators for critical decisions |
| Two-Phase Verification | Validation → Verification pipeline |
| NL-Based Requirements | Natural language specifications as test criteria |
| Artifact Generation | Output actionable remediation proposals |

## Connections

- Similar to **AutoVerifier**'s multi-layer verification but with council deliberation
- Complements **Role Clarity** research on specialized agent roles
- Aligns with **SCRAT**'s verification-integrated architecture

## Questions for Our System

1. Should we add a "Verification Council" for critical agent outputs?
2. Can we use natural language requirements as runtime test criteria?
3. How might artifact generation improve our error recovery?
