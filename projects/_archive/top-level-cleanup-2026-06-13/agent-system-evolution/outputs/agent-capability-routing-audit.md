# Agent Capability Routing Audit

**Date:** 2026-05-27  
**Task:** agent-capability-routing-experiment  
**Method:** Audited 10 recent task dispatches from session DB for agent-task fit

## Agent Capability Map (Observed)

| Agent | Capabilities | Task Types Observed |
|-------|-------------|-------------------|
| may | General project work, analysis, auditing, convention drafting, code investigation, documentation | Project tasks, owner loops, cron steward |
| evaluator | Quality judgment, session review, metric alert triage | Aftermath reviews, alert triage |
| scout | External discovery, arXiv/HN exploration | Explore workflows |

## 10 Audited Dispatches

| # | Agent | Task | Type | Fit? |
|---|-------|------|------|------|
| 1 | may | agent-self-correction-patterns | Analysis/audit | ✓ |
| 2 | may | contract-behavior-impact-measurement | Measurement/analysis | ✓ |
| 3 | may | platform-request-tracker | Tracking/documentation | ✓ |
| 4 | may | self-correction-convention | Convention drafting | ✓ |
| 5 | may | platform-request-reescalation | Escalation/communication | ✓ |
| 6 | may | dispatch-path-delegation-fix | Code investigation/impl | ✓ |
| 7 | may | dispatch-fix-validation | Verification | ✓ |
| 8 | evaluator | session aftermath review | Quality judgment | ✓ |
| 9 | evaluator | metric-alert-triage (stale sessions) | Alert judgment | ✓ |
| 10 | scout | arXiv exploration | External discovery | ✓ |

## Findings

**Misrouting rate: 0/10 = 0%**

No misrouting detected. The system has a simple routing structure:
- All project tasks → may (the only general-purpose project worker)
- All evaluation/review → evaluator
- All discovery → scout

### Why Misrouting Is Low

1. **Single general worker:** There is effectively one agent (may) that handles all project work. No routing decision is needed because there are no alternative agents to route to.
2. **Specialized agents have narrow scopes:** Evaluator and scout only receive tasks matching their dedicated workflows.
3. **No code-specialist agent exists:** Task #6 (dispatch-path-delegation-fix) was a code investigation task. It succeeded when routed to may, but in a multi-agent system with a dedicated code agent, this might be better routed elsewhere.

### Structural Observation

The current system does not have a routing *problem* because it does not have routing *decisions*. The dispatch is deterministic:
- Project task → project assignee (always may)
- Aftermath → evaluator
- Explore → scout

A capability-routing heuristic would only become necessary if:
- A second general-purpose agent is added
- Tasks begin failing because an agent lacks a specific capability
- The system grows beyond 3 agents with overlapping scopes

## Conclusion

**Misrouting is 0%, well below the 20% threshold.** No capability-routing heuristic is needed at this time. The current deterministic dispatch (one agent per role) is correct for the system's current scale. Revisit if agent count increases or task failures correlate with capability gaps.
