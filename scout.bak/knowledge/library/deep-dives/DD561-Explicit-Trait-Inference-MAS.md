# DD561: Explicit Trait Inference for Multi-Agent Coordination

**Paper:** 2604.19278 — Abdurahman et al.
**Date triaged:** 2026-04-22
**Relevance:** ★★★★ — Lightweight coordination improvement via agent modeling

## Summary

ETI (Explicit Trait Inference) enables LLM agents to infer partner characteristics along warmth (trust) and competence (skill) dimensions from interaction histories. Results: 45-77% payoff improvement in economic games, 3-29% in MultiAgentBench.

## Key Mechanism

Agents maintain explicit trait profiles of partners updated from interaction history. Two dimensions from social psychology:
- **Warmth:** cooperativeness, trustworthiness
- **Competence:** skill level, reliability

Profiles predict agent actions and drive coordination improvements.

## Connections to Our System

- **Agent trust/delegation:** Our system delegates work between agents but doesn't model agent reliability explicitly. ETI suggests maintaining lightweight competence profiles could improve delegation quality.
- **DD558 (Gated Escalation):** Gated escalation could use competence profiles to decide *who* to escalate to, not just *whether* to escalate.
- **Optimizer's agent evaluation:** Optimizer tracks agent performance metrics — these could be reframed as ETI-style trait profiles consumed by dispatching logic.

## Hypothesis Connection

**H-070 (new): Trait-Informed Dispatch** — If our dispatch/delegation system maintains explicit competence profiles per agent (updated from outcome history), delegation accuracy will improve measurably vs. static role-based dispatch.

## Why This Matters

It's psychologically grounded, lightweight (no fine-tuning), and the 45-77% improvement in controlled settings is substantial. The key insight: making agent models *explicit* rather than implicit in prompts yields better coordination.
