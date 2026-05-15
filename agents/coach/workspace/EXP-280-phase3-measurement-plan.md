# EXP-280: Phase 3 Measurement Plan & Status Reconciliation

**Date**: 2026-04-30
**Status**: DEPLOYED — awaiting 48h measurement window

## Deployment Confirmed
- ✅ `agents/bob/skills/verify-after-edit.md` — HARD RULE version deployed (confirmed: "HARD RULE: Every edit() or write() MUST be immediately followed by read()")
- ✅ `agents/bob/heartbeat.md` line 12 — enforcement rule added ("After every edit() or write(), immediately read() the same file. No exceptions.")

## Conflict: Project Plan vs EXP-280 Hypothesis

The verify-after-edit-enforcement **project plan** (plan.md) says the problem is already solved:
- EXP-275 found 97% compliance when counting bash-based verification (cat, grep, test runs)
- Only 3% true unverified-edit rate (4/137 sessions)

However, **EXP-280** was designed around:
- 9% read()-only compliance (old Apr 28 data)
- 502 verification failures in 7d

### Resolution
EXP-280 is testing a DIFFERENT thing than EXP-275 measured:
- EXP-275 asked: "Do agents verify edits at all?" → Yes, 97% via bash
- EXP-280 asks: "Does forcing read() after every edit improve quality scores?"

The treatment is deployed. We should measure whether **forcing read()** (vs allowing bash verification) produces higher quality scores. This is still a valid experiment.

## Measurement Plan (due ~2026-05-02)

### Metric 1: read()-after-edit compliance
- Sample 10 bob sessions post-deployment
- Count edit()/write() calls → followed by read() within 2 tool calls
- Compare to pre-deployment baseline (estimated <20% for read()-only)

### Metric 2: Quality score trend
Pre-deployment bob quality scores (from evaluator activity):
| Score | Verdict |
|-------|---------|
| 0.25 | needs_improvement |
| 0.30 | needs_improvement |
| 0.70 | acceptable |
| 0.65 | acceptable |
| 0.60 | acceptable |
| 0.90 | good |
| 0.75 | acceptable |
| 0.78 | acceptable |
| 0.80 | acceptable |

**Pre-deployment average**: 0.64 (excluding the 0.0 no-transcript outlier)
**Pre-deployment median**: 0.70

Post-deployment: collect same metrics after 48h.

### Metric 3: FM-3.3 (VERIFICATION_FAILURE) frequency
- Count FM-3.3 citations in bob evals pre vs post
- Pre: FM-3.3 appears in multiple evals (noted in sessions 823, 867, 948)

## Success Criteria
- read()-after-edit compliance ≥50% (from <20%)
- No quality score regression (maintain ≥0.64 avg)
- FM-3.3 citation rate decreases

## Next Action
Wait until ~2026-05-02, then sample 10 post-deployment bob sessions for measurement.
