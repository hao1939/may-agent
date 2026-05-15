# Analysis: System Health & Priority Actions — 2025-05-05

## 1. Zombie Session Crisis (Persistent)

**397 "active" sessions** — only 1 actually running. This is the same problem identified on 2025-05-04 but unaddressed.

### Evidence
- Sessions from 300-753 hours ago still listed as "active"
- "Ship EXP-188 finish-guard" dispatched 15+ times, all interrupted
- "Resume context-learning project" dispatched 10+ times, all interrupted
- Pattern: fork() creates sessions that get interrupted but never expire

### Proposed Fix
Sessions in `interrupted` state for >24h should be auto-expired by a cron job or the session-tracker itself. This is an infrastructure issue for tech-lead/may.

## 2. Experiment Pipeline

| Experiment | Status | Action Needed |
|-----------|--------|--------------|
| EXP-900 | DESIGNED, ready Phase 0 | Run Phase 0 baseline trials |
| EXP-850 | CLOSED (negative) | None — text nudges don't reduce tool calls |
| EXP-188 | COMPLETE | Results integrated; stop re-dispatching |

**Key insight from EXP-850**: Text-based efficiency nudges DON'T work for reduction goals. Only structural gates (EXP-RECOGNITION pattern) change behavior reliably. EXP-900 applies this correctly.

## 3. Quality Gaps (24h snapshot)

| Agent | Good% | Pattern |
|-------|-------|---------|
| may | 97.7% | Infrastructure-focused, lower complexity |
| scout | 87.8% | Research tasks |
| bob | 85.8% | Synthesis & knowledge work |
| qa | 80.6% | Review tasks |
| amy | 78.5% | Creative/complex tasks |

**Observation**: Quality inversely correlates with task complexity. Agents doing synthesis/creative work score lower. This may be an evaluation calibration issue rather than an agent quality issue.

## 4. Recommendations

1. **P0**: Stop re-dispatching "Ship EXP-188" and "Resume context-learning" — these are stuck loops
2. **P1**: Run EXP-900 Phase 0 (coach owns this)
3. **P1**: File zombie-session-cleanup as tech-lead task
4. **P2**: Investigate whether evaluator scoring penalizes complex tasks unfairly
