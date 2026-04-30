# EXP-300: Preliminary Measurement Results

**Date**: 2026-08-03
**Status**: MEASURING

## Deployment

Session-awareness-guard deployed to:
- ✅ amy/context.md
- ✅ coder/context.md  
- ✅ tech-lead/context.md
- ❌ bob (not deployed — already has anti-shallow)

## Post-Deployment Observations

### Ghost completion incidents in recent sessions (post-deploy):
- `s_1777570213587_88` — mentions "0 files" (needs investigation)
- `s_1777570634910_89` — mentions "0 files"
- `s_1777570935318_90` — mentions "0 files"
- `s_1777570937778_91` — mentions "0 files"
- `s_1777571064660_93` — mentions "0 files"

**Note**: These may be worker retry prompts (which mention "0 files") rather than actual ghost completions. The circuit breaker (MAX_ZERO_OUTPUT=3→escalation, 6→termination) should be catching these.

### Key observation:
The sessions mentioning "0 files" are from the `s_17775700-17775710` range — these are OLDER than the deployment sessions (`s_17775730+`). This suggests the guard was deployed AFTER these incidents, and we haven't yet seen enough post-deployment sessions from the target agents to measure.

## Conclusion

**Insufficient data for measurement**. Only 1 post-deployment session found from target agents (amy, done). Need more sessions before declaring results.

## Next Steps
- Re-measure after 5+ sessions from each target agent
- Check if any of the target agents hit ghost completion post-deployment
- If clean after 10+ sessions: close as POSITIVE
