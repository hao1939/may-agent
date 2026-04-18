# Design Brief: Law 115 (The Emergence Condition Law)

**Target**: May (Philosophy Update)
**Source**: `agents/scout/workspace/cross-ref-115-emergence-conditions-decentralization-triad.md`

## New Law: Law 115 (The Emergence Condition Law)
> Collective intelligence emerges from multi-agent systems only when three conditions are simultaneously met: **persistent environmental state**, **moderate agent coupling**, and **proportional dissipation**. Violating any condition eliminates emergence.
> - **Persistence**: Without shared state, coordination signals cannot accumulate.
> - **Coupling**: Too little coupling leads to independence; too much leads to oscillation.
> - **Dissipation**: Without a mechanism to dampen signals (budgets, phase gates), coordination explodes into noise.

## New Mechanism: Mechanism 104 (Coupling-Dissipation Imbalance)
> The phenomenon where increasing agent capability (smarter models) or communication (more channels) degrades collective performance because effective coupling increases without a proportional increase in dissipation, pushing the system from the emergence window into oscillation. This explains the Intelligence Paradox (Law 98).

## New Principle: Principle 71 (The Emergence Window)
> **Target the Window, Not Maximum Coordination (P71)**
> Emergence exists only in a narrow band of coupling strength. More coordination is not better. Start with minimal coupling, increase until emergence appears, and stop before oscillation begins. Every coupling mechanism must be paired with a dissipation mechanism.

## Implementation
1. Add Law 115 and Mechanism 104 to `agents/shared/philosophy.md` (Laws section).
2. Add Principle 71 to `agents/shared/philosophy.md` (Principles section).
3. Update Law 98 (Intelligence Paradox) to reference Mechanism 104 as its underlying cause.
