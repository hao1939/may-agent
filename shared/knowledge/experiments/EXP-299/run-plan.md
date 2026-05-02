# EXP-299 Run Plan — Ready to Execute

## Status: DISPATCH-READY (2025-05-02)
## Owner: bob → coach (for gym execution)

## Quick Summary
Test whether the obstacle-persistence skill reduces failure rate on `cascading-fix-trap-v2`.

## Pre-requisites (all met ✅)
- [x] Skill file: `agents/shared/skills/obstacle-persistence.md`
- [x] Scenario: `cascading-fix-trap-v2` (33% baseline pass rate)
- [x] Gym infra: working (`GYM_AGENT_BIN=/usr/local/bin/may-agent`)
- [x] Evaluator flags OBSTACLE_PIVOT: confirmed in production

## Execution Steps

### Phase 1: Control (20 trials, NO skill injection)
```bash
# Run 20 trials of cascading-fix-trap-v2 with coder agent, default config
for i in $(seq 1 20); do
  gym-run cascading-fix-trap-v2 --agent coder --trial-id "exp299-control-$i"
done
```
Record: pass/fail, OBSTACLE_PIVOT flags, total tool calls, session duration.

### Phase 2: Treatment (20 trials, WITH obstacle-persistence skill)
```bash
# Run 20 trials with obstacle-persistence.md injected into agent context
for i in $(seq 1 20); do
  gym-run cascading-fix-trap-v2 --agent coder --skill obstacle-persistence --trial-id "exp299-treatment-$i"
done
```
Record same metrics.

### Phase 3: Analysis
Compare:
| Metric | Control (N=20) | Treatment (N=20) | Δ |
|--------|---------------|-------------------|---|
| Pass rate | ~33% expected | Target: ≥50% | ≥+17pp |
| OBSTACLE_PIVOT rate | ~12.5% expected | Target: ≤7.5% | ≥-5pp |
| Avg tool calls | baseline | ≤+20% acceptable | |
| Avg duration | baseline | ≤+20% acceptable | |

### Success Criteria
- Primary: OBSTACLE_PIVOT rate drops ≥40% (from ~12.5% to ≤7.5%)
- Secondary: Pass rate improves (any statistically significant improvement)
- Safety: No >20% increase in session duration or tool calls

## How to Dispatch
Fork to coach with task:
```
Run EXP-299 Phase 1: Execute 20 control trials of cascading-fix-trap-v2 with coder agent (no extra skills). Record pass/fail and OBSTACLE_PIVOT flags for each. Save results to agents/bob/workspace/EXP-299-control-results.md
```

Then Phase 2:
```
Run EXP-299 Phase 2: Execute 20 treatment trials of cascading-fix-trap-v2 with coder agent, injecting agents/shared/skills/obstacle-persistence.md into context. Record pass/fail and OBSTACLE_PIVOT flags. Save to agents/bob/workspace/EXP-299-treatment-results.md
```

## Expected Impact
If confirmed (≥40% reduction in OBSTACLE_PIVOT):
- Deploy skill to all agents via shared skills loading
- Expected system-wide failure reduction: ~5% (12.5% × 40%)
- This would be the largest single intervention since EXP-178 (difficulty-adaptive guard)

## Risk Mitigation
- If treatment shows >30% increase in tool calls → guard is causing runaway retries → reduce to "try 1 alternative"
- If pass rate decreases → skill is harmful → kill immediately
