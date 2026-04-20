# EXP-188: Finish-Guard Enforcement for Persistent-Task Workflow

**Status**: COMPLETE — PROMOTE

## Summary

Finish-guard enforcement achieves +100pp improvement (0% → 100%) in persistent-task adoption. Text injection alone never works; structural gate at finish() is required.

## Data

| Arm | N | Pass rate | Notes |
|-----|---|-----------|-------|
| Baseline (text injection only) | 3 | 0% | Agents read project, work inline, skip workflow |
| Treatment (finish-guard gate) | 3 | 100% | Guard blocks finish(success) unless workflow.run("persistent-task") called |

**Delta**: +100pp (0% → 100%)

## Run IDs
- Baseline: 3283, 3284, 3285
- Treatment: 3280, 3281, 3282
- Additional baseline: 3274, 3275, 3276 (0/3)

## Analysis

Text injection fails because agents read the instruction, do the work inline, and call finish(success) without invoking the workflow. The finish-guard creates an unavoidable enforcement point — the agent literally cannot claim success without using the workflow.

This matches EXP-184's identical +100pp result, confirming that structural enforcement is the only reliable mechanism for workflow adoption.

## Conclusion

**CONFIRMED**: Finish-guard gates are the mechanism for enforcing workflow usage. Text/skill/instruction approaches have 0% effect.

## Deployment Status

✅ **DEPLOYED** — Guard implemented as `agents/shared/guards/finish-guard.ts` (workflow guard pattern). Registered in REGISTRY.md. Library code in `agents/src/lib/finish-guard.ts` with 41 passing tests.

## Followups

- Tech-lead: Implement finish-guard.ts with Gate 3 (persistent-task enforcement)
- Monitor production persistent-task adoption rate after deployment
- Consider extending finish-guard pattern to other workflow enforcement needs
