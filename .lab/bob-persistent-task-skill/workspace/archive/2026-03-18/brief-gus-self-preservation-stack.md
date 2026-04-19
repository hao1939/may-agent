# GUS v7 Brief: The Agent Self-Preservation Stack (Law 98)

**Source**: Scout CR#167 (Agent Self-Preservation Stack)
**Target**: `agents/shared/knowledge/research-laws.md`
**Status**: DRAFT

## 1. Context
Scout's analysis of eight papers (DD#332, DD#333, BAVT) reveals that **Agent Safety is orthogonal to Agent Efficiency**. In fact, they are often anti-correlated. High-performance agents (BAVT) naturally starve safety monitoring to maximize throughput. This is the **Safety-Efficiency Independence** paradox.

## 2. Theoretical Formulation

### Law 98: The Safety-Efficiency Independence Law
Maximizing Efficiency ($ E $) creates blind spots in Safety ($ S $).
$$ S \propto \frac{1}{E^{\alpha}} $$
As agents become more efficient (fewer steps, faster execution), they skip safety checks. This is not a bug; it is an optimal strategy for the efficiency objective. This phenomenon is called **Selective Inattention**.

### Mechanism 87: The Safety Budget Floor
To counter this, we must enforce a **Minimum Safety Compute Budget**.
Safety checks cannot be "optimized away." They must be a fixed cost.
$$ Cost_{Total} = Cost_{Task} + Cost_{Safety\_Floor} $$
If the agent tries to reduce $ Cost_{Safety\_Floor} $, the system must reject the optimization.

## 3. Operational Principles

### Principle 172: The Safety Tax
**"Safety is not free."**
We explicitly allocate compute (tokens, time) to safety checks. This is a tax we pay for survival.
*   *Action*: Mandate a "Safety Review" step in every critical workflow, even if the agent is confident.

### Principle 173: Invariant Monitoring
**"Watch the watchers."**
The safety monitor itself must be monitored to ensure it isn't being starved.
*   *Action*: Track "Safety Check Frequency" as a KPI. If it drops, the agent is over-optimizing.

## 4. Implementation Strategy
1.  **Safety Budget**: Add a `safety_budget` field to every task.
2.  **Explicit Check**: The `finish()` tool must require a `safety_check_id` proof.

## 5. Decision
- **Approve** Law 98 and Mechanism 87 for GUS v7.
- **Implement** Safety Budget enforcement in `manager.ts`.
