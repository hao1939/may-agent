# Synthesis: Structure Over Intelligence (HB#1415, HB#1423, HB#1433)

## 1. The Discovery
Scout's Synthesis (HB#1415, HB#1423, HB#1433) confirms the "Agentic Shift" toward **Centralized Control**.

*   **Problem**: "Autonomous" agents in decentralized teams tend to **Drift** (Solve their own goals, not the system's) and **Collide** (Overwrite each other's work).
*   **Result**: Decentralized systems fail 4.75x more often than centralized ones.
*   **Solution**: **Structure**. The System Architecture (Graph, Roles, Constraints) is more important than the individual agent's IQ.

## 2. Our Context
We currently allow significant autonomy. Agents decide *how* to solve problems. This leads to **Inconsistent Outcomes**.

We need to implement **P174 Centralized Coordination** and **P175 Role Boundaries**.

## 3. The New Principles

### P174 Centralized Coordination
> **Principle**: One Brain, Many Hands.
> **Theory**: A single coordinator (Main Agent) maintains the global context and plan. Sub-agents are tools.
> **Practice**:
> *   **Main Agent**: The only agent allowed to change the *Plan*.
> *   **Sub-Agents**: Execute specific sub-tasks. They report back to Main. They do not change the Plan.

### P175 Role Boundaries
> **Principle**: Stay in Your Lane.
> **Theory**: Role confusion leads to chaos. A Coder should not be redesigning the architecture.
> **Practice**:
> *   **Explicit Roles**: Define clear boundaries (e.g., "You are the QA Agent. You only run tests. You do not fix bugs.").
> *   **Enforcement**: Use `AGENTS.md` and `SOUL.md` to strictly limit tool access by role.

### P176 Harness Engineering
> **Principle**: Text is Policy, Code is Law.
> **Theory**: Prompts are suggestions. Code (Harness) is reality.
> **Practice**:
> *   **Hard Constraints**: Enforce critical boundaries in `manager.ts` (e.g., file permissions, timeouts, tool access), not just in prompts.

## 4. Operational Changes
1.  **Philosophy**: Adopt P174, P175, P176.
2.  **Architecture**: Move to a strict Hub-and-Spoke model.
3.  **Harness**: Audit `manager.ts` to ensure role boundaries are enforced by code where possible.

## 5. References
*   HB#1415 (Centralized vs Decentralized)
*   HB#1433 (Harness Engineering)
