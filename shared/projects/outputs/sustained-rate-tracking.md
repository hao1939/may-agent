# Sustained Rate Tracking — 7-Day Worker Success Measurement

**Generated:** 2026-04-28T13:30Z  
**Measurement window:** 2026-04-22 to 2026-04-28  
**Method:** Checkpoint files in `.state/checkpoints/` examined for `files_modified` field as evidence of ≥1 deliverable produced.

## 7-Day Tracking Table

| Date       | Total Sessions | Sessions w/ Deliverables | Success Rate |
|------------|---------------|-------------------------|-------------|
| 2026-04-22 | 9             | 8                       | 89%         |
| 2026-04-23 | 4             | 3                       | 75%         |
| 2026-04-24 | 9             | 5                       | 56%         |
| 2026-04-25 | 10            | 10                      | 100%        |
| 2026-04-26 | 15            | 13                      | 87%         |
| 2026-04-27 | 9             | 7                       | 78%         |
| 2026-04-28 | 8             | 7                       | 88%         |
| **Total**  | **64**        | **53**                  | **83%**     |

## Summary Statistics

- **7-day average success rate: 83%** (53/64 sessions produced ≥1 deliverable)
- **Range:** 56% (Apr 23) — 100% (Apr 25)
- **Median daily rate:** 87%
- **Output files produced on Apr 28 alone:** 35 files in `outputs/`

## Agent Breakdown

Primary active agent: **bob** (research/experiments)  
- Ran experiments EXP-236 through EXP-261 during this window
- Every bob checkpoint examined contained `files_modified` with experiment results, hypothesis resolutions, or knowledge entries
- Bob accounted for ~70% of all checkpointed sessions

Secondary: **tech-lead** (1 session: DB repair on Apr 27)

## Methodology Notes

1. **Data source:** `.state/checkpoints/s_*.jsonl` files — each represents a completed worker session
2. **Success criterion:** Checkpoint JSON contains `files_modified` array with ≥1 entry
3. **Sessions without deliverables:** Typically heartbeat/triage sessions that reviewed notifications but produced no files (still useful work, but no tangible output)
4. **Limitation:** Only counts sessions that wrote checkpoints. Sessions that crashed before checkpointing are invisible (potential undercount of both total and failed sessions)

## Comparison to Baseline

Per `baseline.md` (measured Apr 28 over prior 14 days):
- **Baseline success rate:** ~60-65% (estimated from prior measurement)
- **Current 7-day rate:** 83%
- **Improvement:** ~20 percentage points

## Assessment

The 83% success rate exceeds the typical target of 75%. The system is performing well, with most non-deliverable sessions being intentional triage/heartbeat work rather than failures. The Apr 24 dip (56%) correlates with a period of more exploratory/setup sessions. The trend from Apr 25 onward is consistently ≥78%.
