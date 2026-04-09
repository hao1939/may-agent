# EXP-105 Results: Preliminary Before/After Comparison

**Date**: 2026-04-09 (T+9.6 hours post-deployment)  
**Status**: NO RESULTS — insufficient post-deployment data

## Executive Summary

The few-shot injection pipeline was deployed at 2026-04-09T07:24:20Z. As of ~9.6 hours later, **neither target agent has had a single work session** that could receive few-shot injection. The coder agent has been completely inactive since April 7. The optimizer has only run heartbeat sessions (which don't generate meaningful work). This experiment cannot produce results until real work sessions accumulate.

## Post-Deployment Data: Empty

| Agent | Post-Deploy Work Sessions | Sessions with Few-Shot Injection |
|---|---|---|
| Coder | 0 | 0 |
| Optimizer | 0 | 0 |

**No before/after comparison is possible.**

## Pre-Deployment Baselines (for future comparison)

### Coder — Last 14 Days (N=43 work sessions)

| Metric | Value |
|---|---|
| Avg Quality | 1.24 / 5 |
| Avg Efficiency | 1.18 / 5 |
| Avg Wasted Calls | 0.3 |
| Verdict: good | 65% (28/43) |
| Verdict: acceptable | 9% (4/43) |
| Verdict: needs_improvement | 9% (4/43) |
| Few-shot match rate | ~80% of tasks |

### Coder — Weekly Trend (Work Sessions)

| Week | N | Avg Quality | Good% | NI% |
|---|---|---|---|---|
| Mar 4-8 | 54 | 0.55 | 25% | 50% |
| Mar 9-15 | 80 | 0.67 | 34% | 24% |
| Mar 16-22 | 12 | 0.60 | 42% | 33% |
| Mar 24-29 | 55 | 0.69 | 55% | 9% |
| Mar 30 - Apr 7 | 16 | 1.78 | 38% | 6% |

**Trend**: Coder quality has been improving over time (from 0.55 to 1.78), driven by code/skill improvements, not few-shot. Any post-deploy improvement must be measured against this upward trend.

### Optimizer — Last 14 Days (N=52 work sessions)

| Metric | Value |
|---|---|
| Avg Quality | 3.56 / 5 |
| Avg Efficiency | 2.95 / 5 |
| Avg Wasted Calls | 1.6 |
| Verdict: good | 71% (37/52) |
| Verdict: acceptable | 27% (14/52) |
| Verdict: needs_improvement | 2% (1/52) |
| Few-shot match rate | ~20% of tasks |

### Optimizer — Weekly Trend (Work Sessions)

| Week | N | Avg Quality | Good% | NI% |
|---|---|---|---|---|
| Mar 4-8 | 37 | 0.97 | 11% | 16% |
| Mar 9-15 | 81 | 0.53 | 26% | 41% |
| Mar 16-22 | 19 | 1.06 | 11% | 47% |
| Mar 24-29 | 53 | 1.78 | 42% | 19% |
| Mar 30 - Apr 5 | 26 | 4.81 | 88% | 0% |
| Apr 6-8 | 9 | 3.53 | 56% | 0% |

**Trend**: Optimizer quality has risen dramatically (0.97 → 4.81) over weeks, well before few-shot deployment. The improvement is driven by accumulated code changes and skill refinements.

## Control Group Baseline (Non-Target Agents)

These agents should NOT be affected by few-shot. Any change in their metrics at the deployment boundary signals a confound.

### Last 14 Days Pre-Deploy

| Agent | N (all sessions) | Avg Quality | Post-Deploy N | Post-Deploy Avg Quality |
|---|---|---|---|---|
| Bob | 2233 | 3.30 | 51 | 2.14 |
| Coach | 2359 | 3.24 | 39 | 4.03 |
| Tech-Lead | 1830 | 3.57 | 23 | 3.75 |
| Scout | 890 | 3.32 | 18 | 4.00 |

**Note**: Bob's post-deploy quality DROP (3.30 → 2.14) and coach's RISE (3.24 → 4.03) suggest significant noise/confounds in the same-day comparison window. This reinforces that a short observation period is unreliable.

## Known Confounds

1. **6+ other code changes deployed same day** — finish-guard fixes, compaction improvements, auto-pause recovery, session lifecycle fixes, abort signal propagation
2. **Strong pre-existing upward trend** — both coder and optimizer were improving before deployment
3. **Evaluator is heuristic-based** — all evaluations have `evaluatedByHeuristic=1`; calibration changes over time are unknown
4. **Task mix varies by week** — no control for task difficulty

## Accidental Finding: Heartbeat Pattern Match

The optimizer heartbeat task text `"[heartbeat] REMINDER: Always report bugs and issues honestly"` matches the `bug|error` few-shot trigger pattern. This means heartbeats may be receiving unnecessary `reproduce-first-debugging.md` injection, wasting ~500-800 tokens per heartbeat session (every 30 minutes = ~48 injections/day).

**Recommendation**: Add heartbeat exclusion to the few-shot router, e.g.:
```typescript
if (task.includes('[heartbeat]')) return { content: null, matchedFiles: [], tokenEstimate: 0 };
```

## Next Steps

1. **Wait for data** — Re-run this analysis when N ≥ 30 coder work sessions exist post-deploy
2. **Fix heartbeat match bug** — Exclude heartbeat tasks from few-shot injection
3. **Add injection logging to evaluations** — Store whether few-shot was injected in the evaluation record for better attribution
4. **Consider gym-based measurement** — The `skipFewShot` flag enables controlled A/B experiments in gym that don't require waiting for production data
