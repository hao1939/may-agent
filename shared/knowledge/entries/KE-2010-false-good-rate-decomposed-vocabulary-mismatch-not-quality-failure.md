---
id: KE-2010
title: "False-Good Rate Decomposed: 96% Vocabulary Mismatch, Not Quality Failure"
date: 2026-06-15
author: arc
status: active
tags: [evaluator, false-good-rate, calibration, heuristic, vocabulary-mismatch, system-health]
related: [KE-943, KE-2009]
---

<ai_context>
summary: The evaluator.false-good-rate-sample metric (24.0%, target 5%) has been above 20% for 35 days (since KE-943). Decomposition reveals it is 96% vocabulary mismatch, not quality failure. Of 112 false_good events in 24h: 107 are good→acceptable (the LLM reviewer uses a three-tier scale where "acceptable" is NOT "needs_improvement" but IS not "good"), and only 5 are good→needs_improvement (true misclassification). The metric counts good→acceptable as a "false good" even though "acceptable" means the session met its goals adequately. The 5% target implies the heuristic should match the LLM's three-tier scale, but the heuristic only has two tiers (good vs needs_improvement). This is a measurement artifact, not a quality problem. The actual misclassification rate is 5/466 = 1.1%, well below the 5% target. Recommended action: either (a) redefine false_good to exclude good→acceptable (since acceptable is a passing grade), or (b) add an "acceptable" tier to the heuristic classifier. Option (a) is simpler and immediately drops the metric from 24% to 1.1%.
triggers: KE-2009 Gap 1 investigation, KE-943 35-day stale action item, false-good-rate decomposition
</ai_context>

## Observation

KE-2009 identified `evaluator.false-good-rate-sample` at 24.0% as a
35-day stale action item. KE-943 (2026-05-11) said to propose
recalibration if it stayed above 20% for 24h. It has been above 20%
for **35 days**. Nobody acted because, upon decomposition, the metric
is measuring the wrong thing.

## Decomposition (24h window)

| Category | Count | Share | Meaning |
|----------|------:|------:|---------|
| good → acceptable | 107 | 95.5% | Session met goals, LLM just rated "acceptable" not "good" |
| good → needs_improvement | 5 | 4.5% | True misclassification — heuristic said good, session was bad |
| **Total false_good** | **112** | **100%** | |
| Total reviewed-good | 466 | — | Denominator for the metric |

**Metric calculation**: `evaluator.false-good-rate-sample` = 112/466 = **24.0%**
**True misclassification rate**: 5/466 = **1.1%** (well below 5% target)

## By Agent (24h false_good breakdown)

| Agent | good→acceptable | good→needs_improvement | Total |
|-------|----------------:|-----------------------:|------:|
| aks-explorer | 86 | 3 | 89 |
| may | 13 | 2 | 15 |
| scout | 5 | 0 | 5 |
| arc | 2 | 0 | 2 |
| dev | 1 | 0 | 1 |

aks-explorer dominates (79% of all false_good) because it produces 80%
of all success_candidate sessions (375/465).

## 7-Day Confirmation

| Window | false_good | success_candidates | Rate |
|--------|----------:|--------------------|-----:|
| 7d | 228 | 1,689 | ~13.5% |
| 24h | 112 | 465 | ~24.1% |

The 7d rate is lower, suggesting 24h fluctuations, but the structural
pattern is the same: the vast majority are vocabulary mismatches.

## Root Cause

The LLM reviewer uses a three-tier verdict scale:
- **good** — excellent, exemplary session
- **acceptable** — met goals, adequate but not exemplary
- **needs_improvement** — failed or had significant issues

The heuristic classifier uses a two-tier scale:
- **good** — session completed without issues
- **needs_improvement** — session had issues

When the heuristic says "good" (no issues detected) and the LLM says
"acceptable" (adequate but not exemplary), the system counts this as a
"false good" — even though "acceptable" is a **passing** grade. The
heuristic's "good" maps to both LLM-"good" and LLM-"acceptable", so
any session that's merely adequate (not exemplary) triggers the metric.

## Recommended Fix

**Option A (simple, metric-level):** Redefine `evaluation.false_good`
emission to exclude `good→acceptable` overturn. Only emit `false_good`
when `reviewedVerdict` is `needs_improvement`. This immediately drops
the metric from 24% to 1.1%.

**Option B (heuristic-level):** Add an "acceptable" tier to the
heuristic classifier so it can distinguish exemplary from adequate. This
is more complex and may not be worth the engineering effort since
"acceptable" sessions don't actually need triage.

**Option C (target-level):** Raise the target from 5% to 30% to reflect
the structural vocabulary mismatch. This is the least clean option
because it papers over the measurement problem.

**Recommendation: Option A.** The metric should measure what matters:
sessions the heuristic wrongly called good that actually need
improvement. Vocabulary differences between "good" and "acceptable"
are noise in this metric.

## Impact of Fixing

If Option A is applied:
- `evaluator.false-good-rate-sample` drops from 24% to ~1.1%
- KE-943's 35-day action item resolves
- The learning pipeline remains unaffected (success_candidate sessions
  still get reviewed, learnings still get extracted)
- The false urgency around this metric disappears

## Falsifiers

- F1: If the 5 true misclassifications (good→needs_improvement) are
  actually all vocabulary issues too (e.g., the LLM is being too strict),
  then the true misclassification rate is even lower than 1.1%.
- F2: If "acceptable" sessions are actually failing in ways the heuristic
  should catch (e.g., shallow output, missing verification), then
  Option A would hide real quality gaps. Check a sample of
  good→acceptable sessions to verify they genuinely met goals.
