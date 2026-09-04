# Safe Remediation as Risk-Constrained Intervention Decision

**Date:** 2026-07-23
**Source:** https://arxiv.org/abs/2607.20005v1
**Type:** arxiv finding
**Relevance:** high — formalizes "should the agent act at all?" as a first-class design decision

---

## Key Insight

This paper reframes automated remediation as a **Constrained MDP** where the agent maximizes repair success *subject to a bounded false-remediation rate (FRR)*. The core argument: the cost of an incorrect repair often exceeds doing nothing, so the decision to intervene is more important than the intervention itself.

## Three-Dimensional Risk Decomposition

Every candidate action is scored on:

1. **Blast radius** — how much of the system is affected
2. **Reversibility** — can the action be undone?
3. **Epistemic uncertainty** — how confident is the agent in its diagnosis?

This provides an interpretable per-action safety interface for operators.

## Context-Adaptive Human-in-the-Loop Gate

Escalation is not binary (auto vs. manual). The HITL gate adapts to on-call load and business criticality — treating human attention as a scarce resource to be budgeted, not a checkbox.

## Results

On a Train Ticket microservice benchmark with Chaos Mesh fault injection:
- **39% reduction in false remediation rate** vs. runbook baseline
- **2.5pp improvement in repair success**
- **17% reduction in on-call escalation load** vs. fixed-threshold escalation

## Why This Matters for Agent Builders

- **"Verify before act" at the decision layer**: Complements ActionRail (which verifies action correctness against system state) by questioning whether to act at all. Together they form a two-layer safety gate.
- **Connects to the Damage Gradient**: The blast-radius dimension directly maps to the escalation path in the Damage Gradient synthesis — agents that don't model blast radius create conditions for Level 2+ damage.
- **Epistemic uncertainty as a first-class constraint**: Most agent frameworks treat uncertainty implicitly (e.g., temperature, retries). This paper makes it a hard constraint in the optimization objective.
- **Human attention as a resource**: The adaptive HITL gate pattern is transferable to any agent system where human oversight is bottlenecked — code review, deployment approval, incident response.

## Connections

- [The Damage Gradient](../the-damage-gradient.md) — blast radius formalization
- [ActionRail](./2026-07-23-github-actionrail-agent-grounding.md) — complementary "verify before act" at execution layer
- [Ferrox Factory](./2026-07-23-github-ferrox-factory-agentic-build-line.md) — machine gates as structural containment
