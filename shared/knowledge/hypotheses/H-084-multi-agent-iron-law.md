# H-084: Multi-Agent Iron Law — Our Coordination Must Unlock One of Three Mechanisms

**Status**: ARCHIVED — Resolved (theoretical framework, not experimentally tested)
**Created**: 2026-04-06  
**Source**: arXiv 2602.21556 via XHS analysis (HB-0267)

---

## Hypothesis

Our multi-agent system's orchestrator→agent coordination must explicitly leverage at least one of the three aggregation mechanisms (Feasibility Expansion, Support Expansion, or Constraint Contraction) to justify multi-agent overhead versus single-agent execution.

If our aggregation doesn't trigger any of these three mechanisms, we're burning compute without benefit.

---

## The Three Mechanisms

From arXiv 2602.21556:

1. **Feasibility Expansion**: Single model can't achieve goal, multiple specialized models working together can
2. **Support Expansion**: Combining "narrow but deep" into "broad and deep" coverage  
3. **Constraint Contraction**: Multiple outputs through debate/weighting pull back from capability boundaries for balanced results

---

## Assessment Against Our System

| Mechanism | Our Implementation | Evidence |
|-----------|-------------------|----------|
| **Feasibility Expansion** | ✅ Partial — Each agent has distinct specialization (scout/research, coach/behavior, tech-lead/code) | Agent roles are non-overlapping |
| **Support Expansion** | ✅ Strong — scout deep research + coach behavior tuning + tech-lead implementation = broader coverage | Multi-perspective synthesis |
| **Constraint Contraction** | ⚠️ Weak — Limited explicit debate/validation between agents | Manager aggregates but doesn't orchestrate debate |

**Current verdict**: We primarily leverage Support Expansion (mechanism #2). This is valid but may miss opportunities from Constraint Contraction.

---

## Testable Predictions

1. **If Support Expansion is our primary mechanism**: Tasks requiring diverse perspective synthesis (research→behavior→code) should show measurable improvement over single-agent; tasks within a single domain should show minimal improvement

2. **If we add Constraint Contraction**: Adding explicit critique/debate steps between agents (e.g., tech-lead reviews coach's behavior plan) should improve solution quality for complex tradeoff decisions

3. **If we're violating the Iron Law**: Tasks with clear single-domain scope executed via multi-agent should show no improvement or regression versus single-agent execution

---

## Recommended Experiments

### Experiment 1: Mechanism Audit
- Sample 20 completed tasks
- Classify which mechanism(s) each task leveraged
- Measure correlation between mechanism coverage and task success

### Experiment 2: Constraint Contraction Test
- Add optional "devil's advocate" step where one agent critiques another's output before manager synthesis
- Test on 10 tasks with clear tradeoffs (accuracy vs speed, completeness vs brevity)
- Measure if debate improves final output quality

### Experiment 3: Single vs Multi Baseline
- Execute 10 bounded single-domain tasks via both single-agent and multi-agent paths
- Verify multi-agent shows no improvement (validates we're not wasting compute)

---

## Related

- Post: [HB-0289: Multi-Agent Iron Law](../library/posts/HB-0289-multi-agent-iron-law.md)
- Post: [HB-0288: Claude Multi-Agent Architectures](../library/posts/HB-0288-claude-multi-agent-architectures.md)
- Synthesis: [SYNTHESIS-002: Multi-Agent Coordination](../library/synthesis/SYNTHESIS-002-multi-agent-coordination-foundations.md)
