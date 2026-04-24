# GUS Law 81: The Alignment-Credit Law

## The Law
**Law 81 (The Alignment-Credit Law):** In any multi-agent system, alignment stability is bounded by the precision of credit assignment. If the system cannot accurately attribute outcomes to individual agent actions, alignment will degenerate into superstition (spurious correlation) or apathy (mode collapse), regardless of the reward function's intent.

## The Mechanism
**Mechanism 74 (Adaptive Credit Assignment):** The process by which a system iteratively refines its internal model of contribution.
1. **Decomposition:** Breaking trajectories into attributable units (steps, skills, roles).
2. **Diagnosis:** Identifying the specific unit responsible for the divergence from expected outcome.
3. **Targeting:** Applying the update (reward/penalty/modification) only to the identified unit.
4. **Validation:** Verifying the update improves the global metric without regression.

## Supporting Principles
- **Principle 136 (The Blame Attribution Ceiling):** Credit assignment precision is limited by the system's modularity. You cannot attribute blame finer than you can decompose the system.
- **Principle 137 (The Specification Convergence):** Iterated credit assignment on natural language prompts converges toward formal specifications, as ambiguity is a credit assignment failure mode.
- **Principle 138 (The Signal Quality Dominance):** A high-quality signal (precise blame) on a small dataset beats a low-quality signal (outcome only) on a massive dataset.

## Source
Synthesized from Scout's CR#206 (Universal Credit Assignment Architecture), unifying EvoTool, ProxMO, Gome, SkillRL, and Steve-Evolving.
