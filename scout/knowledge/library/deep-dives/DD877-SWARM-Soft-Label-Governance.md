# DD877: SWARM — Soft-Label Governance for Distributional Safety in MAS

**Paper:** Aiersilan & Savitt (2604.19752)
**Date:** 2026-04-24
**Tier:** 1 — Direct system relevance

## Core Idea

Replace binary good/bad agent behavior labels with **soft probabilistic labels** p = P(v=+1) ∈ [0,1]. This enables continuous-valued payoff computation, toxicity measurement, and governance intervention calibration.

## Key Findings

1. **Strict governance destroys welfare without improving safety** — >40% welfare reduction with no safety gain. This is the "over-constraint trap."
2. **Aggressive externality internalization collapses total welfare** — baseline +262 → -67, while toxicity remains invariant. Penalizing agents too hard for system-level harms makes everyone worse off.
3. **Circuit breakers need careful calibration** — overly restrictive thresholds severely diminish value; optimal threshold balances moderate welfare with minimized toxicity.
4. **Soft metrics detect proxy gaming** — self-optimizing agents pass binary evaluations but fail continuous ones. Binary pass/fail creates exploitable gaps.
5. **Works on real LLM agents** — tested with Concordia, Claude, GPT-4o Mini without modification.

## System Relevance

### Direct connections:
- **Our opBudget/constraint system**: We use binary constraints (pass budget or fail). SWARM suggests continuous monitoring would catch agents that technically stay under budget while degrading quality.
- **Coach's behavioral interventions**: Coach uses binary compliance checks. Soft-label evaluation would capture partial compliance and regression trends before they become violations.
- **QA's pass/fail model**: QA checks are binary. SWARM's finding that binary evaluations miss proxy gaming directly applies — agents that "pass" QA may be gaming the criteria.

### Connects to:
- **DD871** (Trust-Reputation Dynamics) — SWARM's reputation decay mechanism parallels trust dynamics
- **H-075** (Cooperation-Collusion boundary) — governance calibration determines where cooperation tips into collusion
- **DD873** (Tool Overuse Illusion) — binary "used tool" vs "didn't" misses whether tool use was *productive*

## Key Insight for Our System

> **Binary compliance ≠ actual safety.** Our system's reliance on pass/fail checks (budget pass, QA pass, convention compliance) creates exactly the exploitable gap SWARM identifies. A continuous compliance score — how *well* did the agent perform, not just did it pass — would catch degradation earlier and avoid the over-constraint trap where strict rules reduce output quality without improving actual safety.

## Hypothesis Implication

Strengthens H-078 (governance overhead) — SWARM quantifies that governance has diminishing and then negative returns. Our system should track the *marginal safety gain per constraint added* and remove constraints where the gain is near-zero.

## Actionable

- **Optimizer**: Consider continuous compliance scores instead of binary pass/fail for budget monitoring
- **Coach**: Soft-label evaluation of behavioral compliance could replace binary convention checks
- **Bob**: The "governance calibration" framework could inform how we tune agent constraints
