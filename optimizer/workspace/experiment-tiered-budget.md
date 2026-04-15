# Experiment: Tiered Turn Budgets for Heartbeat Sessions

**ID**: EXP-TIERED-BUDGET  
**Status**: deployed — code changes applied (2026-04-13)  
**Created**: 2026-04-13  
**Research Project**: [adaptive-reasoning-efficiency.md](../../shared/projects/adaptive-reasoning-efficiency.md)

---

## Hypothesis

Tiered soft turn budgets will reduce heartbeat token spend by 20%+ without increasing error rates or reducing work quality.

**Rationale**: Heartbeats often run 10-15+ turns even for simple "nothing to do" checks. A soft budget of 8 turns with a 2-turn grace period nudges agents to wrap up efficiently while preserving their ability to finish complex work.

## Design

### Implementation (deployed)
- **Soft budget**: When `turnCount == maxTurns`, inject a system message asking the agent to wrap up with `finish()`
- **Grace period**: 2 additional turns after the soft limit before force-close (`session.abortController.abort()`)
- **Heartbeat tier**: 8 turns (soft) + 2 (grace) = 10 turns max
- **Other tiers defined but NOT auto-assigned**: research=15, implementation=25 (available via fork interface `opts.maxTurns`)

### Why this differs from the old hard-kill (commit c183312)
The old system killed sessions at N turns with no warning. This killed 36 sessions mid-useful-work. The new system:
1. Gives a clear "wrap up" message at the soft limit
2. Provides a grace period for the agent to call `finish()`
3. Only force-closes after the grace period is exhausted
4. Preserves the agent's ability to checkpoint work before closing

### Safety constraint (BenVanik data)
Reducing thinking depth by 67% caused 80× API request increase. The turn budget does NOT reduce thinking — it limits the number of tool-call loops. An agent can still think deeply within each turn.

## Baseline Metrics (pre-deployment)

Collect from `.state/may.db` sessions table:
```sql
SELECT agent, 
  COUNT(*) as sessions,
  AVG(json_extract(evaluation, '$.metrics.ops')) as avg_ops,
  AVG(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_rate
FROM sessions 
WHERE kind = 'job' AND source = 'heartbeat'
  AND startedAt > strftime('%s', '2026-04-12') * 1000
GROUP BY agent;
```

**Key metrics to track**:
1. **Avg turns per heartbeat** — expect 20%+ reduction
2. **Error rate** — must NOT increase (safety gate)
3. **Read:Edit ratio** — must stay ≥ 4.0 (BenVanik floor indicator)
4. **Turn-budget-exceeded count** — how many sessions hit the hard limit
5. **Finish status distribution** — success vs partial vs failure

## Measurement Plan

### Phase 1: First 24 hours (monitoring)
- Watch for `[turn-budget]` log messages
- Count sessions that hit soft limit vs hard limit
- Check if any agents consistently hit the hard limit → may need tier adjustment

### Phase 2: After 48 hours (comparison)
- Compare avg turns per heartbeat: before vs after
- Compare error rates: before vs after
- Compare token spend: before vs after
- Look for quality degradation (shallow heartbeat rate)

### Success Criteria
- [ ] Heartbeat avg turns reduced by ≥ 20%
- [ ] Error rate does not increase by more than 2pp
- [ ] Read:Edit ratio stays ≥ 4.0
- [ ] No increase in shallow heartbeat rate
- [ ] Hard limit (force-close) fires in < 10% of budgeted sessions

### Failure Criteria (rollback if any)
- Error rate increases by > 5pp
- Read:Edit ratio drops below 3.0
- > 30% of heartbeats hit the hard limit (budget too tight)
- Agents start producing lower-quality findings (subjective review)

## Rollback Plan

To disable: set `maxTurns: 0` in the cron.ts heartbeat dispatch call. The enforcement code in manager.ts is no-op when `maxTurns === 0`.

## Code Changes

| File | Change |
|------|--------|
| `src/lib/manager-utils.ts` | Added `TURN_BUDGET_TIERS` constant and `TURN_BUDGET_GRACE` |
| `src/lib/manager.ts` | Enforcement in `subscribeForPersistence()`: soft message at limit, abort at limit + grace |
| `src/app/may.ts` | Fork handler passes `maxTurns` from event opts |
| `src/app/cron.ts` | Heartbeat dispatch uses `TURN_BUDGET_TIERS.heartbeat` (8) |

## Related
- Research project: [adaptive-reasoning-efficiency.md](../../shared/projects/adaptive-reasoning-efficiency.md)
- BenVanik data: DD#541 (anthropics/claude-code#42796)
- Old turn limit removal: commit c183312
