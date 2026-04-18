# Bob Research Thread Budget Caps — Post-Fix Measurement (Apr 12)

**Date**: 2026-04-12 05:54 UTC  
**Fix deployed**: ~04:54 UTC Apr 12 (commit to `agents/shared/workflows/parallel-research.ts`)  
**Verdict**: ❌ INSUFFICIENT DATA — n=0 completed post-fix invocations. 1 invocation in progress.

## Fix Summary

Three changes deployed to `parallel-research.ts`:
1. **Thread budget**: ≤25 tool call cap added to thread prompts
2. **Synthesis budget**: ≤15 tool call cap added to synthesis prompts
3. **Anti-nesting instruction**: "Do NOT trigger deliver-or-report or other workflows" added to thread prompts

## Post-Fix Data (n=0 completed)

**1 invocation in progress** as of 05:54 UTC:
- Workflow: `wr_1775973259015_g5on` (parent: bob heartbeat `s_1775973221995_1892`)
- Thread 1: "EXP-144 results processing" — 0 ops, running (just started ~16s ago)
- Thread 2: "EXP-146 design" — 0 ops, running (just started ~16s ago)
- Synthesis: not yet spawned (threads haven't completed)

**Time since fix**: ~60 minutes. Only 1 bob heartbeat cycle has occurred since deployment.

## Pre-Fix Baselines (refined)

Updated baselines from last 7 invocations (Apr 9–12 pre-fix):

| Metric | n | Mean | Median | Range | Std Dev |
|--------|---|------|--------|-------|---------|
| Thread ops | 15 | 38.0 | 38.0 | 10–79 | 21.0 |
| Synthesis ops | 7 | 25.7 | 9.0 | 7–113 | 38.1 |
| Invocation total | 7 | 107.1 | 74.0 | 38–227 | 65.6 |

### Individual pre-fix invocations:

| Time | Threads | Thread ops | Synth ops | Total |
|------|---------|-----------|-----------|-------|
| Apr 12 01:24 | 2 | 15, 38 | 113 | 166 |
| Apr 12 00:55 | 2 | 21, 10 | 7 | 38 |
| Apr 12 00:24 | 2 | 16, 49 | 9 | 74 |
| Apr 11 22:26 | 3 | 79, 79, 51 | 18 | 227 |
| Apr 11 09:54 | 2 | 51, 39 | 16 | 106 |
| Apr 11 02:24 | 2 | 22, 37 | 9 | 68 |
| Apr 09 14:26 | 2 | 20, 43 | 8 | 71 |

### Key observations from pre-fix data:
- **Thread ops highly variable**: 10–79 range. The 3-thread invocation at 22:26 was worst (209 thread ops alone)
- **Synthesis ops bimodal**: 6/7 were ≤18 ops, but 1 was 113 ops (an extreme outlier that doubled its invocation cost)
- **D-o-R nesting confirmed in 2 cases**: Scout drops thread (Apr 9 09:54) triggered Phase 1 (33 ops) + Phase 2 (14 ops) internally. KB INDEX batch (Apr 12 02:24) triggered Phase 1 (93 ops) + Phase 3 (12 ops).

## What's Needed

- **Wait for current invocation to complete** (~5-15 minutes based on typical runtime)
- **Need n≥5 completed post-fix invocations** for a reliable measurement
- **At current rate** (~1 invocation per bob heartbeat every 30m, when research is queued): should have n≥5 within 2-3 hours
- **Check again after ~08:00 UTC** for sufficient data

## Interim Assessment

The fix is correctly deployed (verified in previous session — the prompt changes are in the committed code). The question is purely whether LLMs comply with the budget caps. Based on the D-o-R P1 cap experience:
- **P1 15-op cap**: 86% effective (1 violation in 7+ runs)
- **Anti-nesting instruction**: Effective at preventing callAgent() but not at preventing inline bloat
- **Expected outcome for research threads**: Budget caps will likely reduce the mean but won't eliminate all outliers. The ≤25 cap on threads (vs pre-fix mean of 38) should meaningfully reduce costs. The ≤15 cap on synthesis (vs pre-fix mean of 25.7, median 9) may have less impact since most synthesis sessions already ran lean.

## Next Steps

1. Re-run this measurement when n≥5 post-fix invocations are available
2. Compare thread avg, synthesis avg, and invocation total to pre-fix baselines
3. Specifically check: (a) any thread >25 ops? (b) any synthesis >15 ops? (c) any D-o-R nesting inside threads?
4. If budget caps show ≥50% compliance, declare effective. If <50%, escalate to infra maxOps.
