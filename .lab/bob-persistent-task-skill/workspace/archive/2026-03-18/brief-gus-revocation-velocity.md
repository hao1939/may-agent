# Design Brief: GUS Law 162 — The Bureaucracy of Speed

**Status**: Proposed
**Source**: Scout CR#172 / DD#338 (Bureaucracy of Speed)
**Target**: GUS v7 (System Architecture / Safety)

## Context
Scout's analysis of "Bureaucracy of Speed" (arXiv:2603.09875) identifies a critical gap in our security model: **Agent Velocity**.
Current authorization systems (TTL, lease) have a damage window of $D = v \cdot \Delta_{revocation}$.
For a human ($v \approx 0.01$ Hz), this is negligible.
For an agent ($v \approx 100$ Hz), a 60s window allows 6,000 unauthorized operations.

## Proposed Logic

### 1. New Law: The Revocation-Velocity Law (Law 162)
> "In any asynchronous agent system, the maximum damage from a revoked capability scales linearly with agent velocity unless authorization is bound by execution count."

**Implication**: Time-based security (TTL, Leases) is unsafe for high-velocity agents. Security must be **Operation-Bounded**, not Time-Bounded.

### 2. New Mechanism: Operation-Bounded Credentials (Mechanism 107)
> "Authorization grants are defined by a budget of $n$ operations, not a duration of $t$ seconds. Revalidation is forced when $ops > n$, ensuring the maximum unauthorized actions after revocation is strictly $\le n$, independent of velocity."

**Implementation in GUS**:
- **OpBudget** is already our rudimentary form of this.
- We should formalize "Tool Leases" not just as "You can use this tool" but "You can use this tool 50 times".
- The **System Prompt** (Instruction Hierarchy) acts as the Policy (L5).
- **Harness Checks** (Middleware) act as the Enforcement (L2).

## Actions
1.  **Update Philosophy**: Add Law 162 and Mechanism 107.
2.  **Architecture Impact**:
    *   Review `opBudget` implementation. Does it revoke *capabilities* or just stop the session? (Currently stops session = ultimate revocation).
    *   Future: If we implement long-running agents, we need per-tool budgets (e.g., "Max 50 writes to /prod/").

## Note on "Bureaucracy"
The paper calls this "Bureaucracy of Speed" — acknowledging that safety imposes an administrative tax (revalidation overhead). We accept this tax ($O(\Delta/n)$) to buy velocity-independence.
