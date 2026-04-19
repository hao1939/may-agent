# Brief: Law 74 (The Chaotic Stabilization)

**Distilled from**: arXiv:2603.09127 (Chaotic Dynamics in Multi-LLM Systems)
**Type**: New Law, Principle, and Mechanism for `philosophy.md`
**Status**: Proposal

## Context
Research proves that multi-agent systems at Temperature=0 are **not deterministic** but exhibit chaotic dynamics (positive Lyapunov exponents). Two independent routes drive this instability: **Role Differentiation** (Route A) and **Model Heterogeneity** (Route B). Crucially, these routes interact non-additively: adding roles to a heterogeneous system *stabilizes* it (Mixed+Roles < Mixed+NoRoles). The "Chair" (Synthesis) role is the dominant amplifier of chaos.

## 1. The Law
**Law 74 (The Chaotic Stabilization)**
Multi-agent systems are chaotic dynamical systems ($λ > 0$) even at zero temperature. Stability is not the absence of divergence, but the result of **Role-Heterogeneity Complementarity**: structured roles stabilize heterogeneous models, while unstructured heterogeneity maximizes chaos.

## 2. The Principle
**Principle 142 (The Synthesis Amplifier)**
The agent that synthesizes state (The Chair/Manager) is the dominant amplifier of system-wide chaos. To stabilize a system, constrain the synthesis agent's context window and degrees of freedom; to explore, relax them.

## 3. The Mechanism
**Mechanism 81 (The Lyapunov Filter)**
A mechanism that measures the empirical Lyapunov exponent ($λ$) of an agent squad by running $N$ parallel identical trajectories. If $λ > λ_{critical}$, the system automatically injects **Role Constraints** (tightening instructions) or **Context Pruning** (shortening memory) to dampen divergence.

## Practical Application
1. **May as Chair**: Recognize May as the primary source of variance. Her "synthesis" of state drives the system's trajectory.
2. **Role Defense**: When using mixed models (Gemini + Claude + GPT), **enforce strict roles**. Loose instructions + mixed models = maximum chaos.
3. **Memory Damping**: For long-running threads, use **Context Pruning** (summarization) to break the feedback loop that amplifies chaos.

## Implementation Plan
1. **Update Philosophy**: Add Law 74, Principle 142, Mechanism 81 to `agents/shared/knowledge/research-laws.md` (per system tidiness).
2. **Design Review**: This validates our "Strict Roles" approach in `SOUL.md` but warns against "loose collaboration" with mixed models.
3. **Future Work**: Build `measure_lyapunov` skill for Evaluator to empirically test squad stability.
