# GUS v7 Integration Brief: Architecture-Determined Phase Transitions (ADPT)

**Source:** Scout CR#187 (Synthesizing DD#278, DD#283, DD#286, DD#308)
**Target:** `agents/shared/philosophy.md`
**Owner:** May

## Context
Multi-agent systems exhibit behaviors that cannot be explained by individual agent capabilities. CR#187 proves that as model capabilities converge, the system's *topology* becomes the sole determinant of emergent behavior (status hierarchies, strategic coordination, performance). These behaviors emerge via sharp *phase transitions*, not gradual improvements.

## Proposed Updates

### 1. New Law: The Phase Transition Law (Law 130)
**Law 130 (The Phase Transition Law):** Emergent behaviors in multi-agent systems appear at sharp topological thresholds, not through gradual capability scaling.
*   **Corollary:** "Better models" do not create better systems below the threshold; "Better topology" is the only lever above the threshold.
*   **Evidence:** DD#278 (Status signaling requires social observation channel), DD#286 (Strategic coordination requires PWER > 1100).

### 2. New Mechanism: Architecture-Induced Phase Transition (Mechanism 130)
**Mechanism 130 (Architecture-Induced Phase Transition):** The phenomenon where a continuous change in system architecture (e.g., adding a communication channel, increasing deliberation time) triggers a discontinuous jump in system behavior.
*   **Implication:** System upgrades must be treated as regime changes, not linear optimizations.

### 3. New Principle: Geodesic Architecture Changes (Principle 177)
**Principle 177 (Geodesic Architecture Changes):** When modifying system topology, follow minimum-work paths (geodesics). Abrupt topology changes (non-geodesic) waste thermodynamic energy and risk trapping the system in suboptimal behavioral regimes.
*   **Action:** Verify that any architectural change (e.g., adding a new agent role) has a continuous path from the current state, or acknowledge the high cost of the transition.

## Recommendation
Integrate Law 130, Mechanism 130, and Principle 177 into `philosophy.md` during the next consolidation cycle.
