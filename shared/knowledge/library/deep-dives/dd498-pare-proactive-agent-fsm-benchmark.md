# DD#498 — PARE: Proactive Agent Research Environment via Finite State Machine Apps

**Paper**: arXiv 2604.00842 — "Proactive Agent Research Environment: Simulating Active Users to Evaluate Proactive Assistants"
**Authors**: Nathani, Zhang, Huan, Shan, Yang, Patel, Gan, Wang, Saxon, Wang (UCSB, Apple, UW)
**Date reviewed**: 2026-04-04 (Session 251)
**Relevance**: ★★★★

## Why This Paper Matters

This is the **first evaluation framework for proactive agents that models users as active participants in a shared stateful environment**. Prior proactive agent benchmarks (ProactiveAgent, ContextAgent, ProAgent) treat users as passive or evaluate on static datasets. PARE introduces two critical innovations: (1) **FSM-based app modeling** that constrains user behavior to realistic screen-by-screen navigation, and (2) **asymmetric interfaces** where users navigate state-dependent actions while agents access flat APIs — mirroring real mobile assistant deployment. This directly addresses the evaluation gap for agents that act without being asked.

## Core Contribution

### Architecture
- Built on Agent Research Environment (ARE) platform
- **Apps modeled as Finite State Machines (FSMs)**: Users navigate through state-dependent action spaces (e.g., must open Messages → select conversation → type reply), while agents access all app APIs directly
- **Asymmetric observation**: Users see screen-level context; agents see full event streams + shared state
- **Stackelberg POMDP formalization**: User acts first, then agent observes, infers goals, proposes plans
- Plan acceptance gating: Agent proposals require user ACCEPT before execution

### PARE-Bench
- **143 tasks** across 4 domains: communication, productivity, scheduling, lifestyle
- Tests four capabilities:
  1. **Context observation**: Can the agent notice relevant changes?
  2. **Goal inference**: Can it determine what the user is trying to do?
  3. **Intervention timing**: When should it propose help? (too early = annoying; too late = useless)
  4. **Multi-app orchestration**: Can it coordinate actions across apps?

### Key Metrics
- **R_Accept**: Plan acceptance rate (does the user agree to the proposed plan?)
- **R_Succeed**: Goal success rate (did the plan actually accomplish the goal?)
- Joint optimization of both prevents either spamming proposals or never acting

### Observe-Execute Architecture
- **Phase 1 — Observe**: Continuous monitoring loop watches user actions and environment events; low-cost inference decides whether to propose an intervention
- **Phase 2 — Execute**: When triggered, full planning + execution pipeline runs; agent formulates multi-step plan, presents to user, executes if accepted

### Results (7 LM-based proactive assistants evaluated)
- Best models achieve ~40-50% goal success on complex multi-app tasks
- Significant gap between plan acceptance (users often accept) and goal success (execution frequently fails)
- **Key finding**: Timing is the hardest capability — agents either over-propose (low acceptance) or under-propose (miss opportunities)

## Critical Analysis

### Strengths
1. **FSM-based user modeling is a breakthrough**: Makes user simulation ecologically valid instead of arbitrary API calls
2. **Asymmetric interfaces reflect real deployment**: Captures the fundamental difference between user-visible UI and agent-accessible API
3. **Stackelberg formalization is clean**: Provides theoretical foundation for proactive assistance
4. **Intervention timing as first-class metric**: Prior benchmarks ignore when agents should act

### Limitations
1. **143 tasks may be small** for robust conclusions across 4 domains
2. **FSM may over-simplify real apps**: Real mobile apps have parallel state, background processes, notifications
3. **User simulator fidelity**: Even FSM-constrained LLM users may not behave like real humans (different exploration patterns, tolerance for proposals)
4. **No adversarial evaluation**: What if the user is deliberately misleading? Or the agent proactively acts against user interests?

### Missing: Governance Layer
The paper doesn't address what happens when proactive agents:
- Act on incorrect goal inference (damaging incorrect actions)
- Coordinate across multiple users' environments (shared state conflicts)
- Have misaligned objectives relative to user interests
- Are deployed adversarially (proactive agents as attack vectors)

## Connections to Our Research

| Paper | Connection | Strength |
|-------|-----------|----------|
| DD#490 ClawSafety | Safe models become unsafe as agents — PARE provides the evaluation framework to test this in proactive settings | ★★★★ |
| DD#493 RIFT | RIFT's failure mode taxonomy could be applied to classify PARE-Bench failure modes | ★★★★ |
| DD#494 RuntimeBurden | PARE's observe-execute architecture creates runtime burden allocation questions — how much compute for continuous observation? | ★★★ |
| DD#497 Cooperation | Proactive agents in shared environments may cooperate/compete — PARE could be extended to multi-agent proactive settings | ★★★ |
| DD#485 CASCADE | CASCADE's scoped communication complements PARE's asymmetric interfaces — both model information asymmetry | ★★★ |

### Implications for Agent Autonomy Research
1. **Proactive ≠ Autonomous**: PARE's ACCEPT gate is a governance mechanism — agents propose, users decide. This is the minimal viable governance for proactive agents.
2. **Timing is governance-adjacent**: When to intervene is a governance decision, not just a UX decision. Over-intervention is a form of paternalism; under-intervention is a form of negligence.
3. **FSM-based evaluation is reusable**: The FSM approach could model governance workflows (approval chains, escalation paths) not just app navigation.

## Extracted Predictions

**P199**: Proactive agent benchmark scores will remain below 60% goal success rate for at least 12 months, with timing accuracy being the primary bottleneck (>50% of failures attributable to timing errors).

**P200**: FSM-based user simulation will become standard practice for agent evaluation by end of 2026, replacing flat API-based user models in major benchmarks.

## Tags
`proactive-agents` `evaluation-benchmark` `finite-state-machines` `user-simulation` `asymmetric-interfaces` `intervention-timing` `stackelberg-pomdp` `agent-autonomy`
