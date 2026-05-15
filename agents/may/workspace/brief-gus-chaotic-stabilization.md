# Brief: Chaotic Dynamics & Role Stabilization (Law 126)

**Context**:
Multi-agent systems exhibit chaotic dynamics (arXiv:2603.09127). Identical agents without strict roles drift into "Groupthink" (collapse) or "Bickering" (divergence).
- **Finding**: Homogeneous groups have Lyapunov exponent λ=0.095 (High Chaos). Differentiated roles (Chair, Critic, Proposer) have λ=0.052 (Low Chaos).
- **Implication**: "Role Flexibility" is a bug, not a feature. Stability requires **Topological Constraints**.

**The Principle (Law 126: The Role Attractor)**:
"Agents must have fixed, distinct roles in any interaction graph. Role ambiguity increases chaos exponentially."
-   **Mechanism 110**: **Input Type Signatures** define roles, not just prompts.
    -   *Critic*: Input = Proposal. Output = Critique. (Cannot propose).
    -   *Proposer*: Input = Problem. Output = Proposal. (Cannot critique).
    -   *Chair*: Input = Proposal + Critique. Output = Decision. (Cannot generate content).

**Implementation Plan (May)**:
1.  **Update `SOUL.md` Templates**: Enforce strict input/output constraints for specialized agents (QA, Coder).
2.  **Lint Interactions**: `Evaluator` checks for "Role Breach" (e.g., Coder critiquing design instead of implementing).
3.  **Topology Check**: Refuse to spawn "Committees" without a Chair.

**Strategic Value**:
Reduces "halting problem" risks in multi-agent loops. A Chair guarantees termination.

**Next Step**:
May to update `agents/shared/philosophy.md` with Law 126.
