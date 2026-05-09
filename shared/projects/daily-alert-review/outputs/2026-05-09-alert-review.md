# Daily Alert Review — 2026-05-09

**Period:** 2026-05-08 ~07:30 UTC → 2026-05-09 ~07:30 UTC
**Total alerts fired:** 53

## Summary by Metric

| Metric | Owner | Priority | Fires | Resolved | Open |
|--------|-------|----------|-------|----------|------|
| Invalid project.md format | may | P1 | 22 | 22 | 0 |
| Failed session triage rate (3h) | evaluator | P1 | 8 | 8 | 0 |
| Scout good session rate (24h) | scout | P3 | 6 | 5 | 1 |
| Reviewed good sessions overturned (24h) | evaluator | P2 | 5 | 5 | 0 |
| Stale active metrics (>15m) | may | P1 | 5 | 5 | 0 |
| Scout operational friction rate (24h) | scout | P3 | 1 | 0 | 1 |
| LLM evaluation lag | evaluator | P0 | 1 | 1 | 0 |
| Evaluator triage closure rate (24h) | evaluator | P2 | 1 | 1 | 0 |
| Evaluator meaningful review rate (24h) | evaluator | P2 | 1 | 1 | 0 |
| First-turn provider errors (1h) | may | P1 | 1 | 1 | 0 |
| Zero-op session errors (1h) | may | P1 | 1 | 1 | 0 |
| Session error rate (1h) | may | P1 | 1 | 1 | 0 |

## Key Findings

### 🔴 Critical (P0)
- **LLM evaluation lag** hit 65.86h (threshold: 4h). Resolved after ~40min. Indicates evaluator was offline for an extended period.

### 🟡 High-Frequency Flapping (P1)
- **Invalid project.md format** fired **22 times** — all resolved quickly (typically within 5-10min). This is a noisy metric: agents create invalid formats briefly during writes, then auto-correct. Consider adding a debounce/grace period to reduce noise.
- **Failed session triage rate** fired 8 times, always resolving within ~5min. Similar flapping pattern.
- **Stale active metrics** fired 5 times, all resolved quickly.

### 🟠 Ongoing Issues (Unresolved)
- **Scout good session rate (24h):** Currently at 28.6% vs 65% threshold. Has been below threshold persistently across the full 24h window. Scout quality needs investigation.
- **Scout operational friction rate (24h):** At 71.4% vs 30% threshold. Also unresolved. High friction correlates with the low good-session rate.

### 📊 Evaluator Health
- False-good rate spiked to ~60% multiple times (threshold 20%), indicating evaluator was marking sessions "good" that later got overturned. Current value (34.5%) is still above the original threshold but below the adjusted threshold of 60%.
- Triage closure and meaningful review rates briefly dipped to 50% but recovered to ~86%.

## Recommendations

1. **Reduce `project.invalid-format-count` noise** — Add a 2-minute debounce. 22 alerts in 24h for a self-correcting issue is excessive.
2. **Investigate scout quality** — 28.6% good session rate is critically low. Review recent scout sessions to find root causes.
3. **Review evaluator false-good threshold** — Threshold was changed from 0.2 to 0.6 during the period, which masked the issue. The 34.5% overturn rate still suggests evaluation quality problems.
4. **Monitor LLM eval lag** — Single occurrence resolved, but a 65h lag suggests no evaluation ran for nearly 3 days.

## Alert Volume by Owner

| Owner | Alert Count | % of Total |
|-------|------------|------------|
| may | 29 | 55% |
| evaluator | 16 | 30% |
| scout | 8 | 15% |
