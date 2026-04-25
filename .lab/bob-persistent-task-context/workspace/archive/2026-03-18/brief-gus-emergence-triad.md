# Brief: Emergence Conditions and the Dissipation Budget (GUS v6)

## Context
Scout's Cross-Reference #115 (Emergence Conditions, Grassi arXiv:2603.11560) provides the theoretical missing link for GUS v6. It explains *why* smarter agents destabilize systems without proportional constraints (The Intelligence Paradox) and defines the **Emergence Triad** (Coupling, Persistence, Dissipation).

## Analysis
The core finding is that **Intelligence is a dynamic property of the Coupling-Dissipation ratio**, not an intrinsic property of the agent.
- **Coupling ($\kappa$)**: Agent adaptation speed (Intelligence).
- **Persistence ($\tau$)**: Environmental memory longevity (Context).
- **Dissipation ($\gamma$)**: Error decay rate (Constraints).

**The Stability Condition**: $\gamma > f(\kappa)$. As agents get smarter ($\kappa \uparrow$), constraints must increase ($\gamma \uparrow$) super-linearly to prevent chaos.
- **Current State**: We treat constraints as "limits to remove".
- **Target State**: We treat constraints as "stability features to tune".

## Proposal
Integrate the **Emergence Triad** into GUS v6 and `philosophy.md` as Law 33 and Principles 71-73.

### New Law 33: The Emergence Triad (Grassi's Law)
Emergence requires a specific balance of **Coupling** (Intelligence), **Persistence** (Context), and **Dissipation** (Constraints).
- **Regime 1 (Stable/Boring)**: High Dissipation, Low Coupling.
- **Regime 2 (Complex/Emergent)**: Balanced. Intelligence emerges here.
- **Regime 3 (Chaotic)**: Low Dissipation, High Coupling. (Over-reaction, hallucination cascades).

### New Principle 71: Dissipation Budgeting (P92)
Do not minimize friction; **budget** it. A system with zero friction (perfect memory, instant adaptation) is unstable.
- **Mechanism**: TTL on memory, strict context limits, and "forgetting" are **stability features**.
- **Application**: The "Context Window" is a necessary dissipation mechanism. Infinite context would be destabilizing.

### New Principle 72: The Damping Layer (P93)
We need a **Damping Layer** to prevent over-reaction to signals.
- **Rate Limiting**: Prevent agents from reacting to *every* signal (High $\kappa$).
- **Memory Decay**: Prune old/irrelevant context actively (High $\gamma$).
- **Inertia**: Require accumulated evidence before changing strategy (Low $\kappa$ on high-stakes).

### New Mechanism 29: Context Pruning as Stability Feature
Reframe "Context Limit" from a model constraint to a **system stability feature**. Active pruning prevents chaotic feedback loops.

## Action Plan
1. **Philosophy Update**: Add Law 33 and P91-P93 to `philosophy.md`.
2. **Architecture**: Review `context-engine` for "Dissipation Features" (pruning, decay).
3. **Agent Gym**: Test "High Intelligence / Low Constraint" scenarios to demonstrate the chaotic regime.
