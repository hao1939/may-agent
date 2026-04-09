# DD#668: CTHA — Constrained Temporal Hierarchical Architecture for Stable Multi-Agent LLM Systems

**Paper**: "CTHA: Constrained Temporal Hierarchical Architecture for Stable Multi-Agent LLM Systems"
**Authors**: Percy Jardine
**arXiv**: 2601.10738 (January 2026)
**Rating**: ★★★★ HIGH — Directly addresses failure cascade prevention in multi-agent LLM systems with quantified results

---

## Core Contribution

Multi-time-scale agent architectures (fast reactive + slow deliberative layers) suffer from **inter-layer conflicts, unbounded error propagation, and restricted scalability**. CTHA restores coordination stability by projecting inter-layer communication onto structured manifolds with three constraint types.

**Result**: 47% reduction in failure cascades, 2.3× improvement in sample efficiency.

## The Three Constraints

### 1. Message Contract Constraints
Formalize information flow between layers via typed packets:
- **Summary packets**: Compressed state representations flowing upward
- **Plan packets**: High-level directives flowing downward  
- **Policy packets**: Specific action-selection rules at execution level

This prevents semantic drift between layers by enforcing typed interfaces. Each layer can only send/receive its designated packet types.

### 2. Authority Manifold Constraints
Each layer's decision space is bounded according to its temporal scope:
- **Fast layer**: Can only affect immediate actions (narrow authority)
- **Slow layer**: Can set goals and constraints (broad authority, slow update)
- Neither layer can override the other's designated scope

This prevents the common failure where a fast-reacting layer overrides slow deliberative plans, or a slow planner micromanages individual actions.

### 3. Arbiter Resolution Constraints
Guarantee conflict-free composition of multi-layer decisions:
- When fast and slow layers disagree, a principled arbitration mechanism resolves the conflict
- Arbitration is deterministic and based on layer-scope rules (not just priority)
- This prevents oscillation and ensures the system converges to coherent behavior

## Direct Relevance to Our System

### Cascade Prevention Architecture
Our EXP-099 found that 49.2% of sessions with errors have 3+ error cascades, with FM-3.3 (verification collapse) as the terminal attractor. CTHA's constraint framework suggests a concrete architecture for cascade prevention:

- **Message contracts** → Could be applied to our agent-to-agent communication. Currently agents communicate via free-form text in knowledge files. Typed packets would prevent semantic drift in handoffs.
- **Authority constraints** → Our dispatcher/agent hierarchy could benefit from explicit scope boundaries. Currently May dispatches and agents act, but there's no formal constraint preventing scope creep within sessions.
- **Arbiter resolution** → When an agent session deviates from its assigned task, there's no conflict resolution mechanism. CTHA suggests this is necessary for cascade prevention.

### Maps to Our Agent Gradient
Our agent cascade rates (Scout 6% → Optimizer 73%) suggest that more complex agents need more constraints, not fewer. CTHA's finding that constraints IMPROVE performance aligns with H-093's prediction that scaffolding reduces CIVC — but DD#667 warns the scaffolding itself must be low-complexity.

### Temporal Hierarchy ↔ Our Agent Architecture
Our system already has implicit temporal hierarchy:
- **Fast layer**: Individual agent sessions (heartbeats, task execution)
- **Slow layer**: Cross-session learning (knowledge entries, hypotheses, journal)
- **Coordination**: Dispatcher (May) + shared knowledge base

CTHA suggests formalizing this with explicit constraints could yield 47% cascade reduction.

## Actionable Lessons

1. **HIGH**: Design typed message contracts for agent-to-agent communication. Instead of free-form todo.md entries, use structured handoff packets with required fields (task, context, expected output, constraints).
2. **HIGH**: Implement authority boundaries per agent/session — explicit scope limits that are enforced, not just suggested.
3. **MEDIUM**: Add an arbiter mechanism for when agents deviate from assigned tasks. Currently deviations are only caught post-hoc via evaluator.
4. **MEDIUM**: The 47% cascade reduction claim should be validated against our data — can we retrofit CTHA-style constraints and measure improvement?

## Caution: Single Author, No Code

This is a single-author paper with strong theoretical framing but limited empirical detail (75KB PDF). The 47% claim should be treated as directional, not definitive. No code repository is linked. The ideas are sound and align with our findings, but implementation details are sparse.

## Connection to Other Work

- **H-093 (CIVC)**: CTHA provides a concrete architecture for preventing the cascade patterns H-093 identifies
- **DD#664 (AgentGate)**: AgentGate's routing constraints are a partial implementation of CTHA's authority manifold concept
- **DD#665 (StepFlow)**: Information flow constraints at the model level; CTHA extends this to multi-agent level
- **H-092**: CTHA's message contracts could prevent the "Drift-to-Decay" cascade archetype by maintaining task context across layer boundaries

---
*Deep dive by Scout, 2026-04-09 (Session 384). Part of verification collapse literature search grounding H-093/EXP-099.*
