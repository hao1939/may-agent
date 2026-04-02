# Analysis Review — 2026-03-23T20:36

## Window
- **Full day (Mar 23)**: 101 sessions / 20.6h = **4.9 sessions/hr**, 1613 ops, 78.1 ops/hr
- **Last 12h**: 101 sessions, 8.4 sessions/hr, 134.4 ops/hr
- **Last 2h**: 11 sessions (~5.5/hr), 149 ops

## Session Rate Trend
| Time | Sessions/hr | Notes |
|------|-------------|-------|
| 05:39 | 11.1/hr | Pre-cooldown |
| 12:06 | 13.3/hr | Peak |
| 19:06 | 7.2/hr | Cooldown active |
| 20:36 | 4.9/hr (daily avg) | Lowest yet |

Session rate has dropped **63% from peak** (13.3 → 4.9/hr daily avg). The 6h skill-lifecycle cooldown + early exit guards are clearly working.

## Agent Cost Share (Full Day)
| Agent | Ops | Share | Sessions | Notes |
|-------|-----|-------|----------|-------|
| optimizer | 650 | 40.3% | 24 (12 root + 12 child) | Skill-lifecycle children still dominant |
| coach | 451 | 28.0% | 27 (13 root + 14 child) | Training sprint children |
| tech-lead | 242 | 15.0% | 8 (8 root) | Active nudge tuning |
| bob | 102 | 6.3% | 12 root | Architecture/design |
| may | 51 | 3.2% | 12 root (8 idle) | 67% idle exits — good |
| qa | 50 | 3.1% | 10 root (6 idle) | 60% idle exits — good |
| scout | 48 | 3.0% | 4 root (1 idle) | Research |
| coder | 10 | 0.6% | 2 child | Only gym runs |
| evaluator | 9 | 0.6% | 2 root | Very low |

## Key Findings

### ✅ Improvements Working
1. **Session rate DOWN 63%** from peak (13.3 → 4.9/hr daily avg)
2. **Idle exits working**: May 67% idle, QA 60% idle — early exit guards effective
3. **Coach session.jsonl grep bypass GONE**: Zero instances in recent sessions
4. **Skill-lifecycle cooldown working**: 0 optimizer skill-lifecycle runs in last 5.7h
5. **Active Nudging live + tuned**: Tech-lead adjusted thresholds per Bob's brief (30 for read-heavy, 25 for coach, 20 for builders)

### ⚠️ Still Blocked
1. **ANTHROPIC_API_KEY NOT SET** — biggest savings opportunity ($36-90/day). Escalated multiple times.
2. **Optimizer still 40.3% of cost** — driven by historical skill-lifecycle runs earlier today. The cooldown IS working (0 runs in last 5.7h) so this will naturally decrease.
3. **Coach at 28%** — 14 child sessions from training sprints. Growth-cycle fork cost is the main driver.
4. **All handlers still dead** — binary from Mar 20 can't load Mar 23 TS files.

### 📊 Projected Daily Cost
At 4.9 sessions/hr: ~117 sessions/day, ~1876 ops/day
Vs previous projections: 160 sessions/day (12:06), 173 sessions/day (19:06)
**Down ~32% from the 19:06 projection.**

## Bob's Recent Work
- **Active Nudging tuning** — wrote brief for per-agent thresholds, Tech-Lead implemented (session 97)
- **Structured Delegation RFC** — `design-structured-delegation.md`, aims to fix vague handoffs (C4.1)
- **Gym Identity fix** — brief for sandboxing agent dirs in gym-runner.ts

## Verdict
System is in a good state. Session rate declining steadily. Main remaining opportunities are environmental (ANTHROPIC_API_KEY, binary rebuild) rather than behavioral. Coach growth-cycle cost is worth monitoring but within acceptable bounds given it produces real gym experiments.
