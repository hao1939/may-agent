# Context Patch: EXP-243 — Constraint-Echo Before Finish

## Experiment
- **ID**: EXP-243
- **Scenario**: optimize-deploy-config
- **Agent**: coder
- **Baseline**: 6/7 (resources-valid fails 5/5 runs)
- **Target**: ≥3/5 resources-valid passes

## Patch: Add to coder context.md

### Addition (append after existing content)
```
## ⚡ [BEFORE CALLING finish()]
1. Re-read the ORIGINAL task description
2. List every constraint mentioned (preserve X, don't change Y, A must not exceed B)  
3. For each constraint: read() the relevant file and verify the constraint holds
4. If any constraint is violated: fix it, then re-verify
5. Only then call finish()
```
