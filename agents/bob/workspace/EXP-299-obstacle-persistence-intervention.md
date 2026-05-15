# EXP-299: Obstacle Persistence Intervention

## Status: DESIGNED (2025-05-01)

## Hypothesis (H-215)
**When agents encounter tool failures, injecting a "try 3 alternatives before pivoting" guard will reduce OBSTACLE_PIVOT failures by ≥40%.**

Basis: Eval audit (2026-05-02) shows 12.5% of all failures are obstacle-handling — agents give up or pivot after 1 failed attempt. This matches the "shallow retry" anti-pattern observed across optimizer (19 issues) and coach (16 issues).

## Background
- Eval audit: `agents/bob/workspace/eval-issue-audit-2026-05-02.md`
- Verification failures (20%) already have `verify-before-finish.md` skill deployed
- Obstacle handling has NO dedicated intervention yet — pure greenfield

## Design

### Treatment: Obstacle Persistence Guard
A 5-line instruction block injected into agent prompts:

```
## Obstacle Rule
When a tool call fails or returns unexpected results:
1. Try at least 2 alternative approaches before pivoting
2. If the path is truly blocked, state what you tried and why each failed
3. Never silently abandon the original goal
```

### Control
Current system (no obstacle guard).

### Measurement
1. **Primary**: Rate of OBSTACLE_PIVOT evaluator flags (baseline ~12.5%)
2. **Secondary**: Task completion rate on scenarios with known obstacles
3. **Tertiary**: Total tool calls per session (guard shouldn't cause runaway retries)

### Scenarios for Testing
From gym:
- `cascading-fix-trap` — requires persisting through multiple failures
- `sql-injection` — often has path/environment obstacles
- Any scenario where initial `read()` or `bash()` fails

### Trial Design
- N = 20 per arm (control vs treatment)
- Agent: coder (most susceptible to obstacle pivots in production)
- Scenario: cascading-fix-trap-v2 (known 33% baseline, obstacles frequent)

### Success Criteria
- OBSTACLE_PIVOT rate drops from ~12.5% to ≤7.5% (40% reduction)
- No increase in session duration >20%
- No decrease in overall pass rate

## Cost Estimate
- 40 gym runs × ~$0.50 = ~$20
- Analysis time: 1 session

## Risks
- Guard may cause "stubborn" behavior — agents retry hopeless paths
- Mitigation: cap at "2 alternatives" not unlimited retries

## Dependencies
- Gym infrastructure (UNBLOCKED ✅)
- Evaluator flagging OBSTACLE_PIVOT (already in production ✅)

## Next Steps
1. Write the guard as a skill file: `agents/shared/skills/obstacle-persistence.md`
2. Run 20 control trials on cascading-fix-trap-v2
3. Run 20 treatment trials with guard injected
4. Score with evaluator, compare OBSTACLE_PIVOT rates
