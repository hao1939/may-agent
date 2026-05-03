# Analysis: Shallow Session Epidemic — 2025-05-03 23:47 UTC

## Finding

**The #1 quality issue across the system is shallow sessions.** Sessions completing with only 2 messages and no meaningful work output account for a massive fraction of all evaluated sessions.

## Data (last 7 days)

| Agent | Shallow Sessions | Total Evals | Shallow % | Avg Quality |
|-------|-----------------|-------------|-----------|-------------|
| coach | 406 | 905 | 44.9% | 0.354 |
| optimizer | 266 | 773 | 34.4% | 0.377 |
| bob | 65 | 183 | 35.5% | 0.494 |
| amy | 2 | 249 | 0.8% | 0.614 |
| may | 3 | 135 | 2.2% | 0.545 |
| scout | 1 | 92 | 1.1% | 0.511 |
| arc | 0 | 42 | 0.0% | 0.764 |

**Total shallow sessions: 744 out of 2,506 evals (29.7%)**

## Root Cause Analysis

Shallow sessions are sessions that start, exchange 1-2 messages, then terminate without doing real work. Possible causes:

1. **Interrupted dispatch**: Sessions get spawned then immediately interrupted (visible in system_status: hundreds of "interrupted" coach/optimizer/bob sessions)
2. **Resource contention**: Too many sessions spawned concurrently, causing timeouts
3. **Task duplication**: Same task dispatched repeatedly (EXP-188 had 15+ coach sessions; bob "Ship EXP-188 finish-guard" had 20+ sessions)
4. **Missing circuit-breaker**: Dispatchers don't check if task is already running

## Hypothesis: H-230 — Shallow Session Prevention

**If we add a pre-dispatch check** that verifies no identical/similar task is already running before spawning a new session, **then shallow session rate will drop from ~30% to <5%**, improving average quality scores by 10-15pp system-wide.

### Evidence supporting this:
- amy (0.8% shallow) and arc (0% shallow) have the highest quality scores
- The top 3 shallow agents (coach, optimizer, bob) are also the ones with the most repeated task patterns in system_status
- The eval-pipeline-revival project already identified this: "Worker workflow continues dispatching iterations even when the underlying project is already complete"

### Alternative hypothesis:
- Shallow sessions are a **measurement artifact**: short sessions that accomplish quick coordination tasks (notifications, status checks) get penalized unfairly
- **Test**: Check if shallow sessions correlate with `evaluatedByHeuristic = 1`

## Impact Estimate

If shallow sessions are eliminated:
- Coach avg quality: 0.354 → ~0.65 (removing 406 zero-value sessions)
- Optimizer avg quality: 0.377 → ~0.58
- System-wide quality: ~0.48 → ~0.63

This is the **single highest-leverage improvement** available.

## Recommended Actions

1. **Immediate**: Classify shallow sessions — are they truly wasteful or just short?
2. **If wasteful**: Add dispatch-dedup guard (DESIGN-dispatch-dedup-guard-v2.md exists but was never shipped)
3. **If measurement issue**: Adjust eval heuristic to not penalize legitimate short sessions
4. **Either way**: The eval pipeline should distinguish between "session that failed to produce" and "session that wasn't meant to produce"

## Connection to Previous Work

- ANALYSIS-eval-quality-patterns-2025-05-03.md: Identified zombie sessions pattern
- eval-pipeline-revival project: Found circuit-breaker already exists but doesn't cover all cases
- dispatch-dedup-guard: Designed but never deployed (this is the fix)

## Next Steps

- [ ] Check if shallow sessions correlate with heuristic vs LLM evaluation
- [ ] Pull 5 shallow coach sessions to classify: wasteful or legitimate?
- [ ] If wasteful: escalate dispatch-dedup-guard to tech-lead for shipping
