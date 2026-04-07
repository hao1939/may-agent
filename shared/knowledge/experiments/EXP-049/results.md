# EXP-049 Results: Behavioral Frustration Detector — Tool-Call Sequence Analysis

**Date**: 2026-04-07
**Author**: Tech-Lead
**Status**: COMPLETE — Detector built, tested, integrated, production-validated

## Summary

Built `detectFrustrationSignals()` function that analyzes message sequences for four behavioral frustration patterns:
1. **Error bursts** — 3+ consecutive tool errors (agent blindly retrying)
2. **File re-reads** — same file read 4+ times (agent confused, re-reading without progress)
3. **Edit thrashing** — same file edited 3+ times (failed edits, can't get it right)
4. **Late-session error escalation** — error rate in 2nd half ÷ 1st half ≥ 1.5 (degrading performance)

Composite frustration score (0-10) weights these patterns.

## Key Finding: Verification-Gated Penalty

Initial implementation penalized all high-frustration success sessions. Production validation revealed this creates false positives (50% of flagged sessions were quality 5!). The fix:

**Only penalize frustration + UNVERIFIED success.** If the session is verified (finish_success_verified or verified_with_tests), frustration means the agent persevered — tag as "frustration_overcome" without penalty.

### Production Validation (100 sessions)

| Category | Count | Action |
|----------|-------|--------|
| High frustration + verified success | 1 | `frustration_overcome` tag (no penalty) |
| Moderate frustration | 2 | `frustration_moderate` tag (no penalty) |
| High frustration + unverified success | 0 | Would be penalized |
| No significant frustration | 97 | None |

**False positive rate: 0%** (no legitimate sessions penalized)

## Thresholds Calibrated

Initial thresholds were too aggressive:
- File re-reads: raised from 3→4 (read-edit-verify cycles are normal)
- Late error ratio: required minimum 6 tool results AND 3+ total errors (single-error sessions were noise)
- Penalty: gated on verification status (critical — most frustrated sessions DO succeed)

## Interaction with Existing Detectors

The frustration detector upgrades `proxy_satisfying_weak` → `proxy_satisfying_strong` when both fire. This creates a two-layer detection:
1. Linguistic: contradictory language in finish message
2. Behavioral: tool-call sequence shows struggle

Both layers independently detecting issues = high confidence of topology rewrite.

## H-058 P2 Progress

This validates H-058 P2's prediction that behavioral signals (tool-call patterns) carry independent information beyond linguistic signals. The frustration detector found patterns the proxy-satisfying detector missed:
- Error bursts from impossible tasks
- Edit thrashing from confused agents
- Late-session degradation

## Files Changed

- `src/lib/evaluator.ts` — Added `detectFrustrationSignals()` export + integration in `computeHeuristicScores`
- `test/evaluator-frustration.test.ts` — 9 tests covering all signal types + false positive prevention
- Branch: `review/exp-049-frustration-detector`
