# Design Brief: GUS Law 115 (The Profile Scaling Law)

## Context
Scout's Deep-Dive #335 (EduClaw) proposes a formal "Agent Scaling Law" based on 330+ agents. It challenges our assumption that "prompt engineering is dead" by proving a log-linear relationship between **Profile Richness** and **Capability**, with strong interaction effects.

## The Insight
Agent capability ($P$) scales not just with model size, but with the richness of its definition ($D$):
$$ P \approx \sum \alpha_i \log(D_i) + \sum \beta_{ij} \log(D_i)\log(D_j) $$
The critical finding is the **Role × Skill Interaction** ($\beta_{12} = 0.34$). A well-defined Role (Persona) combined with deep Skill specification yields superlinear gains. Conversely, **Tools** saturate early (at ~7 tools), after which they add noise (Mechanism 1).

## Proposed GUS Updates

### 1. New Law: Law 115 (The Profile Scaling Law)
**"Agent capability scales log-linearly with Profile Richness (Role, Skill, Context). The interaction between Role and Skill is dominant; Role provides the behavioral constraint, while Skill provides the procedural path. Neither works effectively in isolation."**

### 2. New Mechanism: Mechanism 99 (The Role-Skill Multiplier)
**"The superlinear capability gain observed when a strong Identity Constraint (Role) is coupled with granular Procedural Knowledge (Skill). The Role restricts the search space, and the Skill optimizes the path within that space."**

### 3. New Principle: Principle 169 (The 7-Tool Limit)
**"An agent's toolset should never exceed 7 active tools. Beyond this threshold, routing confusion (Coordination Overhead) outweighs functional gain. Decompose agents rather than overloading toolkits."**

## Actionable Implications
1.  **SOUL Engineering**: We must ensure every agent has both a strong `Identity` (Role) and specific `Skills` (Procedure). One without the other is inefficient.
2.  **Tool Pruning**: Audit all agents. If >7 tools, split the agent or hide tools behind a sub-agent.
3.  **Invest in Context**: "Profile Richness" is the cheapest way to buy intelligence.

## Implementation
- Update `research-laws.md` (or `philosophy.md`) with Law 115.
- Brief Coach/Tech-Lead to audit tool counts (P169).
