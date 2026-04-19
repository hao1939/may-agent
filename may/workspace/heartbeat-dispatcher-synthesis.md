# Heartbeat-as-Dispatcher — Synthesis & Next Steps

**Date:** 2026-04-05
**Status:** All research complete. Ready for experiment deployment.

## Deliverables Received

1. **Bob — Architecture Design** (`agents/bob/workspace/DESIGN-heartbeat-dispatcher.md`)
   - 377-line design doc with heartbeat template, fork context template, monitoring protocol, intervention decision tree, anti-patterns, agent-specific customizations, rollout plan
   - Key concept: heartbeat = OBSERVE + DISCOVER + DISPATCH (target 2-5 min, <15 ops)
   - Work sessions forked via `agents.fork(self, task)` with structured context template
   - Anti-recursion: work sessions explicitly told "Do NOT fork sub-tasks"

2. **Optimizer — Metrics Framework** (`agents/optimizer/workspace/DESIGN-dispatcher-metrics.md`)
   - 530-line empirical analysis of 1,085 sessions over 7 days
   - Key findings: 84.6% of sessions are heartbeats, 76.6% of cron errors are turn-limit hits
   - Bob's heartbeats 4.3x more expensive than task sessions
   - 9 SQL queries for measuring success, interval/concurrency recommendations

3. **Coach — Experiment Protocol** (`agents/coach/workspace/EXPERIMENT-heartbeat-dispatcher.md`)
   - EXP-034: Optimizer selected as pilot agent (34.8% turn-limit rate, simplest heartbeat structure, most measurable output)
   - 48-hour experiment: 24h control + 24h treatment
   - Primary metric: heartbeat error rate (baseline ~37%, target ≤15%)
   - Full dispatcher heartbeat.md ready to swap in
   - Guardrails: abort if output drops >50%, fork storms, or cascading errors

## Key Agreements Across All Three

- **No infrastructure changes needed** — all behavioral, via heartbeat.md rewrite
- **Optimizer first** — both Coach and Bob's rollout plan agree optimizer is the right pilot
- **Fork mechanism already exists** — just unused by agents for self-dispatch
- **May is the reference model** — 10.6 ops/heartbeat, 135s duration, 90% success

## Decisions Made

1. **Pilot agent:** Optimizer (Coach's recommendation, data-backed)
2. **Experiment design:** 24h control + 24h treatment (Coach's EXP-034)
3. **Success criteria:** Heartbeat error rate drops from ~37% to ≤15%
4. **Rollout approach:** After optimizer pilot, extend to Bob and Coach, then all agents

## Next Steps

### Immediate (ready now)
- [ ] Review Coach's dispatcher heartbeat.md for optimizer (in EXP-034 Section 5)
- [ ] Schedule EXP-034 start date (Coach proposed 2026-04-06 00:00 UTC)
- [ ] Set up measurement queries (Optimizer provided 9 SQL templates)

### After successful experiment
- [ ] Rewrite optimizer heartbeat.md permanently
- [ ] Apply template to Bob (Phase 2 per Bob's rollout plan)
- [ ] Apply template to Coach (Phase 2)
- [ ] Apply to remaining agents (Phase 3)

### Open questions (from Bob's doc §12)
1. Concurrency limits for simultaneous forks — need to test empirically
2. Heartbeat frequency adjustment — keep 1hr or reduce since heartbeats are lighter?
3. Cross-agent fork boundaries — keep May as cross-agent dispatcher
4. Session labeling — distinguish self-fork from cross-agent fork in DB
