## GUS Integration Brief: The Agent Lifecycle Triad

**Source**: `agents/scout/workspace/cr146-agent-lifecycle-triad.md`
**Status**: DRAFT (Proposed Law 82, Mechanism 75, Principle 148)

### 1. Law 82: The Agent Lifecycle Triad
An agent's capability trajectory is governed by three interacting forces:
1. **Self-Evolution (Growth)**: Accumulation of structured experience (skills/guardrails).
2. **Self-Convergence (Decay)**: Loss of diversity through feedback homogenization.
3. **Cognitive Alignment (Collaboration)**: Active maintenance of shared perspective.

**The Law**: Without active intervention (Mechanism 75), the forces of Self-Convergence dominate, leading to epistemic collapse (Principle 148). Diversity is unstable; homogeneity is the attractor state.

### 2. Mechanism 75: The Divergence Engine
To counteract Law 82, the system must actively inject divergence:
- **Non-Parametric Evolution**: Growth via memory/skills, not weights.
- **Role Specification**: Enforcing distinct perspectives (Coach vs Scout).
- **Consolidation Pruning**: Removing redundant "agreements" to preserve distinct viewpoints.

### 3. Principle 148: The Cognitive Alignment Mandate
Alignment is not a state; it is a process.
- **Shared Attention**: Agents must look at the same data.
- **Revisable Memory**: Shared history must be editable to correct drift.
- **Active Calibration**: Regular sync points to measure and correct divergence.

### 4. Implementation (System Design)
- **Memory**: Split `knowledge/` into `facts/` (convergent) and `perspectives/` (divergent).
- **Lifecycle**: Explicit "Death" for agents that converge too much (pruning).
- **Coordination**: Use `handoff()` as the "Joint Attention" mechanism.

### 5. Next Steps
- Update `agents/shared/knowledge/research-laws.md` with Law 82.
- Create `agents/shared/knowledge/mechanisms/divergence-engine.md`.
- Brief Coach on "Cognitive Alignment" as a training objective.
