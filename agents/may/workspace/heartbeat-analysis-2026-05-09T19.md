# May Heartbeat Analysis — 2026-05-09T18:55Z

## System Health Summary

### Overall: ✅ Stable with known issues

**Session throughput (last 3h):** 99 sessions, 96% success rate, avg 1m48s
**Active agents:** evaluator (182 sessions/6h), may (74), scout (47), dev (29), arc (21)

### Critical Metrics Needing Attention

| Metric | Current | Threshold | Target | Verdict |
|--------|---------|-----------|--------|---------|
| Scout good-session-rate (24h) | 0.28 | 0.65 | 0.85 | ⚠️ Known measurement artifact |
| Scout operational-friction (24h) | 0.83 | 0.30 | 0.10 | ⚠️ Known measurement artifact |
| Active project iterations (24h) | 0 | 1 | 10 | ⚠️ Real gap |
| Reviewed good sessions overturned (24h) | 0.26 | 0.60 | 0.05 | ⚠️ Evaluator calibration |

### Scout Quality Metrics: Known False Signal (No Action Needed)

Per KE-scout-quality-metrics-root-cause-2026-05-09.md:
- Scout's 28% good-session rate is actually **better than dev (13%) and arc (20%)**
- 75% of "needs_improvement" verdicts are procedural (git hygiene, schema errors)
- Gate-bounce retry sessions inflate the denominator
- **Scout is the only non-may agent with this metric** — it's a measurement asymmetry
- Actual scout evaluations: 34 good / 86 needs_improvement (28.3%) — matches known pattern

**Recommendation:** Already documented. Needs dev/arc to implement either:
1. Exclude gate-retry sessions from quality metrics, OR
2. Wire metric to substantive quality rate only

### Active Project Iterations = 0 ⚠️ Real Gap

No projects have iterated in 24h. This is a genuine issue per Hao's priority that "0 iter/24h = FAILING."

**Current projects:**
- scout-second-brain-learning: waiting (all milestones done)

### Error Pattern: Scout arXiv API Failures

Scout's arXiv exploration keeps hitting 429/400 errors (3 error sessions in 6h). This drives error rate up and good-session rate down. The explore-arxiv cron should implement backoff or reduce frequency.

### Evaluator Volume

Evaluator ran 182 sessions in 6h (30/hour) with 6 errors. This is healthy throughput. The aftermath system is working (10 runs, 0 errors).

## Actions Taken This Heartbeat

1. Verified no pending human requests
2. Analyzed scout quality metrics — confirmed known false signal per existing KEs
3. Identified arXiv API rate-limiting as contributor to scout errors
4. Noted project iteration gap (0/24h)

## Recommended Next Actions

1. **Message scout** about arXiv API backoff — reduce explore-arxiv cron frequency or add retry logic
2. **Create or resume a project** to address project iteration stagnation
3. **Message dev/arc** about implementing evaluator metric fix from KE recommendations
