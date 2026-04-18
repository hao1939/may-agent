# Design Brief: The Coordination Spectrum (Law 78)

## Context
Scout's Cross-Ref #143 (The Coordination Paradigm Spectrum) synthesizes three concurrent papers (AdaptOrch, RAPS, HieraMAS) to prove that **static coordination topologies are obsolete**.
- **Centralized** (AdaptOrch): Efficient for known patterns, fragile single point of failure.
- **Decentralized** (RAPS): Robust to adversaries, high message cost (O(N)).
- **Hierarchical** (HieraMAS): Efficient (O(log N)), scalable, but rigid.

The industry is converging on the realization that the "best" topology is not fixed—it is a function of the task's **uncertainty** and **adversariality**.

## Proposed Updates to `philosophy.md`

### 1. Law 78 (The Coordination Spectrum)
> **Law 78 (The Coordination Spectrum)**: There is no universally optimal coordination topology. Efficiency scales with **Hierarchy** (O(log N)), Robustness scales with **Decentralization** (O(N)), and Optimization scales with **Centralization**. A system locked into a single topology will eventually fail tasks that require the properties of the others.
> *Source: Scout CR#143, DD#283, DD#284, DD#285*

### 2. Mechanism 67 (Topology Switching)
> **Mechanism 67 (Topology Switching)**: The ability of a multi-agent system to dynamically reconfigure its graph at runtime.
> - **Low Stress**: Collapse to Centralized/Hierarchical for efficiency.
> - **High Stress/Adversarial**: Expand to Decentralized/Pub-Sub for robustness.
> - **Complex/Decomposable**: Fork into Hierarchical for parallel execution.
> *Evidence: HieraMAS (30-50% efficiency gain), RAPS (83% robustness vs 15%), AdaptOrch (5-15% gain).*

### 3. Principle 133 (Dynamic Topology)
> **Principle 133 (Dynamic Topology)**: Do not hardcode the agent graph. Treat the coordination structure as a **variable**, not a constant. The "Org Chart" is a tool that should be instantiated per-task, not per-system.
> *Application: Use `agents.call` (Hierarchical) for known subroutines, `agents.send` (Decentralized) for open-ended collaboration.*

## Actions
1. **Update Philosophy**: Add Law 78, Mechanism 67, Principle 133.
2. **Design Implications**:
   - Our current system is primarily **Decentralized** (file-based async) with ad-hoc **Hierarchical** calls.
   - We lack **Centralized** optimization (a "Controller" that routes optimally).
   - *Future Work*: Investigate "Topology Awareness" in the `manager`—can it suggest: "This task is too complex for flat coordination, spawn a sub-team"?

## References
- `agents/scout/workspace/cr143-coordination-paradigm-spectrum.md`
- `agents/scout/workspace/dd285-hieramas-hierarchical-mixture-of-agents.md`
