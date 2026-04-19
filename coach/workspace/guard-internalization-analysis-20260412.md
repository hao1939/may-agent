# Guard Internalization Analysis — Apr 12, 2026

## Key Finding: No Internalization Detected

FM-3.3 guard fire rate is **rising monotonically**: 29% → 61% over 6 days.
This is the opposite of EXP-110 (commit guard), which saw fire rates drop to near-zero within 20h.

## Data (from guard-breakdown-strict.json)

| Day | Fire Rate | Sessions |
|---|---|---|
| Apr 6 | 29.0% | 193 |
| Apr 7 | 34.2% | 538 |
| Apr 8 | 37.5% | 392 |
| Apr 9 | 51.8% | 575 |
| Apr 10 | 55.3% | 528 |
| Apr 11 | 60.8% | 250 (partial day) |

## Per-Agent Trend (First 3 days → Last 3 days)

- **bob**: 46% → 100% (+54pp) — anti-learning, always blocked
- **may**: 46% → 87% (+41pp) — escalating reliance
- **scout**: 50% → 75% (+26pp) — escalating reliance
- **optimizer**: 22% → 45% (+23pp) — escalating reliance
- **evaluator**: 20% → 28% (+7pp) — mild escalation
- **coach**: 34% → 35% (+1pp) — flat
- **qa**: 47% → 33% (-13pp) — slight improvement
- **tech-lead**: 27% → 17% (-11pp) — only genuine learner

## Interpretation

Channel 2 (structural guards) forces compliance but doesn't teach. The output metric (C1.3 = 95%) masks that agents haven't changed — they just get caught and retry.

**Implication**: Guards are permanent infrastructure. If we want behavioral transfer, we need workflow embedding (verify-wrap, EXP-138 proposal). Text-level skills won't help (KE-106).

## Action Items

1. P-143a: Track if fire rate hits 70% by Apr 15 (expect yes)
2. EXP-138: Deploy verify-wrap to reliant agents (may, scout, optimizer) to test workflow-based transfer
3. Consider exempting tech-lead from guard if fire rate stays <20% for 3 more days

## Related

- KE-143 written with full analysis
- EXP-123 results.md has comprehensive 31h data
- KE-137 bifurcation finding needs revision — "learner" classification was premature for some agents
