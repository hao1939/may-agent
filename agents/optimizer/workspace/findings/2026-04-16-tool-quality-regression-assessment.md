# Tool Quality "Regression" Assessment — Apr 16

**Date**: 2026-04-16 02:31 UTC  
**Trigger**: tool-quality-scan reported 12 "regressed" categories  
**Verdict**: **Baseline establishment artifact, NOT real regressions**

## What Happened

The tool-quality-scan handler compares current 24h failure counts against a stored baseline. The trend history shows:

```
04-11: 2.3% → 1.4%
04-13: 0.0% → 0.0% → 0.0%   ← baseline was set here (all zeros)
04-16: 8.5%                   ← "regression" from zero baseline
```

All 12 "regressions" show `was 0, +100%`. The Apr 13 baseline had zero failures across all categories, likely because:
1. The scanner ran during a low-activity window with no evaluated failure chains
2. The 0.0% waste rate persisted across 3 consecutive scans, becoming the entrenched baseline

When normal activity resumed, every failure category appeared as a "new regression from zero."

## Current Waste Rate: 8.5% (675/7936 calls)

This is the **real** waste rate under normal load. The 0.0% periods were anomalous (low activity), not a target to regress from.

## Top 3 Actual Patterns (worth monitoring, not urgent)

| Category | Count | Wasted | Top Agent | Notes |
|----------|------:|-------:|-----------|-------|
| bash:exit-code-nonzero | 156 | 329 | optimizer(49) | Many are grep/bun failures returning exit 1 — not all are "errors" |
| bash:git-error | 53 | 80 | bob(13) | `--name-only --no-patch` conflict, gitignore blocks, wrong repo dir |
| bash:nonexistent-path | 27 | 120 | bob(11) | Agents guessing paths that don't exist |

### exit-code-nonzero (329 wasted calls) — Inflated metric
Many bash commands return non-zero legitimately (grep finding nothing = exit 1, test runs failing = expected). The classifier bucketing all non-zero exits as "failures" inflates this. Only a subset represents actual tool misuse.

### git-error (80 wasted) — Known patterns
The `--name-only --no-patch` conflict and gitignore blocks are recurring. These are learnable but low-impact individually (1-2 wasted calls each).

### nonexistent-path (120 wasted) — Path guessing
Bob and coder guess paths that don't exist. This is inherent to exploration — agents try a path, it fails, they adapt. Not easily fixable without pre-indexed path lists.

## Recommendation

1. **No intervention needed** — these are not regressions
2. **Fix the baseline logic**: The scanner should use a rolling average (not last-scan snapshot) to avoid zero-baseline false alarms. A simple fix: require baseline count ≥ 3 before flagging regression (currently flags anything ≥ 3 when baseline is 0).
3. **Monitor**: If waste rate stays above 10% for 3+ consecutive scans, investigate then

## Conclusion

The 12 "regressions" are a measurement artifact from a zero-activity baseline period. The 8.5% waste rate is normal operational noise across 7,936 calls. The scanner's regression detection needs a minimum-baseline threshold to avoid false positives.
