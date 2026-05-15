# EXP-720 Phase 2: Dry-Run Logging — Deployment Record

**Date**: 2029-05-04
**Status**: DEPLOYED — collecting data

## What Was Deployed

Added dry-run logging to `agents/shared/workflows/master-worker.ts` (lines 458-472) that:
1. Imports `selectExamples` from `fewshot-inject-helpers.js`
2. Runs pattern matching on the `workerPrompt` (which contains the guidance/task)
3. If any patterns match, logs to `agents/shared/exp720-fewshot-dryrun.log`
4. Does NOT inject few-shot examples yet (dry-run only)
5. Wrapped in try/catch — zero risk to worker functionality

## Log Format

Each line is JSON:
```json
{
  "ts": "2029-05-04T12:00:00.000Z",
  "iteration": 1,
  "matchedFiles": ["reproduce-first-debugging", "evidence-over-narrative"],
  "guidancePreview": "first 200 chars of orchestrator guidance..."
}
```

## Known Concern

The `selectExamples` function runs against `workerPrompt` which includes EXP-510/565 injected text containing words like "error", "failure", "broken". This may cause false positives on patterns 2 and 5. Phase 1 already flagged this concern.

**Mitigation**: Code uses `selectExamples(guidance)` (orchestrator text only), NOT the full `workerPrompt`, avoiding false positives from EXP-510/565 injected text.

## Next Steps

1. Wait for 50+ worker iterations
2. Parse `agents/shared/exp720-fewshot-dryrun.log`
3. Calculate: match rate, pattern distribution, false positive rate
4. Decision gate: ≥15% match rate with <30% FP → Phase 3 (actual injection)

## Risk Assessment

- **Zero** functional risk (try/catch, logging only)
- **Minor** disk usage (~200 bytes per match, negligible)
- **Known** false positive concern from injected text patterns
