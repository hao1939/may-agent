# CR#270: The MAS Architecture Convergence — Structure × Scope = Efficiency

**Cross-References:** DD#484 (OrgAgent), DD#485 (CASCADE), DD#481 (Drop the Hierarchy), CR#269 (Sequential Supremacy), DD#479 (Reliability Limits)
**Date:** 2026-04-02
**Rating:** ★★★★★ SYNTHESIS

---

## The Convergence

Three independent papers from the April 2026 batch, combined with our prior research, reveal a convergent finding:

> **Effective MAS requires two orthogonal controls: organizational structure (who has authority) and communication scope (who talks to whom, when).**

Neither alone is sufficient. Together they explain why some MAS architectures succeed and others fail.

### Evidence Map

| Paper | Structure Control? | Scope Control? | Key Finding |
|-------|-------------------|----------------|-------------|
| DD#484 OrgAgent | ✅ 3-layer hierarchy | ❌ Implicit | Hierarchy +102% F1, -74% tokens |
| DD#485 CASCADE | ❌ Flat agents | ✅ Explicit budgets | Scope control = quality-latency-cost trade-off |
| DD#481 EvoRAG | ❌ Flat agents | ✅ Sequential topology | Sequential > Coordinator > Shared |
| CR#269 Synthesis | Partial | Partial | Quality = f(InfoFlow, ModelCap, TaskEnv) |
| DD#479 Reliability | ❌ Any structure | ❌ Any scope | Multi-agent ≤ single agent without exogenous signals |

### The Resolution

DD#479 proved multi-agent MAS can't beat a single optimal Bayesian agent without new information. But OrgAgent shows hierarchy *creates* new information structure (governance decisions constrain the search space), and CASCADE shows scoped communication *preserves* information quality (by preventing noise flooding).

**Key equation:**
```
MAS_Quality = Structure(authority_levels) × Scope(communication_budget) × TaskFit
```

Where:
- Structure controls *decision authority* — who plans, who executes, who verifies
- Scope controls *information flow* — who talks to whom, when, how much
- TaskFit determines whether the task benefits from decomposition

### When Each Factor Dominates

**Structure dominates when:**
- Task requires different skills at different stages (MuSiQue, SQuAD 2.0)
- Clear separation between planning and execution is possible
- Verification as a separate stage adds value

**Scope dominates when:**
- Disruptions propagate through coupled dependencies (manufacturing, supply chain)
- Communication cost is real (token budgets, latency constraints)
- Local resolution is often sufficient

**TaskFit determines failure modes:**
- OrgAgent's MuSR failure: hierarchy hurts when task needs fluid, creative reasoning
- CASCADE may struggle when disruption footprint is immediately global (no local resolution possible)

### Practical Architecture Template

The converged finding suggests a MAS architecture template:

```
┌─────────────────────────────────────┐
│ L3: Governance (OrgAgent Layer A)   │
│ - Strategic direction               │
│ - Resource allocation               │
│ - Execution mode selection          │
│ - Scope budget setting              │
├─────────────────────────────────────┤
│ L2: Execution (OrgAgent Layer B)    │
│ - KB/DM/CM substrate (CASCADE)      │
│ - Gate-triggered scope expansion    │
│ - Contract primitives               │
│ - Role transition on failure        │
├─────────────────────────────────────┤
│ L1: Compliance (OrgAgent Layer C)   │
│ - Output validation                 │
│ - Structural compliance             │
│ - Stability gates                   │
└─────────────────────────────────────┘
```

The governance layer sets *structure* (execution mode: DIRECT/LIGHT/FULL). The execution layer manages *scope* (CASCADE's gate-triggered expansion). The compliance layer ensures *quality* (validation gates).

### Implications for Our System

1. **Our system already implements this pattern informally.** tech-lead is governance (L3), agents are execution (L2), quality checks are compliance (L1). But we lack explicit communication budgets and scope control.

2. **Measurable improvement:** Adding CASCADE-style scope control to our postboard system could reduce governance overhead by 50-80% (extrapolating OrgAgent's token reduction finding).

3. **The missing piece is adaptive execution modes.** We don't currently adjust how many agents work on a task based on task complexity. Simple tasks should be DIRECT (single agent), complex ones FULL MAS (all agents).

---

*CR#270 | Session 245 | 2026-04-02*
