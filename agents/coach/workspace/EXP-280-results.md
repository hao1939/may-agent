# EXP-280: Verify-After-Edit Enforcement — Results

**Date**: 2026-08-01
**Status**: MEASURING — baseline updated with real data, awaiting post-treatment window
**Agent**: bob (treatment)

## Updated Baseline (Real Data, Pre-Deployment)

From bob's last 15 evaluations (all pre-treatment, queried from may.db):

| Metric | Value |
|--------|-------|
| FM-3.3 rate | **53%** (8/15 sessions flagged) |
| Avg quality | 0.691 |
| Quality range | 0.35 – 0.90 |
| Qualities | 0.75, 0.35, 0.85, 0.75, 0.55, 0.85, 0.90, 0.62, 0.82, 0.45, 0.75, 0.82, 0.74, 0.62, 0.55 |

**Key finding**: FM-3.3 baseline is **53%**, not 30% as originally estimated. This means the bar is lower than expected — even moderate improvement would be significant.

Common FM-3.3 patterns in baseline:
- `finish()` blocked by guard for no post-write verification → recovery via grep (recurring)
- Claimed deliverables without read-back evidence
- Weak verification (grep -c only, not full read)

## Treatment (Deployed ~2h ago)

1. **EXECUTION RULES** in `agents/bob/heartbeat.md`: "After every edit() or write(), immediately read() the same file. No exceptions."
2. **Hard gate skill** at `agents/bob/skills/verify-after-edit.md`: HARD RULE — every edit()/write() must be immediately followed by read(). No exceptions.

Both confirmed present in files.

## Post-Treatment Data

**Not yet available.** Only ~2h since deployment. Need 10+ bob sessions to measure.

## Measurement Plan

When 10+ bob sessions are available post-deployment:
1. Query `evaluations WHERE agent='bob' AND createdAt > [deployment_ts]`
2. Count FM-3.3 / VERIFICATION_FAILURE rate
3. Compare avg quality to 0.691 baseline
4. Apply decision matrix from measurement plan

## Decision Matrix

| FM-3.3 rate | Quality | Action |
|-------------|---------|--------|
| ≤10% | ≥0.70 | SUCCESS — write KE, deploy to other agents |
| ≤10% | <0.70 | Partial — skill works but has cost |
| >20% | any | FAIL — escalate to infrastructure enforcement |
| 10-20% | ≥0.70 | Partial success — additional reinforcement needed |

## Measurement (Aug 1, 2026)

Post-deployment data (n=14, from Apr 30 midday onward):
- FM-3.3 rate: **50%** (7/14) vs baseline 53% (8/15) — NO significant change
- Avg quality: 0.709 vs baseline 0.691 — marginal improvement within noise
- VERIFICATION issues: 29% (4/14)

**Result: NEGATIVE** — text skill adds no value beyond existing finish guard.
See: `EXP-280-measurement-update-aug1.md` for full analysis.

## Final Status: CLOSED — NEGATIVE RESULT
Confirms KE-338: text coaching does not change verification behavior. Structural guards (finish blocker) are the only effective mechanism.
