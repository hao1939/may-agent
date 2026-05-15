# Session Duration Audit — 2029-07-04

## Method
Measured `Duration` field from all `last-session.md` files across agents.

## Results

| Agent | Duration | Category |
|-------|----------|----------|
| evaluator | 9s | ultra-short |
| master | 16s | ultra-short |
| may | 21s | ultra-short |
| judge | 25s | ultra-short |
| qa | 33s | ultra-short |
| scout | 42s | ultra-short |
| .lab/amy | 45s | ultra-short |
| amy | 55s | ultra-short |
| optimizer | 1m0s | borderline |
| coach | 1m13s | borderline |
| bob | 1m27s | short |
| tech-lead | 1m38s | short |
| coder | 2m54s | adequate |
| dev | 2m53s | adequate |
| .lab/coder | 2m54s | adequate |
| amy-kimi | 5m57s | good |
| arc | 10m7s | good |

## Summary

- **<60s (ultra-short)**: 8/17 (47%)
- **60-90s (borderline)**: 2/17 (12%)
- **Total <90s**: 10/17 (59%)
- **≥90s**: 7/17 (41%)

## Comparison to EXP-620

EXP-620 (2029-05-21) measured 55% ultra-short (<60s). Current measurement shows 47% ultra-short but 59% under the 90s threshold proposed by EXP-630.

**Conclusion**: The shallow session problem is unchanged. EXP-630 structural duration gate remains the highest-priority unimplemented intervention.

## Caveats

- This is last-session only (n=1 per agent), not a sample of many sessions
- Some agents (evaluator, master, judge) may have legitimately short sessions by design
- Excluding infrastructure agents (evaluator, master, judge): 7/14 = 50% <90s
