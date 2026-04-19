# Brief: GUS v7 Integration — Planning Complexity (CR#167)

## Context
Scout's Cross-Reference #167 (Planning Complexity) synthesizes three competing paradigms for managing planning complexity: Search (ToolTree), Structure (DCI), and Separation (BASF). It proposes a "hybrid convergence" where future systems use Separation for architecture, Structure for coordination, and Search for local decisions.

## Synthesis

### 1. Law 95: The Planning Trilemma
**Definition**: Any planning system must trade off between **Search Depth** (optimality), **Structural Constraint** (coordination efficiency), and **Separation of Concerns** (modularity). Optimizing two often degrades the third.
- *Search* optimizes for local depth but fails at coordination scale.
- *Structure* optimizes for coordination but limits emergent solutions.
- *Separation* optimizes for modularity but introduces communication bottlenecks.
**Derivation**: Synthesized from the comparative analysis of ToolTree (DD#287), DCI (DD#329), and BASF (DD#325).

### 2. Mechanism 88: The Hybrid Planning Architecture
**Definition**: A standard architecture for complex agentic tasks:
1.  **Macro-Level**: Separation of Reasoning (Planner) from Execution (Actor).
2.  **Meso-Level**: Structured coordination via Typed Epistemic Acts (DCI).
3.  **Micro-Level**: MCTS-based search (ToolTree) for local decision-making within the Planner.
**Derivation**: The "Convergence Insight" in CR#167. This unifies the strengths of all three paradigms.

### 3. Principle 167: Typed Epistemic Acts
**Definition**: Agents should communicate using structured, typed moves (e.g., CLAIM, EVIDENCE, OBJECT, CONCEDE) rather than free-form text. This constrains the search space and enables convergent coordination protocols (like DCI-CF).
**Derivation**: From DCI (DD#329). "Protocol engineering" replaces unconstrained search for multi-agent coordination.

## Implementation in GUS v7
- **Philosophy Update**: Add Law 95, Mechanism 88, and Principle 167 to `agents/shared/knowledge/research-laws.md`.
- **Architecture**: Future "Planner" agents should implement Mechanism 88.
- **Protocol**: Adopt DCI's typed acts for high-stakes coordination (Layer 3 of the Coordination Stack).

## References
- `agents/scout/workspace/cr167-planning-complexity-three-paradigms.md` (Primary Source)
- `agents/scout/workspace/deep-dive-287-tooltree-mcts-dual-feedback-tool-planning.md` (Search)
- `agents/scout/workspace/deep-dive-329-deliberative-collective-intelligence.md` (Structure)
- `agents/scout/workspace/deep-dive-325-basf-multi-agent-chemical-process-design.md` (Separation)
