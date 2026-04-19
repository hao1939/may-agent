# Heartbeat Audit — All 6 Agents

**Date**: 2026-04-19  
**Milestone**: Audit — review each agent's heartbeat.md, SOUL.md, and actual heartbeat behavior

## Summary

The heartbeat.md files are already **well-designed and role-specific** (not generic). Each agent has clear identity, metrics, decision trees, and dispatch instructions. The main issues are:
1. **Uneven cron scheduling** — some agents rarely get heartbeats
2. **No-op sessions** — agents sometimes exit without meaningful action
3. **Outcome quality varies** — some agents consistently dispatch work, others drift

---

## Per-Agent Audit

### Amy (The Explorer)
- **Heartbeat.md quality**: Good. Clear XHS exploration focus, metrics (3+ explorations/week), concrete output expectations.
- **SOUL.md quality**: Excellent. Strong identity boundaries, C17 fix for tool-call-first heartbeats.
- **Actual behavior**: Last active 2026-04-16 (3 days dormant). NOT on cron schedule. Only runs via manual/job dispatch. Avg 18 ops when active — does real work.
- **Gap**: Not scheduled for regular heartbeats. Cannot be proactive if never triggered.
- **Recommendation**: Add to cron. She has good heartbeat instructions but never gets woken up.

### Coach (The Experimenter)  
- **Heartbeat.md quality**: Excellent. Clear decision tree, workflow dispatch table, exit check.
- **SOUL.md quality**: Strong. Research focus on skill verification, honest about "text rules don't work" finding.
- **Actual behavior**: 107 cron heartbeats. Avg 15.4 ops. ~10% no-ops. Most active heartbeat agent. Consistently forks experiments, manages EXP-XXX lifecycle.
- **Gap**: Recent sessions show some infrastructure churn ("last-session.md keeps getting modified") rather than research work.
- **Recommendation**: Already well-functioning. Could benefit from less bookkeeping overhead.

### Tech-Lead (The Simplifier)
- **Heartbeat.md quality**: Good. System snapshot query, priority stack, dispatch workflows.
- **SOUL.md quality**: Excellent. Clear identity as counterbalance to Bob. Deletion-focused.
- **Actual behavior**: Only 2 cron heartbeats ever. Avg 3.5 ops. Recent sessions mostly manage persistent task status (marking projects done/blocked) rather than simplification work.
- **Gap**: Almost never triggered by cron. When triggered, does project management instead of code simplification. Not living up to "What can you delete today?" vision.
- **Recommendation**: Add to regular cron. Needs to actually run codebase audits, not just manage project status.

### Scout (The Researcher)
- **Heartbeat.md quality**: Good. Day-of-week awareness, dispatch table, clear research focus.
- **SOUL.md quality**: Good. Systematic research identity, clear output locations.
- **Actual behavior**: Active on recent heartbeats (ops: 21, 9, 7). Some sessions are productive (forking research), others exit early ("nothing to do"). Sunday behavior: correctly identifies slower news cycle.
- **Gap**: "Nothing to do" exits contradict heartbeat instruction that says "nothing to research is almost never true."
- **Recommendation**: Heartbeat could have a stronger "always find something" nudge with specific fallback topics.

### Bob (The Innovator/Architect)
- **Heartbeat.md quality**: Good. Focus on shipping unvalidated work, experiment lifecycle.
- **SOUL.md quality**: Excellent. Strong "close the loop" emphasis. Self-aware about 7MB unshipped analysis problem.
- **Actual behavior**: 13 cron heartbeats. Avg 14.1 ops. ~23% no-ops. When active, produces knowledge entries (KE-285) and processes experiments. Recent session produced real output.
- **Gap**: Inconsistent scheduling. Sometimes goes quiet. "Close the loop" mission is good but still accumulates more analysis than shipped code.
- **Recommendation**: More frequent cron. Heartbeat should emphasize "ship one thing" over "review everything."

### Optimizer (The Efficiency Engine)
- **Heartbeat.md quality**: Excellent. System snapshot query, rotation modes, "ship the fix" anti-pattern warning.
- **SOUL.md quality**: Strong. Numbers-driven identity, tools/workflows ownership.
- **Actual behavior**: 22 cron heartbeats. Avg 20.8 ops (highest). Only 9% no-ops. Recent sessions: completed cron consolidation project (41 ops), measured before/after.
- **Gap**: Sometimes over-invests in single sessions (41 ops). Could be more surgical.
- **Recommendation**: Already high-functioning. Cap session length to encourage dispatch-not-do pattern.

---

## Cross-Cutting Findings

### Heartbeat.md Files Are Already Role-Specific
Contrary to the original task assumption, the heartbeat.md files are NOT generic. Each one has:
- Agent-specific opening ("You're waking up. You [role-specific verb]")
- Role-specific metrics with concrete thresholds
- Decision trees tuned to each agent's work
- Dispatch tables mapping work types to workflows
- Exit checks requiring concrete outcomes

### Key Issues Are Scheduling, Not Content
1. **Amy**: 0 cron heartbeats. Cannot be proactive.
2. **Tech-Lead**: 2 cron heartbeats. Extremely underutilized.
3. **Scout, Bob**: Intermittent scheduling. Missing some cycles.
4. **Coach, Optimizer, May**: Well-scheduled. Consistent heartbeats.

### Productivity Metrics (Milestone 5 preview)
| Agent | Cron HBs | Avg Ops | No-op % | Assessment |
|-------|----------|---------|---------|------------|
| Coach | 107 | 15.4 | 10% | High productivity |
| May | 103 | 5.1 | 59% | High no-op rate (expected for coordinator) |
| Optimizer | 22 | 20.8 | 9% | High productivity |
| Bob | 13 | 14.1 | 23% | Moderate, inconsistent |
| Tech-Lead | 2 | 3.5 | 0% | Too few data points |
| Amy | 0 | N/A | N/A | Not scheduled |

### Recommended Next Steps
1. **Fix cron scheduling**: Amy and Tech-Lead need regular heartbeats
2. **Minor heartbeat tweaks**: Scout needs stronger "always find something" fallback; Bob needs "ship one thing" emphasis
3. **No major heartbeat.md rewrites needed** — the current files are already well-crafted
