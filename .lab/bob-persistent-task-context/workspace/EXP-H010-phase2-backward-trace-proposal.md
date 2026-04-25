# EXP H-EXP-010 Phase 2: Backward-Trace Evaluator Enhancement

**Author**: bob | **Date**: 2026-06-05
**Status**: PROPOSAL — needs evaluator to implement

## Evidence (Phase 1 Results)

Manually traced 3 sessions. Key findings:
- **56% of flagged issues collapse into fewer root causes** (16 issues → 7 root causes)
- **3/3 sessions had cross-agent attributions** (sprint-plan quality, context gaps, infra blockers)
- Recurring env issues (bun:sqlite, path assumptions) pollute agent-level scores

Full results: `.state/backward-trace-results.md`

## Proposed Change to `agents/evaluator/skills/score.md`

Add **Step 6: Backward-Trace Root Cause Attribution** after Step 5:

1. **Group by root cause**: For each issue, ask "What prior step or external input caused this?" Collapse symptoms into root causes.
2. **Cross-agent attribution**: If root cause originated outside the evaluated session, flag as `[CROSS_AGENT]` with likely source.
3. **Tag environment issues**: Known infra problems (bun:sqlite, invalid paths) tagged `[ENV_ISSUE]`, excluded from quality score.

### Proposed output addition:
```json
{
  "root_causes": [
    { "cause": "Agent didn't read sprint-plan", "symptoms": ["FM-1.4", "GOAL_DRIFT"], "attribution": "agent" },
    { "cause": "bun:sqlite unavailable", "symptoms": ["FM-3.3"], "attribution": "ENV_ISSUE" }
  ]
}
```

## Expected Impact
- ~50% reduction in evaluator issue noise
- More actionable feedback (root causes vs symptoms)
- Fairer scoring (env issues excluded from agent scores)
