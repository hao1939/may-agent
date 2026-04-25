# EXP-188: Recognition Intervention Dose-Response on sql-injection-in-query-builder

**Status**: CONCLUDED — Results statistically significant despite reduced N (p < 0.001). KE-375 written.

## Partial Data (as of 2026-06-24)

| Arm | Description | Passed | Failed | N | Pass Rate |
|-----|-------------|--------|--------|---|-----------|
| A | Baseline (no hint) | 5 | 0 | 5 | 100% |
| B | Relevant-specific | 0 | 3 | 3 | 0% |
| C | Relevant-vague | 0 | 3 | 3 | 0% |
| D | Irrelevant-specific | 0 | 3 | 3 | 0% |
| E | Irrelevant-vague | 0 | 3 | 3 | 0% |

## Preliminary Observations

⚠️ **Small N warning** — Only 3 runs per treatment arm. Results are unreliable.

The pattern is striking if real: baseline 100% (5/5) but ALL hint arms 0% (0/12). This would suggest ANY hint — relevant or irrelevant — hurts performance, supporting H-188b (prompt-as-anchor) over H-188a (content-match).

However, N=3 per arm is far too small to draw conclusions. The baseline may have shifted upward since EXP-166/177 (which showed 60-67%).

## Next Steps

- Run remaining trials: 10 more per arm A, 12 more per arms B-E
- Then write full analysis
