# H-081: Runtime Role Clarity Monitoring Prevents Multi-Agent Coordination Failure

**Status:** ARCHIVED — Resolved (monitoring proposal, no controlled experiments)
**Created:** 2026-04-06  
**Source:** arXiv:2604.02770 (Role Clarity for Multi-Agent)  
**Related:** [HB-0285](../library/posts/HB-0285-role-clarity-multiagent.md), SYNTHESIS-002

---

## Hypothesis

In a multi-agent system, **runtime measurement of role clarity scores** enables early detection of agent persona drift, allowing intervention before coordination breakdown occurs. By computing the semantic similarity between agent behavior trajectories and their role descriptions, we can quantify alignment and trigger re-personaification when scores drop below threshold.

---

## Core Mechanism

From the paper's quantitative role clarity approach:

```
Role Assignment Matrix S(φ):
  s_ij(φ) = semantic_similarity(agent_i_trajectory, agent_j_role_description)

Role Clarity Matrix M(φ):
  M(φ) = softmax(S(φ)) - I

Role Clarity Score = ||M(φ)||_F (Frobenius norm)
```

Lower score = better alignment. Higher score indicates role confusion (agents behaving like other agents).

---

## Evidence from Literature

| Study | Finding | Relevance |
|-------|---------|-----------|
| arXiv:2604.02770 | Role overstepping 46.4%→8.4% (Qwen) with clarity regularization | Role drift is measurable and reducible |
| arXiv:2604.01020 (OrgAgent) | Hierarchical MAS +102% accuracy, -74% tokens | Structure improves alignment |
| SYNTHESIS-002 | Emergent roles > assigned roles above capability threshold | But only if we can measure alignment |

---

## Application to Our System

### Current State
Our multi-agent system assigns personas (e.g., Scout, Tech-Lead, Amy-Kimi) but has no runtime verification that agents are actually adhering to their roles.

### Proposed Implementation

1. **Trajectory Logging**: Record each agent's output/actions per session
2. **Semantic Comparison**: Compute embedding similarity between:
   - Agent's recent trajectory (last N outputs)
   - Canonical role description
3. **Clarity Scoring**: Track per-agent clarity scores over time
4. **Intervention Trigger**: When clarity score drops below threshold:
   - Inject role reminder into context
   - Alert orchestrator for potential re-delegation
   - Log for post-hoc analysis

### Monitoring Dashboard
```
Agent      | Clarity Score | Trend | Status
-----------|---------------|-------|--------
scout      | 0.91          | ↑     | ✅ aligned
tech-lead  | 0.73          | ↓     | ⚠️ drifting
amy-kimi   | 0.88          | →     | ✅ aligned
```

---

## Testable Predictions

1. **P1**: Agents with clarity scores <0.7 will show higher task failure rates
2. **P2**: Injecting role reminders when scores drop improves subsequent performance
3. **P3**: Clarity scores correlate with semantic distance between agent outputs (drifting agents sound more like each other)

---

## Open Questions

1. How to define "canonical role description" for our agents?
2. Should clarity be computed per-task-type or globally?
3. How does hierarchical delegation affect clarity measurement?

---

## Related Hypotheses

- H-071: Hierarchical Agent Organization
- SYNTHESIS-002: Multi-Agent Coordination
