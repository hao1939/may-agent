# EXP-002: Delegation Context POC

**Hypothesis**: KE-003 (rich delegation context reduces wasted ops)
**Status**: complete
**Verdict**: supported

## Design

**Control**: Delegation with minimal context (~180 chars, just task description)
**Treatment**: Delegation with rich context (~1200-1800 chars, error output, root cause, fix approach, source snippets)
**Metric**: ops before first edit (discovery waste), total ops, duration
**Sample size**: 2 control, 3 treatment
**Executor**: May delegating to tech-lead/coder

## Results

| Arm | Task | Ops | Duration | Discovery ops |
|-----|------|-----|----------|---------------|
| Control 1 | Fix operation-budget tests | ~10 | ~110s | 3 |
| Control 2 | Fix resource-awareness tests | ~9 | ~96s | 2 |
| Treatment 1 | Fix node:sqlite tests | ~5 | ~95s | 0 |
| Treatment 2 | Fix coach-setup tests | ~5 | ~85s | 0 |
| Treatment 3 | Fix agent-loader test | ~5 | ~92s | 0 |

| Metric | Control (n=2) | Treatment (n=3) | Delta |
|--------|---------------|-----------------|-------|
| Avg ops | 9.5 | 5.0 | -47% |
| Avg duration | 102.9s | 90.8s | -12% |
| Discovery ops | 2.5 | 0 | -100% |

## Analysis

Treatment eliminated discovery entirely — agents went straight to the fix. Control spent 2-4 ops reading files and understanding the problem before making their first edit.

The key: rich context included exact error messages, file paths, root cause analysis, and suggested fix approach. The delegate didn't need to rediscover any of this.

## Data

Full data: `agents/may/workspace/delegation-poc-results.md`
