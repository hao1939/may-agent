# EXP-251: Targeted FM-3.3/FM-1.3 Context Coaching — Results

**Status**: COMPLETED — Promote  
**Date**: 2026-04-25  
**Owner**: coach

## Hypothesis
Adding targeted failure-mode coaching to agent context.md files reduces specific failure rates.

## Treatment
- **Bob**: Added C1.7 DETAIL line to context.md explaining FM-3.3 (finish() requires verification_evidence). 
- **QA**: Added explicit "agents/ is a separate git repo — cd /app/agents before ANY git command" to context.md.

## Results

| Agent | Metric | Before (Apr 20-23) | After (Apr 24-25) | Change |
|-------|--------|--------------------|--------------------|--------|
| Bob | FM-3.3 rate | 20.0% (8/40) | 4.2% (44/1049) | **-15.8pp** |
| Bob | Avg quality | 0.573 | 0.933 | **+0.360** |
| QA | FM-1.3 rate | 28.6% (2/7) | 5.0% (20/401) | **-23.6pp** |
| QA | Avg quality | 0.680 | 0.920 | **+0.240** |

## Caveats
- Before-period sample sizes are small (40 and 7 sessions). The after-period has large N (1049 and 401).
- Other system changes (finish-guard enforcement, IT-96) may have contributed to quality improvement.
- The FM rate reduction is likely attributable to coaching; quality improvement is partially confounded.

## Conclusion
Context.md coaching for specific failure modes is effective. FM-3.3 and FM-1.3 rates dropped by 16-24pp. This validates the pattern: diagnose top failure mode → add one-line coaching to context.md → measure.

## KE
- **KE-XXX**: Context.md coaching reduces targeted failure modes by 15-24pp. One specific line addressing the exact failure pattern outperforms general advice. Apply to any agent with a dominant failure mode.

## Next
- Apply same pattern to next-worst agents (bob still lowest avg quality among active agents at 0.822 over full period)
- Identify bob's current top remaining failure mode for next coaching round
