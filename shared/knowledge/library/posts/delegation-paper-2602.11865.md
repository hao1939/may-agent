# Intelligent AI Delegation

**Source**: arXiv:2602.11865  
**Authors**: Nenad Tomašev, Matija Franklin, Simon Osindero (Google DeepMind)  
**Date**: February 12, 2026  
**Archive Ref**: HB#328  
**Citations in Archive**: 7

---

## Core Thesis

> Intelligent delegation is a sequence of decisions involving task allocation, incorporating transfer of **authority, responsibility, accountability**, clear role/boundary specifications, clarity of intent, and **trust establishment mechanisms**.

Delegation ≠ Task Decomposition

---

## Key Concepts

### 1. Zone of Indifference
When authority is accepted, delegatee develops a range of instructions executed without critical deliberation.

**Risk**: In long delegation chains (A→B→C), broad zone of indifference allows intent mismatches to propagate rapidly.

**Implication**: Need "dynamic cognitive friction" — agents must recognize contextually ambiguous requests and challenge them.

### 2. Authority Gradient
Disparities in capability/experience/authority impeding communication.

**AI-specific risks**:
- Capable delegator overestimates delegatee ability → under-specified requests
- Delegatee sycophancy → reluctance to challenge requests

### 3. Span of Control
Number of subordinates a manager can effectively oversee.

**Applies to**:
- Orchestrator-to-worker ratio in agent networks
- Human oversight capacity (how many AI agents can one human reliably supervise?)

**Factors**: Task complexity, criticality, cost vs performance tradeoffs

### 4. Trust Calibration
Aligning trust level with true underlying capabilities.

**Challenge**: Current AI models prone to overconfidence when factually incorrect.

---

## Task Characteristics (9 Dimensions)

1. **Complexity** — difficulty, sub-steps, reasoning depth
2. **Criticality** — importance, failure consequences
3. **Uncertainty** — environmental/input ambiguity
4. **Duration** — execution timeframe
5. **Cost** — economic/computational expense
6. **Resource Requirements** — needed assets/permissions
7. **Constraints** — operational/ethical/legal boundaries
8. **Verifiability** — validation cost (high = "trustless" delegation)
9. **Reversibility** — can effects be undone?
10. **Contextuality** — external state/history dependency
11. **Subjectivity** — preference vs objective success criteria

---

## OpenClaw Relevance

| Concept | OpenClaw Application |
|---------|---------------------|
| Zone of Indifference | Sub-agent "challenge/rescalate" mechanism |
| Authority Gradient | Main Agent capability assessment of Sub-agents |
| Span of Control | Dynamic limit on parallel Sub-agent executions |
| Trust Calibration | Sub-agent capability profiling from Error Log |
| Task 9D Analysis | Router decision framework for delegation |

---
*Archived: HB#328 | SIG: 1773442840*
