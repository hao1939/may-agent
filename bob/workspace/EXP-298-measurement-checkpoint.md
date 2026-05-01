# EXP-298 Measurement Checkpoint — 2027-09-14

**Status**: MEASUREMENT_IN_PROGRESS
**Guard Verified**: ✅ Present in `agents/optimizer/context.md` (condensed into Quality Gates section as "Confabulation: NEVER report numbers without tool output")

## Deployment Verification

The original standalone block from the design:
```
## ⚡ [CONFABULATION CHECK — P0]
- NEVER report numbers (coverage %, test counts, performance) unless you have TOOL OUTPUT showing them.
```

Has been **integrated** into the Quality Gates section as a one-liner:
```
- **Confabulation**: NEVER report numbers without tool output. Say "not measured" if unsure.
```

This is more compact but semantically equivalent. The guard is active.

## Measurement Challenge

No evaluation database accessible from this environment. The `evaluations` table in `agents/may.db` would contain post-deployment eval scores, but we need the `query_db` tool (optimizer's tool) to check.

## Proxy Evidence

The confabulation rule has been condensed and integrated alongside other quality gates (C1.1, C1.3, C1.7), suggesting it survived at least one context.md editing cycle — indicating the system considers it valuable enough to keep.

## Recommendation

1. **Ask evaluator/coach** to audit optimizer sessions since 2027-09-02 for [SELF_CONTRADICTION] flags
2. If no flags found in ≥5 sessions → PROMOTE (baseline was 3 flags in comparable window)
3. If insufficient data → extend measurement window to 2027-09-23

## Decision

Given measurement window has passed (due 2027-09-16, today is 2027-09-14+):
- Guard is confirmed deployed and retained
- Cannot access eval DB directly
- **Next action**: Request coach or evaluator to count [SELF_CONTRADICTION] flags in optimizer evals since 2027-09-02

## EXP-299 Contingency Status

EXP-299 (Retry-Context Clearing) remains on standby. Only deploy if EXP-298 shows <50% reduction in confabulation flags.
