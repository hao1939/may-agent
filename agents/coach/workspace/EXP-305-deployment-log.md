# EXP-305: Deployment Log

**Deployed**: 2026-08-14
**Status**: DEPLOYED — Phase 1

## Changes Made

### agents/coach/context.md
Added after ANTI-SHALLOW RULE:
```
**PRE-FINISH GATE (MANDATORY)**: Before calling finish(status="success"), verify you made ≥1 write/edit call this session. 0 writes + finish(success) = ghost completion = FAILURE. If truly nothing to produce: call finish(status="blocked") with explanation, or write a status report/finding as your artifact.
```

### agents/optimizer/context.md
Added after ANTI-SHALLOW RULE (P0):
```
**PRE-FINISH GATE (MANDATORY)**: Before calling finish(status="success"), verify you made ≥1 write/edit call this session. 0 writes + finish(success) = ghost completion = FAILURE. If truly nothing to produce: call finish(status="blocked") with explanation, or write a status report/finding as your artifact.
```

## Measurement Plan
- T+48h: First check for ghost completions from coach/optimizer
- T+7d: Full measurement (≥10 sessions per agent)
- Baseline: TBD from activity.jsonl (evaluator dead, manual audit needed)
- Success: ≥70% reduction in ghost completions

## Notes
- Evaluator is dead (last eval Apr 30, 105 days ago). Measurement will rely on activity.jsonl "files":[] entries.
- coach-quality project is complete (target met) but marked blocked due to 50-iter safety cap. Shared dir is read-only; notified may to update status.
